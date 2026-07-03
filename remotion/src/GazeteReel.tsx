import React from 'react';
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img, Sequence,
} from 'remotion';
import { z } from 'zod';

/**
 * GazeteReel — "Kalkan Today" günlük gazete reel'i (Claude-tasarımı, Faz 1.5).
 * Canlı site CAPTURE ETMEZ → çerez/install banner bug'ı YOK. İçerik data/gazete-today.json'dan
 * (agent editöryal katmanı) props ile gelir. 1080x1920, 30fps, 900 frame (30sn).
 * Marka: Kalkan kurumsal (navy #072136 / altın #f4b53d), serif masthead + sans gövde.
 */

const C = {
  navy: '#072136', navy2: '#0a2e4c', navy3: '#0d3a5f',
  gold: '#f4b53d', gold2: '#e8a020', cream: '#f8f4ea', white: '#ffffff', muted: '#b9cbe0',
};
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";
const SANS = "'Montserrat', 'Inter', system-ui, sans-serif";

// İnce kağıt/grain dokusu (SVG noise, data-URI) — derinlik için düşük opaklık.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

export const gazeteReelSchema = z.object({
  date_long: z.string(),
  issue: z.string().optional(),
  lead_headline: z.string(),
  lead_deck: z.string().optional(),
  lead_image: z.string().optional(),
  col1_label: z.string().optional(),
  col1_title: z.string().optional(),
  col1_summary: z.string().optional(),
  col3_label: z.string().optional(),
  col3_title: z.string().optional(),
  col3_summary: z.string().optional(),
  // Evergreen (siteden): antik kent az-bilinen + hizmet reklamı
  eg_antik_name: z.string().optional(),
  eg_antik_tag: z.string().optional(),
  eg_antik_fact: z.string().optional(),
  eg_ad_name: z.string().optional(),
  eg_ad_tagline: z.string().optional(),
  eg_ad_cta: z.string().optional(),
});
export type GazeteReelProps = z.infer<typeof gazeteReelSchema>;

export const defaultGazeteReelProps: GazeteReelProps = {
  date_long: '3 Temmuz 2026, Cuma',
  issue: 'Sayı 42',
  lead_headline: 'Kalkan’da Yaz Sezonu Doruk Noktasında',
  lead_deck: 'Marina dolulukta rekor kırarken, antik kentlere ilgi artıyor.',
  lead_image: '',
  col1_label: 'Gündem',
  col1_title: 'Belediyeden yeni sahil düzenlemesi',
  col1_summary: 'Kalamar sahilinde yaya yolu ve aydınlatma yenilendi.',
  col3_label: 'Sahil',
  col3_title: 'Kaputaş’ta güvenli yüzme uyarısı',
  col3_summary: 'Dalgalı hava nedeniyle cankurtaran ekipleri uyardı.',
  eg_antik_name: 'Patara Antik Kenti',
  eg_antik_tag: 'UNESCO',
  eg_antik_fact: 'Dünyanın bilinen ilk deniz fenerlerinden biri Patara’dadır.',
  eg_ad_name: 'Kalkan Info Hizmetler',
  eg_ad_tagline: 'Villa, transfer, tekne turu — güvenilir yerel işletmeler.',
  eg_ad_cta: 'kalkaninfo.com/hizmetler',
};

// ── Ortak yardımcılar ──
const useAppear = (from: number, damping = 16) => {
  const frame = useCurrentFrame() - from;
  const { fps } = useVideoConfig();
  const o = spring({ frame, fps, config: { damping, stiffness: 110, mass: 0.6 } });
  return { o, frame };
};

const Rule: React.FC<{ w: number; o: number; h?: number }> = ({ w, o, h = 4 }) => (
  <div style={{ width: w * o, height: h, background: C.gold, borderRadius: 2, boxShadow: `0 2px 14px ${C.gold2}55` }} />
);

// ── Sahne 1: Masthead (0–90) ──
const Masthead: React.FC<GazeteReelProps> = (p) => {
  const { o } = useAppear(6, 14);
  const { o: o2 } = useAppear(24);
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [58, 75], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: fade, padding: 80 }}>
      <div style={{ fontFamily: SANS, fontSize: 28, letterSpacing: 7, color: C.gold, fontWeight: 700, opacity: o, transform: `translateY(${(1 - o) * -20}px)` }}>
        GÜNÜN GAZETESİ
      </div>
      <div style={{ margin: '18px 0' }}><Rule w={360} o={o} /></div>
      <div style={{
        fontFamily: SERIF, fontSize: 128, fontWeight: 900, color: C.cream, lineHeight: 0.95,
        textAlign: 'center', letterSpacing: -2, opacity: o, transform: `scale(${0.92 + o * 0.08})`,
        textShadow: '0 6px 40px rgba(0,0,0,0.5)',
      }}>
        KALKAN<br />TODAY
      </div>
      <div style={{ margin: '18px 0' }}><Rule w={360} o={o} /></div>
      <div style={{ fontFamily: SANS, fontSize: 30, color: C.muted, fontWeight: 500, opacity: o2, letterSpacing: 1 }}>
        {p.date_long}{p.issue ? `  ·  ${p.issue}` : ''}
      </div>
    </AbsoluteFill>
  );
};

// ── Sahne 2: Manşet (Sequence-göreli 0–360) ──
const Lead: React.FC<GazeteReelProps> = (p) => {
  const frame = useCurrentFrame(); // Sequence içinde 0-tabanlı
  const { o } = useAppear(8, 18);
  const { o: oDeck } = useAppear(24);
  const kb = interpolate(frame, [0, 240], [1.08, 1.20]); // ken-burns
  const imgFade = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });
  const outFade = interpolate(frame, [220, 240], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const kbC = interpolate(frame, [0, 240], [1.0, 1.05]); // contain için hafif zoom
  return (
    <AbsoluteFill style={{ opacity: outFade }}>
      {p.lead_image ? (
        // Foto ÜST blokta (yatay foto kesilmez): blurlu 'cover' dolgu + net 'contain' ön plan.
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '55%', overflow: 'hidden', opacity: imgFade }}>
          <Img src={p.lead_image} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(30px) brightness(0.55)', transform: `scale(${kb})` }} />
          <Img src={p.lead_image} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', transform: `scale(${kbC})` }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '48%', background: 'linear-gradient(180deg, rgba(4,20,35,0) 0%, rgba(4,20,35,0.55) 55%, #041423 100%)' }} />
        </div>
      ) : null}
      {/* Metin ALT blokta, düz navy zemin */}
      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: '0 70px 150px' }}>
        <div style={{ display: 'inline-block', alignSelf: 'flex-start', background: C.gold, color: C.navy, fontFamily: SANS, fontWeight: 800, fontSize: 26, letterSpacing: 3, padding: '8px 18px', borderRadius: 4, opacity: o, marginBottom: 22 }}>
          MANŞET
        </div>
        <div style={{ marginBottom: 20 }}><Rule w={140} o={o} h={5} /></div>
        <div style={{
          fontFamily: SERIF, fontWeight: 900, fontSize: 76, color: C.white, lineHeight: 1.05,
          letterSpacing: -1.5, opacity: o, transform: `translateY(${(1 - o) * 40}px)`, textShadow: '0 6px 40px rgba(0,0,0,0.6)',
        }}>
          {p.lead_headline}
        </div>
        {p.lead_deck ? (
          <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 36, color: C.muted, lineHeight: 1.4, marginTop: 22, opacity: oDeck, transform: `translateY(${(1 - oDeck) * 30}px)` }}>
            {p.lead_deck}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Sahne 3: Başlıklar (450–720) ──
const HeadlineCard: React.FC<{ label?: string; title?: string; summary?: string; from: number }> = ({ label, title, summary, from }) => {
  const { o } = useAppear(from, 16);
  if (!title) return null;
  return (
    <div style={{
      background: C.navy2, borderLeft: `8px solid ${C.gold}`, borderRadius: 12, padding: '30px 38px',
      width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
      opacity: o, transform: `translateX(${(1 - o) * -50}px)`,
    }}>
      {label ? <div style={{ fontFamily: SANS, fontSize: 24, letterSpacing: 3, color: C.gold, fontWeight: 800, marginBottom: 12 }}>{label.toUpperCase()}</div> : null}
      <div style={{ fontFamily: SERIF, fontSize: 48, fontWeight: 800, color: C.cream, lineHeight: 1.12 }}>{title}</div>
      {summary ? <div style={{ fontFamily: SANS, fontSize: 30, fontWeight: 400, color: C.muted, lineHeight: 1.35, marginTop: 12 }}>{summary}</div> : null}
    </div>
  );
};
const Headlines: React.FC<GazeteReelProps> = (p) => {
  const frame = useCurrentFrame(); // Sequence-göreli 0–270
  const { o } = useAppear(6);
  const outFade = interpolate(frame, [205, 225], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: 'center', padding: '0 70px', gap: 40, opacity: outFade }}>
      <div style={{ fontFamily: SANS, fontSize: 30, letterSpacing: 6, color: C.gold, fontWeight: 700, opacity: o, marginBottom: 6 }}>AYRICA BUGÜN</div>
      <HeadlineCard label={p.col1_label} title={p.col1_title} summary={p.col1_summary} from={20} />
      <HeadlineCard label={p.col3_label} title={p.col3_title} summary={p.col3_summary} from={50} />
    </AbsoluteFill>
  );
};

// ── Sahne 4: Outro / CTA (720–900) ──
const Outro: React.FC = () => {
  const { o } = useAppear(10, 14);
  const { o: o2 } = useAppear(32);
  const frame = useCurrentFrame(); // Sequence-göreli 0–180
  const pulse = 1 + Math.sin(Math.max(0, frame - 32) / 12) * 0.02;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: 80 }}>
      <div style={{ fontFamily: SANS, fontSize: 34, letterSpacing: 4, color: C.muted, fontWeight: 500, opacity: o, textAlign: 'center' }}>
        BÜTÜN HABERLER, HER SABAH
      </div>
      <div style={{ margin: '28px 0' }}><Rule w={300} o={o} /></div>
      <div style={{ fontFamily: SERIF, fontSize: 92, fontWeight: 900, color: C.cream, opacity: o, textAlign: 'center', lineHeight: 1, letterSpacing: -1 }}>
        KALKAN TODAY
      </div>
      <div style={{
        marginTop: 50, background: C.gold, color: C.navy, fontFamily: SANS, fontWeight: 800, fontSize: 40,
        padding: '22px 44px', borderRadius: 12, opacity: o2, transform: `scale(${pulse})`, boxShadow: `0 16px 44px ${C.gold2}66`,
      }}>
        kalkaninfo.com/gazete
      </div>
    </AbsoluteFill>
  );
};

// ── Sahne 4: Evergreen (Sequence-göreli 0–180) — antik az-bilinen + hizmet reklamı ──
const Evergreen: React.FC<GazeteReelProps> = (p) => {
  const frame = useCurrentFrame();
  const { o } = useAppear(6);
  const { o: o2 } = useAppear(22);
  const { o: oAd } = useAppear(56, 16);
  const outFade = interpolate(frame, [160, 180], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ opacity: outFade }}>
      {/* Antik az-bilinen — üst çeyrek */}
      <div style={{ position: 'absolute', top: '20%', left: 70, right: 70 }}>
        <div style={{ fontFamily: SANS, fontSize: 30, letterSpacing: 6, color: C.gold, fontWeight: 700, opacity: o, marginBottom: 16 }}>BİLİYOR MUYDUN?</div>
        {p.eg_antik_name ? <div style={{ fontFamily: SANS, fontSize: 30, color: C.muted, fontWeight: 600, opacity: o, marginBottom: 18 }}>📍 {p.eg_antik_name}{p.eg_antik_tag ? ` · ${p.eg_antik_tag}` : ''}</div> : null}
        <div style={{ marginBottom: 22 }}><Rule w={140} o={o} h={5} /></div>
        <div style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 58, color: C.cream, lineHeight: 1.2, opacity: o2, transform: `translateY(${(1 - o2) * 30}px)` }}>{p.eg_antik_fact}</div>
      </div>
      {/* İş birliği/reklam — alt kısım (Berkay: daha aşağıda) */}
      {p.eg_ad_name ? (
        <div style={{ position: 'absolute', bottom: '11%', left: 70, right: 70, background: C.navy2, border: `1px solid ${C.gold}55`, borderRadius: 14, padding: '26px 32px', opacity: oAd, transform: `translateY(${(1 - oAd) * 30}px)` }}>
          <div style={{ fontFamily: SANS, fontSize: 22, letterSpacing: 3, color: C.gold, fontWeight: 800, marginBottom: 10 }}>İŞ BİRLİĞİ · REKLAM</div>
          <div style={{ fontFamily: SERIF, fontSize: 44, fontWeight: 800, color: C.cream }}>{p.eg_ad_name}</div>
          {p.eg_ad_tagline ? <div style={{ fontFamily: SANS, fontSize: 27, color: C.muted, marginTop: 8, lineHeight: 1.35 }}>{p.eg_ad_tagline}</div> : null}
          {p.eg_ad_cta ? <div style={{ fontFamily: SANS, fontSize: 26, color: C.gold, fontWeight: 700, marginTop: 12 }}>📞 {p.eg_ad_cta}</div> : null}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const GazeteReel: React.FC<GazeteReelProps> = (props) => {
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 0%, ${C.navy3} 0%, ${C.navy} 55%, #041423 100%)` }}>
      <AbsoluteFill style={{ backgroundImage: GRAIN, opacity: 0.06, mixBlendMode: 'overlay' }} />
      <Sequence from={0} durationInFrames={75}><Masthead {...props} /></Sequence>
      <Sequence from={75} durationInFrames={240}><Lead {...props} /></Sequence>
      <Sequence from={315} durationInFrames={225}><Headlines {...props} /></Sequence>
      <Sequence from={540} durationInFrames={180}><Evergreen {...props} /></Sequence>
      <Sequence from={720} durationInFrames={180}><Outro /></Sequence>
    </AbsoluteFill>
  );
};
