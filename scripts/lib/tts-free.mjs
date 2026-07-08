// Ücretsiz TTS — Microsoft Edge nöral sesleri (edge-tts). Sıfır maliyet, kart yok.
// ElevenLabs yerine kullanılır; TR native ses free plan'da bloklu değildir.
//
// Kurulum (tek sefer): python -m pip install --user edge-tts
// Runtime: MS public TTS endpoint'ine bağlanır (bedava). ffmpeg/ffprobe süre için opsiyonel.
//
// Kullanım:
//   import { ttsFree, VOICES } from './lib/tts-free.mjs';
//   ttsFree(metin, 'dist/audio/out.mp3', { voice: VOICES.tr_male });
//
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';

export const VOICES = {
  tr_male:   'tr-TR-AhmetNeural',   // erkek, sıcak anlatıcı (belgesel/seyahat)
  tr_female: 'tr-TR-EmelNeural',    // kadın, net
  en_male:   'en-US-GuyNeural',     // erkek, sinematik anlatıcı
  en_female: 'en-US-AriaNeural',    // kadın, canlı
  en_male_uk:'en-GB-RyanNeural',    // İngiliz aksanı, belgesel
};

/**
 * Metni sese çevirir (mp3). Başarısızsa hata fırlatır.
 * @param {string} text
 * @param {string} outPath  hedef .mp3 yolu
 * @param {{voice?:string, rate?:string, pitch?:string, volume?:string}} opts
 *        rate/pitch/volume edge-tts formatı: '+0%', '-10%', '+0Hz', '+0%'
 * @returns {string} outPath
 */
export function ttsFree(text, outPath, opts = {}) {
  const voice  = opts.voice  || VOICES.tr_male;
  const rate   = opts.rate   || '+0%';
  const pitch  = opts.pitch  || '+0Hz';
  const volume = opts.volume || '+0%';

  const py = process.platform === 'win32' ? 'python' : 'python3';
  const r = spawnSync(py, [
    '-m', 'edge_tts',
    '--voice', voice,
    '--rate', rate,
    '--pitch', pitch,
    '--volume', volume,
    '--text', text,
    '--write-media', outPath,
  ], { encoding: 'utf8' });

  if (r.error) throw new Error(`edge-tts çalıştırılamadı (python + edge-tts kurulu mu?): ${r.error.message}`);
  if (r.status !== 0) throw new Error(`edge-tts hata (${r.status}): ${r.stderr || r.stdout || 'bilinmeyen'}`);
  if (!existsSync(outPath) || statSync(outPath).size < 1024) {
    throw new Error(`edge-tts çıktısı boş/geçersiz: ${outPath}`);
  }
  return outPath;
}

/** ffprobe ile ses süresi (saniye). ffprobe yoksa null. */
export function audioDuration(path) {
  const p = spawnSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', path,
  ], { encoding: 'utf8' });
  const d = parseFloat((p.stdout || '').trim());
  return Number.isFinite(d) ? d : null;
}
