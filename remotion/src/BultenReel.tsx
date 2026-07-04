import React from 'react';
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence,
} from 'remotion';
import { z } from 'zod';

/**
 * BultenReel — "Haftanın Bülteni" (Pazar). Haftanın gazete editöryallerinden derlenen özet reel.
 * GazeteReel kardeşi (aynı marka; foto yok, tipografi+kart odaklı → CI'da hafif/güvenilir).
 * İçerik build-bulten-reel.mjs'ten props ile gelir (data/gazete-archive/*.json → top haberler + magazin).
 * 1080x1920, 30fps, 900 frame (30sn). Sahneler: Intro → Öne çıkan haberler → Magazin → Outro.
 */

const C = {
  navy: '#072136', navy2: '#0a2e4c', navy3: '#0d3a5f',
  gold: '#f4b53d', gold2: '#e8a020', cream: '#f8f4ea', white: '#ffffff', muted: '#b9cbe0',
};
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";
const SANS = "'Montserrat', 'Inter', system-ui, sans-serif";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

const itemSchema = z.object({
  label: z.string().optional(),
  title: z.string(),
  summary: z.string().optional(),
});

export const bultenReelSchema = z.object({
  kicker: z.string().optional(),        // "KALKAN"
  range_label: z.string().optional(),   // "28 Haziran – 3 Temmuz"
  items: z.array(itemSchema),           // haftanın öne çıkanları (1–4)
  magazine_title: z.string().optional(),
  magazine_summary: z.string().optional(),
  cta: z.string().optional(),
});
export type BultenReelProps = z.infer<typeof bultenReelSchema>;

export const defaultBultenReelProps: BultenReelProps = {
  kicker: 'KALKAN',
  range_label: '28 Haziran – 3 Temmuz',
  items: [
    { label: 'Manşet', title: 'Tatil sezonu zirve yaptı', summary: 'Marina dolulukta rekor, antik kentlere ilgi arttı.' },
    { label: 'Sahil', title: 'Kaputaş’ta güvenli yüzme uyarısı', summary: 'Cankurtaran ekipleri dalgalı havaya karşı uyardı.' },
    { label: 'Gündem', title: 'Kalamar sahiline yeni düzenleme', summary: 'Yaya yolu ve aydınlatma yenilendi.' },
  ],
  magazine_title: 'Hafta sonu Kalkan’da müzik dolu geceler',
  magazine_summary: 'Liman çevresindeki mekânlarda canlı performanslar sürüyor.',
  cta: 'kalkaninfo.com/gazete',
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

// ── Sahne 1: Intro (0–90) ──
const Intro: React.FC<BultenReelProps> = (p) => {
  const { o } = useAppear(6, 14);
  const { o: o2 } = useAppear(26);
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [58, 70], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: fade, padding: 80 }}>
      <div style={{ fontFamily: SANS, fontSize: 30, letterSpacing: 9, color: C.gold, fontWeight: 700, opacity: o, transform: `translateY(${(1 - o) * -20}px)` }}>
        {(p.kicker || 'KALKAN').toUpperCase()}
      </div>
      <div style={{ margin: '18px 0' }}><Rule w={380} o={o} /></div>
      <div style={{
        fontFamily: SERIF, fontSize: 116, fontWeight: 900, color: C.cream, lineHeight: 0.94,
        textAlign: 'center', letterSpacing: -2, opacity: o, transform: `scale(${0.92 + o * 0.08})`,
        textShadow: '0 6px 40px rgba(0,0,0,0.5)',
      }}>
        HAFTANIN<br />BÜLTENİ
      </div>
      <div style={{ margin: '18px 0' }}><Rule w={380} o={o} /></div>
      {p.range_label ? (
        <div style={{ fontFamily: SANS, fontSize: 32, color: C.muted, fontWeight: 500, opacity: o2, letterSpacing: 1 }}>
          {p.range_label}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ── Haber kartı ──
const NewsCard: React.FC<{ item: { label?: string; title: string; summary?: string }; from: number }> = ({ item, from }) => {
  const { o } = useAppear(from, 16);
  return (
    <div style={{
      background: C.navy2, borderLeft: `8px solid ${C.gold}`, borderRadius: 12, padding: '26px 34px',
      width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
      opacity: o, transform: `translateX(${(1 - o) * -50}px)`,
    }}>
      {item.label ? <div style={{ fontFamily: SANS, fontSize: 22, letterSpacing: 3, color: C.gold, fontWeight: 800, marginBottom: 10 }}>{item.label.toUpperCase()}</div> : null}
      <div style={{ fontFamily: SERIF, fontSize: 44, fontWeight: 800, color: C.cream, lineHeight: 1.12 }}>{item.title}</div>
      {item.summary ? <div style={{ fontFamily: SANS, fontSize: 27, fontWeight: 400, color: C.muted, lineHeight: 1.32, marginTop: 10 }}>{item.summary}</div> : null}
    </div>
  );
};

// ── Sahne 2: Öne çıkan haberler (Sequence-göreli 0–450) ──
const Highlights: React.FC<BultenReelProps> = (p) => {
  const frame = useCurrentFrame();
  const { o } = useAppear(6);
  const outFade = interpolate(frame, [344, 360], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const items = p.items.slice(0, 4);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', padding: '0 66px', gap: 30, opacity: outFade }}>
      <div style={{ fontFamily: SANS, fontSize: 30, letterSpacing: 6, color: C.gold, fontWeight: 700, opacity: o, marginBottom: 4 }}>BU HAFTA ÖNE ÇIKANLAR</div>
      {items.map((it, i) => <NewsCard key={i} item={it} from={18 + i * 21} />)}
    </AbsoluteFill>
  );
};

// ── Sahne 3: Magazin (Sequence-göreli 0–240) ──
const Magazine: React.FC<BultenReelProps> = (p) => {
  const frame = useCurrentFrame();
  const { o } = useAppear(6);
  const { o: o2 } = useAppear(24);
  const { o: o3 } = useAppear(32);
  const outFade = interpolate(frame, [176, 192], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (!p.magazine_title) return null;
  return (
    <AbsoluteFill style={{ justifyContent: 'center', padding: '0 74px', opacity: outFade }}>
      <div style={{ fontFamily: SANS, fontSize: 30, letterSpacing: 6, color: C.gold, fontWeight: 700, opacity: o, marginBottom: 20 }}>MAGAZİN · HAFTA SONU</div>
      <div style={{ marginBottom: 26 }}><Rule w={150} o={o} h={5} /></div>
      <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 62, color: C.cream, lineHeight: 1.1, opacity: o2, transform: `translateY(${(1 - o2) * 30}px)`, letterSpacing: -0.5 }}>
        {p.magazine_title}
      </div>
      {p.magazine_summary ? (
        <div style={{ fontFamily: SANS, fontWeight: 400, fontSize: 34, color: C.muted, lineHeight: 1.4, marginTop: 24, opacity: o3, transform: `translateY(${(1 - o3) * 24}px)` }}>
          {p.magazine_summary}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ── Sahne 4: Outro / CTA (Sequence-göreli 0–210) ──
const Outro: React.FC<BultenReelProps> = (p) => {
  const { o } = useAppear(10, 14);
  const { o: o2 } = useAppear(32);
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin(Math.max(0, frame - 32) / 12) * 0.02;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: 80 }}>
      <div style={{ fontFamily: SANS, fontSize: 34, letterSpacing: 4, color: C.muted, fontWeight: 500, opacity: o, textAlign: 'center' }}>
        HAFTANIN ÖZETİ · HER PAZAR
      </div>
      <div style={{ margin: '28px 0' }}><Rule w={300} o={o} /></div>
      <div style={{ fontFamily: SERIF, fontSize: 92, fontWeight: 900, color: C.cream, opacity: o, textAlign: 'center', lineHeight: 1, letterSpacing: -1 }}>
        KALKAN TODAY
      </div>
      <div style={{
        marginTop: 50, background: C.gold, color: C.navy, fontFamily: SANS, fontWeight: 800, fontSize: 38,
        padding: '22px 44px', borderRadius: 12, opacity: o2, transform: `scale(${pulse})`, boxShadow: `0 16px 44px ${C.gold2}66`,
      }}>
        {p.cta || 'kalkaninfo.com/gazete'}
      </div>
    </AbsoluteFill>
  );
};

export const BultenReel: React.FC<BultenReelProps> = (props) => {
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 0%, ${C.navy3} 0%, ${C.navy} 55%, #041423 100%)` }}>
      <AbsoluteFill style={{ backgroundImage: GRAIN, opacity: 0.06, mixBlendMode: 'overlay' }} />
      <Sequence from={0} durationInFrames={72}><Intro {...props} /></Sequence>
      <Sequence from={72} durationInFrames={360}><Highlights {...props} /></Sequence>
      <Sequence from={432} durationInFrames={192}><Magazine {...props} /></Sequence>
      <Sequence from={624} durationInFrames={96}><Outro {...props} /></Sequence>
    </AbsoluteFill>
  );
};
