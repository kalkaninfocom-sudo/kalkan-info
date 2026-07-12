import React from 'react';
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence, Img, Audio,
} from 'remotion';
import { z } from 'zod';

// staticFile bu kurulumda /public/ prefix'iyle 404 veriyor → assetleri mutlak URL ile ver.
// base render sırasında dev server (localhost:3055) veya prod CDN olabilir.
let BASE = '';
const asset = (p: string) => (/^https?:/i.test(p) ? p : BASE + p);

const C = { bg: '#020510', sea: '#4A9EF5', gold: '#E8A020', white: '#FFFFFF', green: '#4ADE80', deep: '#051028' };
const FONT_DISPLAY = 'Orbitron, sans-serif';
const FONT_BODY = 'Inter, sans-serif';

// ---------------------------------------------------------------------------
// Schema — per-sahne frames + audio, build script'i webapp-promo.json + VO manifest'inden üretir
// ---------------------------------------------------------------------------
export const webappPromoSchema = z.object({
  lang: z.string(),
  base: z.string().default("http://localhost:3055/remotion/public/"),
  music: z.string(),
  scenes: z.array(z.object({
    key: z.string(),
    type: z.enum(['cinematic', 'screen', 'install', 'cta']),
    frames: z.number(),
    label: z.string(),
    headline: z.string(),
    sub: z.string(),
    audio: z.string().nullable(),
    screen: z.string().nullable(),
    photos: z.array(z.string()).default([]),
  })),
});
export type WebappPromoProps = z.infer<typeof webappPromoSchema>;

// ---------------------------------------------------------------------------
// Ortak yardımcılar
// ---------------------------------------------------------------------------
const Bg: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse at top, ${C.deep} 0%, #021024 55%, ${C.bg} 100%)` }} />
);

const Stars: React.FC = () => {
  const frame = useCurrentFrame();
  const stars = React.useMemo(() => Array.from({ length: 44 }, (_, i) => ({
    x: (i * 37) % 1080, y: (i * 113) % 1920, size: 1 + (i % 4), off: i * 7,
  })), []);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {stars.map((s, i) => {
        const op = 0.25 + 0.45 * Math.abs(Math.sin((frame + s.off) / 30));
        return <div key={i} style={{
          position: 'absolute', left: s.x, top: s.y, width: s.size, height: s.size,
          background: C.white, opacity: op, borderRadius: '50%', boxShadow: `0 0 ${s.size * 2}px ${C.white}`,
        }} />;
      })}
    </AbsoluteFill>
  );
};

const TopLabel: React.FC<{ text: string; from?: number; color?: string }> = ({ text, from = 0, color = C.gold }) => {
  const frame = useCurrentFrame() - from;
  const { fps } = useVideoConfig();
  if (!text || frame < -10) return null;
  const o = spring({ frame, fps, config: { damping: 14, stiffness: 110 } });
  const y = interpolate(o, [0, 1], [-20, 0]);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: 78, opacity: o }}>
      <div style={{
        fontFamily: FONT_BODY, fontWeight: 700, fontSize: 30, color, letterSpacing: 6,
        textTransform: 'uppercase', transform: `translateY(${y}px)`, textShadow: '0 4px 20px rgba(0,0,0,0.8)',
        background: 'rgba(2,5,16,0.55)', padding: '10px 28px', borderRadius: 999,
        border: `1px solid ${color}55`, backdropFilter: 'blur(10px)',
      }}>{text}</div>
    </AbsoluteFill>
  );
};

const BottomTitle: React.FC<{ headline: string; sub?: string; from?: number }> = ({ headline, sub, from = 0 }) => {
  const frame = useCurrentFrame() - from;
  const { fps } = useVideoConfig();
  if (frame < -10) return null;
  const o = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const y = interpolate(o, [0, 1], [40, 0]);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 150, opacity: o }}>
      <div style={{ transform: `translateY(${y}px)`, textAlign: 'center', padding: '0 60px', maxWidth: 1000 }}>
        <div style={{
          fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: 74, color: C.white, letterSpacing: -2,
          lineHeight: 1.05, textTransform: 'uppercase', textShadow: '0 8px 32px rgba(0,0,0,0.9)',
        }}>{headline}</div>
        {sub && <div style={{
          marginTop: 16, fontFamily: FONT_BODY, fontWeight: 500, fontSize: 30, color: C.sea,
          letterSpacing: 0.4, textShadow: '0 4px 14px rgba(0,0,0,0.9)',
        }}>{sub}</div>}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Sinematik açılış — gerçek Kalkan fotoları, Ken Burns + marka üst yazı
// ---------------------------------------------------------------------------
const Cinematic: React.FC<{ photos: string[]; headline: string; sub: string; duration: number }> = ({
  photos, headline, sub, duration,
}) => {
  const frame = useCurrentFrame();
  const per = duration / Math.max(1, photos.length);
  const idx = Math.min(photos.length - 1, Math.floor(frame / per));
  const local = frame - idx * per;
  const zoom = interpolate(local, [0, per], [1.08, 1.20], { extrapolateRight: 'clamp' });
  const pan = interpolate(local, [0, per], [0, -3], { extrapolateRight: 'clamp' });
  const fadeIn = interpolate(local, [0, 12], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const brandO = spring({ frame: frame - 8, fps: 30, config: { damping: 16, stiffness: 80 } });
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {photos.map((p, i) => (
        <AbsoluteFill key={i} style={{ opacity: i === idx ? fadeIn : 0 }}>
          <Img src={asset(p)} style={{
            width: '100%', height: '100%', objectFit: 'cover',
            transform: `scale(${zoom}) translateY(${pan}%)`,
          }} />
        </AbsoluteFill>
      ))}
      {/* koyu degrade — yazı okunur */}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(2,5,16,0.55) 0%, rgba(2,5,16,0.15) 40%, rgba(2,5,16,0.85) 100%)' }} />
      {/* marka + hook */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: brandO }}>
        <div style={{ textAlign: 'center', padding: '0 60px' }}>
          <div style={{
            fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: 96, color: C.white, letterSpacing: -3,
            lineHeight: 1, textTransform: 'uppercase', textShadow: '0 10px 40px rgba(0,0,0,0.9)',
          }}>KALKAN<span style={{ color: C.gold }}>INFO</span></div>
          <div style={{ width: 200, height: 4, background: `linear-gradient(90deg, ${C.gold}, ${C.sea})`, borderRadius: 2, margin: '26px auto' }} />
          <div style={{
            fontFamily: FONT_BODY, fontWeight: 700, fontSize: 44, color: C.white,
            textShadow: '0 6px 24px rgba(0,0,0,0.95)',
          }}>{headline}</div>
          <div style={{ marginTop: 12, fontFamily: FONT_BODY, fontWeight: 500, fontSize: 30, color: C.sea, textShadow: '0 4px 16px rgba(0,0,0,0.9)' }}>{sub}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Telefon çerçevesi — screenshot içeride scroll (başparmak taklidi)
// ---------------------------------------------------------------------------
const PhoneFrame: React.FC<{ src: string; duration: number; tiltDeg?: number }> = ({ src, duration, tiltDeg = -2 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scrollProgress = interpolate(frame, [22, duration - 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scrollPct = scrollProgress * 24;
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 90 } });
  const enterO = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const exitO = interpolate(frame, [duration - 14, duration], [1, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const opacity = Math.min(enterO, exitO);
  const phoneW = 780, phoneH = 1540, radius = 66;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity }}>
      <div style={{ perspective: 1800 }}>
        <div style={{
          width: phoneW, height: phoneH, borderRadius: radius, background: '#0a1428', padding: 13,
          boxShadow: '0 36px 100px rgba(74,158,245,0.42), 0 12px 36px rgba(0,0,0,0.78), inset 0 0 0 2px rgba(255,255,255,0.07)',
          transform: `scale(${enter}) translateY(${(1 - enter) * 70}px) rotateY(${tiltDeg}deg) rotateX(1deg)`,
          transformStyle: 'preserve-3d', position: 'relative',
        }}>
          <div style={{ width: '100%', height: '100%', borderRadius: radius - 13, overflow: 'hidden', background: '#000', position: 'relative' }}>
            <Img src={asset(src)} style={{
              width: '100%', height: 'auto', display: 'block', objectFit: 'cover', objectPosition: 'top',
              transform: `translateY(-${scrollPct}%)`, willChange: 'transform',
            }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 45%)', pointerEvents: 'none' }} />
          </div>
          <div style={{ position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)', width: 190, height: 34, background: '#0a1428', borderRadius: 17 }} />
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', width: 210, height: 6, background: 'rgba(255,255,255,0.4)', borderRadius: 3 }} />
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 70, width: 680, height: 66, background: `radial-gradient(ellipse, ${C.sea}66 0%, transparent 70%)`, filter: 'blur(28px)' }} />
    </AbsoluteFill>
  );
};

const ScreenScene: React.FC<{ src: string; label: string; headline: string; sub: string; duration: number; tiltDeg: number }> = ({
  src, label, headline, sub, duration, tiltDeg,
}) => (
  <AbsoluteFill>
    <Bg /><Stars />
    <PhoneFrame src={src} duration={duration} tiltDeg={tiltDeg} />
    <TopLabel text={label} from={4} />
    <BottomTitle headline={headline} sub={sub} from={16} />
  </AbsoluteFill>
);

// ---------------------------------------------------------------------------
// Install sahnesi — iOS Paylaş → Ana Ekrana Ekle → ana ekran; Android chip
// ---------------------------------------------------------------------------
const AppIcon: React.FC<{ size?: number }> = ({ size = 150 }) => (
  <div style={{
    width: size, height: size, borderRadius: size * 0.24,
    background: `linear-gradient(150deg, ${C.deep}, ${C.bg})`,
    boxShadow: '0 12px 30px rgba(0,0,0,0.5), inset 0 0 0 1.5px rgba(255,255,255,0.08)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
  }}>
    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: size * 0.19, color: C.white, letterSpacing: -1, lineHeight: 1 }}>KALKAN</div>
    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: size * 0.19, color: C.gold, letterSpacing: 1, lineHeight: 1 }}>INFO</div>
  </div>
);

const InstallScene: React.FC<{ label: string; headline: string; sub: string; duration: number; en?: boolean }> = ({
  label, headline, sub, duration, en,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // faz: 0 share sheet yükselir, 1 "Ana Ekrana Ekle" vurgu+tap, 2 ana ekrana ikon pop
  const sheetY = spring({ frame: frame - 10, fps, config: { damping: 18, stiffness: 90 } });
  const highlightAt = duration * 0.42;
  const tapPulse = frame > highlightAt ? 1 + 0.06 * Math.sin((frame - highlightAt) / 4) : 1;
  const homeAt = duration * 0.66;
  const iconPop = spring({ frame: frame - homeAt, fps, config: { damping: 12, stiffness: 120 } });
  const showHome = frame > homeAt;
  const phoneW = 700, phoneH = 1420, radius = 60;

  const rows = [
    { icon: '⧉', label: en ? 'Copy' : 'Kopyala', hot: false },
    { icon: '＋', label: label || (en ? 'Add to Home Screen' : 'Ana Ekrana Ekle'), hot: true },
    { icon: '☆', label: en ? 'Bookmark' : 'Yer İşareti', hot: false },
  ];

  return (
    <AbsoluteFill>
      <Bg /><Stars />
      <TopLabel text={headline} from={2} color={C.green} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: phoneW, height: phoneH, borderRadius: radius, background: '#0a1428', padding: 12,
          boxShadow: '0 30px 90px rgba(74,158,245,0.35), 0 10px 30px rgba(0,0,0,0.8)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ width: '100%', height: '100%', borderRadius: radius - 12, overflow: 'hidden', background: '#0b1a2e', position: 'relative' }}>
            {!showHome ? (
              <>
                {/* app arka planı (blur) */}
                <AbsoluteFill style={{ background: 'linear-gradient(180deg, #0e2438, #071322)', filter: 'blur(1px)' }}>
                  <div style={{ padding: 40, opacity: 0.5 }}>
                    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: 40, color: C.white }}>KALKAN<span style={{ color: C.gold }}>INFO</span></div>
                  </div>
                </AbsoluteFill>
                {/* iOS share sheet */}
                <div style={{
                  position: 'absolute', left: 16, right: 16, bottom: 16,
                  transform: `translateY(${interpolate(sheetY, [0, 1], [700, 0])}px)`,
                  background: 'rgba(28,32,40,0.96)', borderRadius: 36, padding: 22, backdropFilter: 'blur(20px)',
                  boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
                }}>
                  <div style={{ width: 60, height: 6, background: 'rgba(255,255,255,0.3)', borderRadius: 3, margin: '0 auto 20px' }} />
                  {rows.map((r, i) => {
                    const hot = r.hot && frame > highlightAt;
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '20px 22px', marginBottom: 12, borderRadius: 20,
                        background: hot ? 'rgba(232,160,32,0.22)' : 'rgba(255,255,255,0.06)',
                        border: hot ? `2px solid ${C.gold}` : '2px solid transparent',
                        transform: hot ? `scale(${tapPulse})` : 'scale(1)',
                      }}>
                        <span style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 30, color: hot ? C.gold : C.white }}>{r.label}</span>
                        <span style={{ fontSize: 34, color: hot ? C.gold : 'rgba(255,255,255,0.7)' }}>{r.icon}</span>
                      </div>
                    );
                  })}
                </div>
                {/* tap parmağı */}
                {frame > highlightAt && (
                  <div style={{ position: 'absolute', right: 120, bottom: 250, fontSize: 76, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.7))', transform: `scale(${tapPulse})` }}>👆</div>
                )}
              </>
            ) : (
              /* ana ekran — ikon pop */
              <AbsoluteFill style={{ background: 'radial-gradient(ellipse at top, #12304a, #05101c)', padding: 46 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 30, marginTop: 40 }}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} style={{ width: '100%', aspectRatio: '1', borderRadius: 22, background: 'rgba(255,255,255,0.08)' }} />
                  ))}
                  <div style={{ transform: `scale(${iconPop})` }}><AppIcon size={128} /></div>
                </div>
                <div style={{ position: 'absolute', bottom: 60, left: 0, right: 0, textAlign: 'center', fontFamily: FONT_BODY, fontWeight: 700, fontSize: 30, color: C.green, opacity: iconPop }}>
                  ✓ {en ? 'Added to home screen' : 'Ana ekranına eklendi'}
                </div>
              </AbsoluteFill>
            )}
          </div>
        </div>
      </AbsoluteFill>
      {/* alt caption: iOS + Android */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 120 }}>
        <div style={{
          fontFamily: FONT_BODY, fontWeight: 600, fontSize: 27, color: C.white, textAlign: 'center',
          background: 'rgba(2,5,16,0.6)', padding: '14px 30px', borderRadius: 20, maxWidth: 900,
          border: '1px solid rgba(255,255,255,0.12)',
        }}>{sub}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// CTA outro
// ---------------------------------------------------------------------------
const CtaScene: React.FC<{ headline: string; sub: string }> = ({ headline, sub }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = spring({ frame, fps, config: { damping: 18, stiffness: 80 } });
  const scale = interpolate(o, [0, 1], [0.85, 1]);
  const pulse = 1 + 0.04 * Math.sin(frame / 6);
  return (
    <AbsoluteFill>
      <Bg /><Stars />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ opacity: o, transform: `scale(${scale})`, textAlign: 'center', padding: '0 60px' }}>
          <AppIcon size={170} />
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: 88, color: C.white, letterSpacing: -2.5, textTransform: 'lowercase', marginTop: 34 }}>
            kalkaninfo<span style={{ color: C.gold }}>.com</span>
          </div>
          <div style={{ width: 80, height: 4, background: C.sea, margin: '26px auto 30px', borderRadius: 2 }} />
          <div style={{
            display: 'inline-block', transform: `scale(${pulse})`, background: `linear-gradient(135deg, ${C.sea}, #2b7fd1)`,
            color: C.white, padding: '26px 60px', borderRadius: 999, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 38,
            boxShadow: `0 16px 50px ${C.sea}66`,
          }}>📍 {sub}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Ana composition
// ---------------------------------------------------------------------------
export const WebappPromo: React.FC<WebappPromoProps> = ({ scenes, music, base }) => {
  BASE = base || BASE;
  const tilts = [-1.5, 1.2, -1, 1.5, -1.2];
  let cursor = 0;
  const total = scenes.reduce((n, s) => n + s.frames, 0);
  let screenIdx = 0;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {/* müzik bed — tüm video, düşük ses */}
      <Audio src={asset(music)} volume={0.14} loop />
      {scenes.map((s) => {
        const from = cursor; cursor += s.frames;
        const tilt = s.type === 'screen' ? tilts[(screenIdx++) % tilts.length] : 0;
        return (
          <Sequence key={s.key} from={from} durationInFrames={s.frames}>
            {s.type === 'cinematic' && <Cinematic photos={s.photos} headline={s.headline} sub={s.sub} duration={s.frames} />}
            {s.type === 'screen' && s.screen && <ScreenScene src={s.screen} label={s.label} headline={s.headline} sub={s.sub} duration={s.frames} tiltDeg={tilt} />}
            {s.type === 'install' && <InstallScene en={s.label === 'How to Install'} label={s.label === 'How to Install' ? 'Add to Home Screen' : (s.label === 'Nasıl Yüklenir?' ? 'Ana Ekrana Ekle' : s.label)} headline={s.headline} sub={s.sub} duration={s.frames} />}
            {s.type === 'cta' && <CtaScene headline={s.headline} sub={s.sub} />}
            {s.audio && <Audio src={asset(s.audio)} volume={1} />}
          </Sequence>
        );
      })}
      {/* güvenlik: total kullanılmıyorsa da açıkça referans */}
      {total < 0 && <AbsoluteFill />}
    </AbsoluteFill>
  );
};
