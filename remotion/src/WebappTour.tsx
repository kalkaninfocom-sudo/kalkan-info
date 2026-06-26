import React from 'react';
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence, Img,
} from 'remotion';
import { z } from 'zod';

const C = { bg: '#020510', sea: '#4A9EF5', gold: '#E8A020', white: '#FFFFFF', green: '#4ADE80', deep: '#051028' };
const FONT_DISPLAY = 'Orbitron, sans-serif';
const FONT_BODY = 'Inter, sans-serif';

export const webappTourSchema = z.object({
  screens: z.object({
    home:        z.string(),
    restoranlar: z.string(),
    villalar:    z.string(),
    plajlar:     z.string(),
    antik:       z.string(),
    hizmetler:   z.string(),
    ilanlar:     z.string(),
    tatil:       z.string(),
  }),
});

export type WebappTourProps = z.infer<typeof webappTourSchema>;

const STORAGE_BASE = 'https://dgichfealzdpfhdgryym.supabase.co/storage/v1/object/public/social-media/site-tour/screens';

export const defaultWebappTourProps: WebappTourProps = {
  screens: {
    home:        `${STORAGE_BASE}/home.png`,
    restoranlar: `${STORAGE_BASE}/restoranlar.png`,
    villalar:    `${STORAGE_BASE}/villalar.png`,
    plajlar:     `${STORAGE_BASE}/plajlar.png`,
    antik:       `${STORAGE_BASE}/antik.png`,
    hizmetler:   `${STORAGE_BASE}/hizmetler.png`,
    ilanlar:     `${STORAGE_BASE}/ilanlar.png`,
    tatil:       `${STORAGE_BASE}/tatil.png`,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const Bg: React.FC = () => (
  <AbsoluteFill style={{
    background: `radial-gradient(ellipse at top, ${C.deep} 0%, #021024 55%, ${C.bg} 100%)`,
  }} />
);

const Stars: React.FC = () => {
  const frame = useCurrentFrame();
  const stars = React.useMemo(() => Array.from({ length: 50 }, (_, i) => ({
    x: (i * 37) % 1080,
    y: (i * 113) % 1920,
    size: 1 + (i % 4),
    twinkleOffset: i * 7,
  })), []);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {stars.map((s, i) => {
        const op = 0.3 + 0.5 * Math.abs(Math.sin((frame + s.twinkleOffset) / 30));
        return <div key={i} style={{
          position: 'absolute', left: s.x, top: s.y, width: s.size, height: s.size,
          background: C.white, opacity: op, borderRadius: '50%',
          boxShadow: `0 0 ${s.size * 2}px ${C.white}`,
        }} />;
      })}
    </AbsoluteFill>
  );
};

// Phone frame with INTERIOR SCROLLING — looks like user thumb-scrolling the page.
const PhoneFrame: React.FC<{ src: string; from: number; duration: number; tiltDeg?: number }> = ({
  src, from, duration, tiltDeg = -3,
}) => {
  const frame = useCurrentFrame() - from;
  const { fps } = useVideoConfig();
  if (frame < -10 || frame > duration + 10) return null;

  // Yavaş scroll: image translates up — gerçek başparmak scroll'unu taklit eder.
  // Image fullPage screenshot, phone ~1500px yükseklik gösteriyor.
  // v2: 1.5x daha uzun pencere — daha sakin tempo
  const scrollProgress = interpolate(
    frame, [27, duration - 18], [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  // v2: %22 scroll — biraz daha az, daha yavaş hissedilsin
  const scrollPct = scrollProgress * 22;

  // Entrance pop-in (v2: biraz daha uzun)
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 90 } });
  const enterOpacity = interpolate(frame, [0, 21], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const exitOpacity  = interpolate(frame, [duration - 21, duration], [1, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const opacity = Math.min(enterOpacity, exitOpacity);

  // Phone dims
  const phoneW = 820;
  const phoneH = 1620;
  const radius = 70;

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity }}>
      {/* 3D perspective wrapper */}
      <div style={{ perspective: 1800 }}>
        <div style={{
          width: phoneW, height: phoneH, borderRadius: radius,
          background: '#0a1428',
          padding: 14,
          boxShadow: `0 36px 100px rgba(74,158,245,0.45), 0 12px 36px rgba(0,0,0,0.78), inset 0 0 0 2px rgba(255,255,255,0.07)`,
          transform: `scale(${enter}) translateY(${(1 - enter) * 80}px) rotateY(${tiltDeg}deg) rotateX(1deg)`,
          transformStyle: 'preserve-3d',
          transformOrigin: 'center center',
          position: 'relative',
        }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: radius - 14, overflow: 'hidden',
            background: '#000', position: 'relative',
          }}>
            <Img
              src={src}
              style={{
                width: '100%', height: 'auto', display: 'block',
                objectFit: 'cover', objectPosition: 'top',
                transform: `translateY(-${scrollPct}%)`,
                willChange: 'transform',
              }}
            />
            {/* Glare */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 45%)',
              pointerEvents: 'none',
            }} />
            {/* Scroll bar hint on the right */}
            <div style={{
              position: 'absolute', top: '4%', right: 6,
              width: 5, height: 80, borderRadius: 4,
              background: 'rgba(255,255,255,0.35)',
              transform: `translateY(${scrollProgress * 1200}px)`,
              boxShadow: '0 0 4px rgba(255,255,255,0.4)',
            }} />
          </div>
          {/* Notch */}
          <div style={{
            position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)',
            width: 200, height: 36, background: '#0a1428', borderRadius: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            paddingRight: 14, gap: 6,
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#222' }} />
            <div style={{ width: 16, height: 4, borderRadius: 2, background: '#222' }} />
          </div>
          {/* Home indicator */}
          <div style={{
            position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
            width: 220, height: 6, background: 'rgba(255,255,255,0.4)', borderRadius: 3,
          }} />
        </div>
      </div>

      {/* Floor glow */}
      <div style={{
        position: 'absolute', bottom: 60, width: 720, height: 70,
        background: `radial-gradient(ellipse, ${C.sea}66 0%, transparent 70%)`,
        filter: 'blur(28px)',
      }} />

      {/* Thumb indicator (suggests user scrolling) */}
      <ThumbHint scrollProgress={scrollProgress} />
    </AbsoluteFill>
  );
};

const ThumbHint: React.FC<{ scrollProgress: number }> = ({ scrollProgress }) => {
  const frame = useCurrentFrame();
  const visible = scrollProgress > 0.05 && scrollProgress < 0.95;
  const o = visible ? 0.55 : 0;
  const bob = Math.sin(frame / 8) * 6;
  return (
    <div style={{
      position: 'absolute', right: 100, top: '54%', opacity: o,
      transform: `translateY(${bob}px)`, pointerEvents: 'none',
      fontSize: 64, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.6))',
    }}>👆</div>
  );
};

const TopLabel: React.FC<{ text: string; from: number; color?: string }> = ({ text, from, color = C.gold }) => {
  const frame = useCurrentFrame() - from;
  const { fps } = useVideoConfig();
  if (frame < -10) return null;
  const o = spring({ frame, fps, config: { damping: 14, stiffness: 110 } });
  const y = interpolate(o, [0, 1], [-20, 0]);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: 70, opacity: o }}>
      <div style={{
        fontFamily: FONT_BODY, fontWeight: 700, fontSize: 30, color,
        letterSpacing: 6, textTransform: 'uppercase', textAlign: 'center',
        transform: `translateY(${y}px)`,
        textShadow: '0 4px 20px rgba(0,0,0,0.8)',
        background: 'rgba(2,5,16,0.55)', padding: '10px 28px', borderRadius: 999,
        border: `1px solid ${color}55`,
        backdropFilter: 'blur(10px)',
      }}>{text}</div>
    </AbsoluteFill>
  );
};

const BottomTitle: React.FC<{ headline: string; sub?: string; from: number }> = ({ headline, sub, from }) => {
  const frame = useCurrentFrame() - from;
  const { fps } = useVideoConfig();
  if (frame < -10) return null;
  const o = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const y = interpolate(o, [0, 1], [40, 0]);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 110, opacity: o }}>
      <div style={{
        transform: `translateY(${y}px)`,
        textAlign: 'center', padding: '0 60px', maxWidth: 1000,
      }}>
        <div style={{
          fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: 76, color: C.white,
          letterSpacing: -2, lineHeight: 1.05, textTransform: 'uppercase',
          textShadow: '0 8px 32px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.8)',
        }}>{headline}</div>
        {sub && <div style={{
          marginTop: 16, fontFamily: FONT_BODY, fontWeight: 500, fontSize: 30, color: C.sea,
          letterSpacing: 0.5, textShadow: '0 4px 14px rgba(0,0,0,0.9)',
        }}>{sub}</div>}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = spring({ frame, fps, config: { damping: 18, stiffness: 80 } });
  const scale = interpolate(o, [0, 1], [0.7, 1]);
  // v2: 1.5x yavaşlatılmış intro animasyonları
  const lineW = interpolate(frame, [27, 75], [0, 280], { extrapolateRight: 'clamp' });
  const taglineO = interpolate(frame, [45, 90], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <Bg />
      <Stars />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ opacity: o, transform: `scale(${scale})`, textAlign: 'center' }}>
          <div style={{
            fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: 126, color: C.white,
            letterSpacing: -3, lineHeight: 1, textTransform: 'uppercase',
          }}>KALKAN<span style={{ color: C.gold }}>INFO</span></div>
          <div style={{
            margin: '32px auto 0', width: lineW, height: 4,
            background: `linear-gradient(90deg, ${C.gold}, ${C.sea})`, borderRadius: 2,
          }} />
          <div style={{
            marginTop: 32, opacity: taglineO,
            fontFamily: FONT_BODY, fontWeight: 600, fontSize: 38, color: C.sea,
            letterSpacing: 4, textTransform: 'uppercase',
          }}>Yerel Rehberin</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

type PageSceneProps = {
  src: string; label: string; headline: string; sub?: string;
  duration: number; tiltDeg?: number;
};

const PageScene: React.FC<PageSceneProps> = ({ src, label, headline, sub, duration, tiltDeg }) => (
  <AbsoluteFill>
    <Bg />
    <Stars />
    <PhoneFrame src={src} from={0} duration={duration} tiltDeg={tiltDeg} />
    <TopLabel text={label} from={6} />
    <BottomTitle headline={headline} sub={sub} from={20} />
  </AbsoluteFill>
);

const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = spring({ frame, fps, config: { damping: 18, stiffness: 80 } });
  const scale = interpolate(o, [0, 1], [0.85, 1]);
  const pulse = 1 + 0.04 * Math.sin(frame / 6);
  return (
    <AbsoluteFill>
      <Bg />
      <Stars />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ opacity: o, transform: `scale(${scale})`, textAlign: 'center', padding: '0 60px' }}>
          <div style={{
            fontFamily: FONT_BODY, fontWeight: 600, fontSize: 36, color: C.white,
            letterSpacing: 3, textTransform: 'uppercase', marginBottom: 28,
            opacity: 0.85,
          }}>Tek site, hepsi</div>
          <div style={{
            fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: 96, color: C.white,
            letterSpacing: -2.5, textTransform: 'uppercase',
          }}>kalkaninfo<span style={{ color: C.gold }}>.com</span></div>
          <div style={{ width: 80, height: 4, background: C.sea, margin: '32px auto 36px', borderRadius: 2 }} />
          <div style={{
            display: 'inline-block', transform: `scale(${pulse})`,
            background: `linear-gradient(135deg, ${C.sea}, #2b7fd1)`, color: C.white,
            padding: '28px 64px', borderRadius: 999, fontFamily: FONT_BODY,
            fontWeight: 800, fontSize: 40, letterSpacing: 1,
            boxShadow: `0 16px 50px ${C.sea}66`,
          }}>📍 kalkaninfo.com</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Main composition v2 — 1842 frames @ 30fps = 61.4s (was 1230f / 41s; 1.5x slower)
// Berkay feedback: "daha yavaş olsun" — her sahne %50 daha uzun
// ---------------------------------------------------------------------------

export const WebappTourReels: React.FC<WebappTourProps> = ({ screens }) => {
  // v2 timeline (1.5x):
  // 0-112       intro          (3.75s, was 2.5s)
  // 112-315     restoranlar    (6.75s, 203f, was 4.5s/135f)
  // 315-518     villalar       (6.75s)
  // 518-721     plajlar        (6.75s)
  // 721-924     antik          (6.75s)
  // 924-1127    hizmetler      (6.75s)
  // 1127-1330   ilanlar        (6.75s)
  // 1330-1533   tatil          (6.75s)
  // 1533-1736   home           (6.75s)
  // 1736-1848   outro          (3.75s)
  // Total: 1848 frames = 61.6s

  const sceneDur = 203;
  const introDur = 112;
  const outroDur = 112;
  const tilts = [-1.5, 1, -1, 1.5, -1.5, 1, -1, 1.5];

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Sequence from={0} durationInFrames={introDur}><IntroScene /></Sequence>

      <Sequence from={introDur} durationInFrames={sceneDur}>
        <PageScene src={screens.restoranlar} label="Restoranlar" headline="27 Restoran" sub="Gerçek puanlar. Sahte yorum yok." duration={sceneDur} tiltDeg={tilts[0]} />
      </Sequence>

      <Sequence from={introDur + sceneDur} durationInFrames={sceneDur}>
        <PageScene src={screens.villalar} label="Villalar" headline="Deniz Manzaralı" sub="Üzümlü'den Patara'ya 16 villa" duration={sceneDur} tiltDeg={tilts[1]} />
      </Sequence>

      <Sequence from={introDur + sceneDur * 2} durationInFrames={sceneDur}>
        <PageScene src={screens.plajlar} label="Plajlar" headline="Gizli Koylar" sub="Deniz suyu sıcaklığı, anlık güncel" duration={sceneDur} tiltDeg={tilts[2]} />
      </Sequence>

      <Sequence from={introDur + sceneDur * 3} durationInFrames={sceneDur}>
        <PageScene src={screens.antik} label="Antik Kentler" headline="10 Antik Kent" sub="Sesli rehberle Likya hikayeleri" duration={sceneDur} tiltDeg={tilts[3]} />
      </Sequence>

      <Sequence from={introDur + sceneDur * 4} durationInFrames={sceneDur}>
        <PageScene src={screens.hizmetler} label="Yerel Hizmetler" headline="Hepsi El Altında" sub="Temizlik, masaj, market, transfer" duration={sceneDur} tiltDeg={tilts[4]} />
      </Sequence>

      <Sequence from={introDur + sceneDur * 5} durationInFrames={sceneDur}>
        <PageScene src={screens.ilanlar} label="İş İlanları" headline="Yerel İşler" sub="Sezonluk, tam zamanlı, serbest" duration={sceneDur} tiltDeg={tilts[5]} />
      </Sequence>

      <Sequence from={introDur + sceneDur * 6} durationInFrames={sceneDur}>
        <PageScene src={screens.tatil} label="Tatil Planlayıcı" headline="AI Asistan" sub="Gün gün tatil, 1 dakikada" duration={sceneDur} tiltDeg={tilts[6]} />
      </Sequence>

      <Sequence from={introDur + sceneDur * 7} durationInFrames={sceneDur}>
        <PageScene src={screens.home} label="Hepsi Bir Yerde" headline="Kalkan Rehberi" sub="Yerel insanlardan, gerçek tavsiyeler" duration={sceneDur} tiltDeg={tilts[7]} />
      </Sequence>

      <Sequence from={introDur + sceneDur * 8} durationInFrames={outroDur}><OutroScene /></Sequence>
    </AbsoluteFill>
  );
};
