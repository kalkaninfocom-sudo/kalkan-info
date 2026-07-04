import React from 'react';
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img, Sequence,
} from 'remotion';
import { z } from 'zod';

/**
 * PlajReel — "Haftanın Plajı" tanıtım reel'i (RestoranReel ikizi, Prş slotu).
 * Canlı site CAPTURE ETMEZ → çerez/install banner bug'ı YOK. İçerik data/plajlar.json'dan
 * (build-plaj-reel.mjs seçer) props ile gelir. 1080x1920, 30fps, 900 frame (30sn).
 * Fotolar base64 DATA URI olarak gömülür (cross-origin/file:// bloklarını aşmak için).
 * Marka: Kalkan kurumsal (navy #072136 / altın #f4b53d), serif başlık + sans gövde.
 */

const C = {
  navy: '#072136', navy2: '#0a2e4c', navy3: '#0d3a5f',
  gold: '#f4b53d', gold2: '#e8a020', cream: '#f8f4ea', white: '#ffffff', muted: '#b9cbe0',
};
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";
const SANS = "'Montserrat', 'Inter', system-ui, sans-serif";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

export const plajReelSchema = z.object({
  kicker: z.string().optional(),          // "KALKAN SAHİLLERİ"
  name: z.string(),
  category: z.string().optional(),        // "Halk plajı"
  features: z.string().optional(),        // "Turkuaz su · Beyaz çakıl"
  facilities: z.string().optional(),      // "WC · Duş · Şezlong"
  fee: z.string().optional(),             // "Ücretsiz" / "Ücretli"
  best: z.string().optional(),            // "Mayıs–Ekim"
  distance: z.string().optional(),        // "7 km — Kalkan merkez"
  rating: z.number().optional(),
  tagline: z.string().optional(),         // editöryal satır
  photos: z.array(z.string()),            // tam URL (data:// veya https://)
  cta: z.string().optional(),             // kalkaninfo.com/...
});
export type PlajReelProps = z.infer<typeof plajReelSchema>;

export const defaultPlajReelProps: PlajReelProps = {
  kicker: 'KALKAN SAHİLLERİ',
  name: 'Kaputaş Plajı',
  category: 'Halk plajı',
  features: 'Turkuaz su · Beyaz çakıl',
  facilities: 'WC · Duş · Şezlong',
  fee: 'Ücretsiz',
  best: 'Mayıs–Ekim',
  distance: '7 km — Kalkan merkez',
  rating: 4.8,
  tagline: 'D400 yolunun altındaki dünyaca ünlü turkuaz koy, 187 basamak aşağıda sizi bekliyor.',
  photos: [],
  cta: 'kalkaninfo.com/plajlar.html',
};

const useAppear = (from: number, damping = 16) => {
  const frame = useCurrentFrame() - from;
  const { fps } = useVideoConfig();
  const o = spring({ frame, fps, config: { damping, stiffness: 110, mass: 0.6 } });
  return { o, frame };
};

const Rule: React.FC<{ w: number; o: number; h?: number }> = ({ w, o, h = 4 }) => (
  <div style={{ width: w * o, height: h, background: C.gold, borderRadius: 2, boxShadow: `0 2px 14px ${C.gold2}55` }} />
);

const Stars: React.FC<{ rating?: number; o: number }> = ({ rating, o }) => {
  if (!rating) return null;
  const full = Math.round(rating);
  return (
    <div style={{ fontFamily: SANS, fontSize: 40, color: C.gold, opacity: o, letterSpacing: 2 }}>
      {'★'.repeat(Math.min(5, full))}{'☆'.repeat(Math.max(0, 5 - full))}
    </div>
  );
};

// Blurlu 'cover' dolgu + net 'contain' ön plan (yatay foto 9:16'da kesilmez).
const Photo: React.FC<{ src: string; kb: number; kbC: number; fade: number }> = ({ src, kb, kbC, fade }) => (
  <AbsoluteFill style={{ opacity: fade }}>
    <Img src={src} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${kb})` }} />
  </AbsoluteFill>
);

// ── Sahne 1: Intro / masthead (0–75) ──
const Intro: React.FC<PlajReelProps> = (p) => {
  const { o } = useAppear(6, 14);
  const { o: o2 } = useAppear(24);
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [58, 74], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: fade, padding: 80 }}>
      <div style={{ fontFamily: SANS, fontSize: 28, letterSpacing: 7, color: C.gold, fontWeight: 700, opacity: o, transform: `translateY(${(1 - o) * -20}px)` }}>
        {(p.kicker || 'KALKAN SAHİLLERİ').toUpperCase()}
      </div>
      <div style={{ margin: '18px 0' }}><Rule w={360} o={o} /></div>
      <div style={{
        fontFamily: SERIF, fontSize: 118, fontWeight: 900, color: C.cream, lineHeight: 0.95,
        textAlign: 'center', letterSpacing: -2, opacity: o, transform: `scale(${0.92 + o * 0.08})`,
        textShadow: '0 6px 40px rgba(0,0,0,0.5)',
      }}>
        HAFTANIN<br />PLAJI
      </div>
      <div style={{ margin: '18px 0' }}><Rule w={360} o={o} /></div>
      <div style={{ fontFamily: SANS, fontSize: 30, color: C.muted, fontWeight: 500, opacity: o2, letterSpacing: 2 }}>
        kalkaninfo.com · Plaj Rehberi
      </div>
    </AbsoluteFill>
  );
};

// ── Sahne 2: Hero (Sequence-göreli 0–255) — ana foto + isim/kategori/puan ──
const Hero: React.FC<PlajReelProps> = (p) => {
  const frame = useCurrentFrame();
  const { o } = useAppear(14, 18);
  const { o: oMeta } = useAppear(30);
  const kb = interpolate(frame, [0, 255], [1.08, 1.22]);
  const kbC = interpolate(frame, [0, 255], [1.0, 1.06]);
  const imgFade = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });
  const outFade = interpolate(frame, [235, 255], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const hero = p.photos[0] || '';
  return (
    <AbsoluteFill style={{ opacity: outFade }}>
      {hero ? (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <Photo src={hero} kb={kb} kbC={kbC} fade={imgFade} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(4,20,35,0.35) 0%, rgba(4,20,35,0) 30%, rgba(4,20,35,0.15) 55%, rgba(4,20,35,0.75) 82%, #041423 100%)' }} />
        </div>
      ) : null}
      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: '0 70px 140px' }}>
        <div style={{ display: 'inline-block', alignSelf: 'flex-start', background: C.gold, color: C.navy, fontFamily: SANS, fontWeight: 800, fontSize: 24, letterSpacing: 3, padding: '8px 18px', borderRadius: 4, opacity: o, marginBottom: 22 }}>
          {(p.category || 'PLAJ').toUpperCase()}
        </div>
        <div style={{ marginBottom: 20 }}><Rule w={140} o={o} h={5} /></div>
        <div style={{
          fontFamily: SERIF, fontWeight: 900, fontSize: 82, color: C.white, lineHeight: 1.03,
          letterSpacing: -1.5, opacity: o, transform: `translateY(${(1 - o) * 40}px)`, textShadow: '0 6px 40px rgba(0,0,0,0.6)',
        }}>
          {p.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 24, opacity: oMeta }}>
          <Stars rating={p.rating} o={1} />
          {p.rating ? <span style={{ fontFamily: SANS, fontSize: 34, color: C.cream, fontWeight: 700 }}>{p.rating.toFixed(1)}</span> : null}
          {p.distance ? <span style={{ fontFamily: SANS, fontSize: 26, color: C.muted }}>{p.distance}</span> : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Sahne 3: Galeri (Sequence-göreli 0–300) — kalan fotolar, her biri ~100 frame ──
const Gallery: React.FC<PlajReelProps> = (p) => {
  const frame = useCurrentFrame();
  const { o } = useAppear(6);
  const shots = p.photos.slice(1, 4);
  const per = 100;
  const outFade = interpolate(frame, [280, 300], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (shots.length === 0) return null;
  return (
    <AbsoluteFill style={{ opacity: outFade }}>
      {shots.map((ph, i) => {
        const from = i * per;
        const local = frame - from;
        if (local < -6 || local > per + 6) return null;
        const fade = interpolate(local, [0, 12, per - 12, per], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const kb = interpolate(local, [0, per], [1.06, 1.18]);
        return <Photo key={i} src={ph} kb={kb} kbC={interpolate(local, [0, per], [1.0, 1.05])} fade={fade} />;
      })}
      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: '0 70px 150px', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '35%', background: 'linear-gradient(180deg, rgba(4,20,35,0) 0%, rgba(4,20,35,0.75) 100%)' }} />
        <div style={{ fontFamily: SANS, fontSize: 26, letterSpacing: 5, color: C.gold, fontWeight: 800, opacity: o, position: 'relative' }}>KOYDAN</div>
        {p.tagline ? (
          <div style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 52, color: C.cream, lineHeight: 1.18, marginTop: 14, opacity: o, position: 'relative', textShadow: '0 4px 24px rgba(0,0,0,0.7)' }}>
            {p.tagline}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Sahne 4: Bilgi kartı (Sequence-göreli 0–180) — özellik/olanak/ücret/mesafe/sezon ──
const InfoRow: React.FC<{ icon: string; label: string; value?: string; from: number }> = ({ icon, label, value, from }) => {
  const { o } = useAppear(from, 16);
  if (!value) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, opacity: o, transform: `translateX(${(1 - o) * -40}px)` }}>
      <div style={{ fontSize: 44, width: 60, textAlign: 'center' }}>{icon}</div>
      <div>
        <div style={{ fontFamily: SANS, fontSize: 22, letterSpacing: 3, color: C.gold, fontWeight: 800 }}>{label}</div>
        <div style={{ fontFamily: SANS, fontSize: 36, color: C.cream, fontWeight: 600, lineHeight: 1.2 }}>{value}</div>
      </div>
    </div>
  );
};
const Info: React.FC<PlajReelProps> = (p) => {
  const frame = useCurrentFrame();
  const { o } = useAppear(6);
  const outFade = interpolate(frame, [160, 180], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: 'center', padding: '0 80px', gap: 44, opacity: outFade }}>
      <div style={{ fontFamily: SERIF, fontSize: 60, fontWeight: 900, color: C.cream, opacity: o, lineHeight: 1.05, letterSpacing: -1 }}>{p.name}</div>
      <div style={{ marginTop: -20 }}><Rule w={160} o={o} h={5} /></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36, marginTop: 10 }}>
        <InfoRow icon="🏖️" label="ÖNE ÇIKAN" value={p.features} from={20} />
        <InfoRow icon="🚿" label="OLANAKLAR" value={p.facilities} from={32} />
        <InfoRow icon="💰" label="ÜCRET" value={p.fee} from={44} />
        <InfoRow icon="🚗" label="MESAFE" value={p.distance} from={56} />
        <InfoRow icon="📅" label="EN İYİ SEZON" value={p.best} from={68} />
      </div>
    </AbsoluteFill>
  );
};

// ── Sahne 5: Outro / CTA (Sequence-göreli 0–120) ──
const Outro: React.FC<PlajReelProps> = (p) => {
  const { o } = useAppear(8, 14);
  const { o: o2 } = useAppear(28);
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin(Math.max(0, frame - 28) / 12) * 0.02;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: 80 }}>
      <div style={{ fontFamily: SANS, fontSize: 32, letterSpacing: 4, color: C.muted, fontWeight: 500, opacity: o, textAlign: 'center' }}>
        KALKAN'IN PLAJ REHBERİ
      </div>
      <div style={{ margin: '26px 0' }}><Rule w={300} o={o} /></div>
      <div style={{ fontFamily: SERIF, fontSize: 84, fontWeight: 900, color: C.cream, opacity: o, textAlign: 'center', lineHeight: 1, letterSpacing: -1 }}>
        KALKAN INFO
      </div>
      <div style={{
        marginTop: 50, background: C.gold, color: C.navy, fontFamily: SANS, fontWeight: 800, fontSize: 38,
        padding: '22px 44px', borderRadius: 12, opacity: o2, transform: `scale(${pulse})`, boxShadow: `0 16px 44px ${C.gold2}66`,
      }}>
        {p.cta || 'kalkaninfo.com/plajlar.html'}
      </div>
    </AbsoluteFill>
  );
};

export const PlajReel: React.FC<PlajReelProps> = (props) => {
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 0%, ${C.navy3} 0%, ${C.navy} 55%, #041423 100%)` }}>
      <AbsoluteFill style={{ backgroundImage: GRAIN, opacity: 0.06, mixBlendMode: 'overlay' }} />
      <Sequence from={0} durationInFrames={75}><Intro {...props} /></Sequence>
      <Sequence from={75} durationInFrames={255}><Hero {...props} /></Sequence>
      <Sequence from={330} durationInFrames={300}><Gallery {...props} /></Sequence>
      <Sequence from={630} durationInFrames={180}><Info {...props} /></Sequence>
      <Sequence from={810} durationInFrames={90}><Outro {...props} /></Sequence>
    </AbsoluteFill>
  );
};
