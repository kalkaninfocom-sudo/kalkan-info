import React from 'react';
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img, Sequence,
} from 'remotion';
import { z } from 'zod';

/**
 * EtkinlikReel — "Bu Hafta Kalkan'da" etkinlik tanıtım reel'i (kalkaninfo.com/etkinlikler).
 * EMOJİSİZ, hızlı tempolu, gerçek fotoğraf ağırlıklı. Her kart gerçek mekan fotosu (build-etkinlik-reel.mjs
 * kesin eşleşen + parlaklık grade'li fotolar gömer). 1080x1920, 30fps. Marka: navy/altın + tür aksan rengi.
 */

const C = {
  navy: '#072136', navy2: '#0a2e4c', navy3: '#0d3a5f',
  gold: '#f4b53d', gold2: '#e8a020', cream: '#f8f4ea', white: '#ffffff', muted: '#c3d3e6', ink: '#04101d',
};
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";
const SANS = "'Montserrat', 'Inter', system-ui, sans-serif";

// Tür → aksan rengi (emoji YOK). Case/İ-ı duyarsız eşleşme.
const TYPE_COLOR: Record<string, string> = {
  'dj': '#8B5CF6', 'parti': '#F0567A', 'canlı müzik': '#f4b53d', 'akustik': '#f4b53d',
  'türk gecesi': '#E8A020', 'yoga': '#4ADE80', 'sinema gecesi': '#4A9EF5', 'quiz gecesi': '#4A9EF5',
};
const typeColor = (t?: string) => TYPE_COLOR[String(t || '').toLocaleLowerCase('tr')] || C.gold;

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

const eventItem = z.object({
  type: z.string(), venue: z.string(), area: z.string().optional(),
  day: z.string().optional(), time: z.string().optional(), title: z.string().optional(),
  photo: z.string().optional(),
});
export const etkinlikReelSchema = z.object({
  kicker: z.string().optional(), title: z.string().optional(), subtitle: z.string().optional(),
  events: z.array(eventItem), types: z.array(z.string()).optional(), cta: z.string().optional(), aiNote: z.string().optional(),
});
export type EtkinlikReelProps = z.infer<typeof etkinlikReelSchema>;

export const defaultEtkinlikReelProps: EtkinlikReelProps = {
  kicker: "BU HAFTA KALKAN'DA", title: 'ETKİNLİK REHBERİ', subtitle: 'canlı müzik · DJ · yoga · sinema gecesi',
  events: [
    { type: 'DJ', venue: 'Chocolate Club Kalkan', area: 'Kalkan', day: 'Her gün', time: '23:00', title: 'Gece DJ performansı' },
    { type: 'Parti', venue: 'Noema Community', area: 'Kalkan', day: 'Her gün', time: '23:30', title: 'Gece partisi' },
    { type: 'Yoga', venue: 'Indigo Beach Club', area: 'Kalkan', day: 'Salı', time: '07:45', title: 'Deniz kenarında sabah yogası' },
    { type: 'DJ', venue: 'Salt & Pepper', area: 'Kalkan', day: 'Cuma', time: '12:00', title: 'Gündüz havuz partisi' },
    { type: 'Sinema Gecesi', venue: 'Indigo Beach Club', area: 'Kalkan', day: 'Perşembe', time: '21:00', title: 'Açık hava deniz kenarı sinema' },
  ],
  types: ['CANLI MÜZİK', 'DJ', 'YOGA', 'SİNEMA', 'PARTİ', 'TÜRK GECESİ'],
  cta: 'kalkaninfo.com/etkinlikler', aiNote: 'Yapay zeka destekli hazırlandı',
};

const useSpring = (from: number, damping = 14) => {
  const frame = useCurrentFrame() - from;
  const { fps } = useVideoConfig();
  return spring({ frame, fps, config: { damping, stiffness: 130, mass: 0.55 } });
};

const Rule: React.FC<{ w: number; o: number; h?: number; c?: string }> = ({ w, o, h = 4, c = C.gold }) => (
  <div style={{ width: w * o, height: h, background: c, borderRadius: 2, boxShadow: `0 2px 14px ${c}66` }} />
);

// ── Intro (0–50) ──
const Intro: React.FC<EtkinlikReelProps> = (p) => {
  const o = useSpring(2, 13); const o2 = useSpring(14);
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [38, 50], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: fade, padding: 80 }}>
      <div style={{ fontFamily: SANS, fontSize: 28, letterSpacing: 8, color: C.gold, fontWeight: 800, opacity: o, transform: `translateY(${(1 - o) * -22}px)` }}>
        {(p.kicker || "BU HAFTA KALKAN'DA").toUpperCase()}
      </div>
      <div style={{ margin: '20px 0' }}><Rule w={400} o={o} /></div>
      <div style={{ fontFamily: SERIF, fontSize: 116, fontWeight: 900, color: C.cream, lineHeight: 0.93, textAlign: 'center', letterSpacing: -2, opacity: o, transform: `scale(${0.9 + o * 0.1})`, textShadow: '0 6px 40px rgba(0,0,0,0.5)' }}>
        ETKİNLİK<br />REHBERİ
      </div>
      <div style={{ margin: '20px 0' }}><Rule w={400} o={o} /></div>
      <div style={{ fontFamily: SANS, fontSize: 30, color: C.muted, fontWeight: 500, opacity: o2, letterSpacing: 1, textAlign: 'center' }}>
        {p.subtitle || 'canlı müzik · DJ · yoga · sinema'}
      </div>
    </AbsoluteFill>
  );
};

// ── Etkinlik kartı (72f) — full-bleed graded foto + hızlı hareketli metin, EMOJİSİZ ──
const CARD = 72;
const EventCard: React.FC<{ ev: EtkinlikReelProps['events'][number] }> = ({ ev }) => {
  const frame = useCurrentFrame();
  const ac = typeColor(ev.type);
  const o = useSpring(3, 15); const o2 = useSpring(11, 16);
  const fade = interpolate(frame, [0, 8, CARD - 8, CARD], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const kb = interpolate(frame, [0, CARD], [1.1, 1.26]);
  const panX = interpolate(frame, [0, CARD], [-2, 2]); // hafif yatay kaydırma → canlılık
  // Aksan renkli dikey wipe (giriş enerjisi)
  const wipe = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ opacity: fade, background: C.ink }}>
      {ev.photo ? (
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <Img src={ev.photo} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${kb}) translateX(${panX}%)` }} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(4,16,29,0.5) 0%, rgba(4,16,29,0.04) 30%, rgba(4,16,29,0.3) 56%, rgba(4,16,29,0.82) 82%, ${C.ink} 100%)` }} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 60%, ${ac}14 100%)` }} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ background: `radial-gradient(130% 80% at 50% 22%, ${ac}33 0%, ${C.navy2} 48%, ${C.ink} 100%)` }} />
      )}

      {/* aksan wipe barı */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 8, background: ac, transform: `scaleY(${wipe})`, transformOrigin: 'top', boxShadow: `0 0 30px ${ac}` }} />

      {/* üst: gün · saat pill (emojisiz) */}
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-start', padding: '108px 64px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(4,16,29,0.5)', backdropFilter: 'blur(6px)', border: `1.5px solid ${ac}`, borderRadius: 100, padding: '12px 26px', opacity: o2, transform: `translateY(${(1 - o2) * -26}px)` }}>
          <span style={{ fontFamily: SANS, fontSize: 30, fontWeight: 800, color: C.cream, letterSpacing: 1 }}>{ev.day || ''}</span>
          {ev.time ? <span style={{ width: 6, height: 6, borderRadius: 6, background: ac }} /> : null}
          {ev.time ? <span style={{ fontFamily: SANS, fontSize: 30, fontWeight: 800, color: ac }}>{ev.time}</span> : null}
        </div>
      </AbsoluteFill>

      {/* alt: tür rozeti (emojisiz) + mekan + başlık, soldan kayarak */}
      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: '0 64px 140px' }}>
        <div style={{ transform: `translateX(${(1 - o) * -60}px)`, opacity: o }}>
          <div style={{ display: 'inline-block', background: ac, color: C.ink, fontFamily: SANS, fontWeight: 900, fontSize: 27, letterSpacing: 3, padding: '9px 22px', borderRadius: 5, marginBottom: 20, boxShadow: `0 12px 34px ${ac}55` }}>
            {(ev.type || '').toLocaleUpperCase('tr')}
          </div>
          <div style={{ marginBottom: 16 }}><Rule w={130} o={o} h={5} c={ac} /></div>
          <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 82, color: C.white, lineHeight: 1.0, letterSpacing: -1.5, textShadow: '0 6px 40px rgba(0,0,0,0.75)' }}>
            {ev.venue}
          </div>
        </div>
        {ev.title ? (
          <div style={{ fontFamily: SANS, fontSize: 34, color: C.cream, fontWeight: 500, marginTop: 18, opacity: o2, lineHeight: 1.25, textShadow: '0 3px 18px rgba(0,0,0,0.85)' }}>
            {ev.title}{ev.area ? ` · ${ev.area}` : ''}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Tür montajı (60f) — hızlı bold kelime flaşları, EMOJİSİZ ──
const TypeMontage: React.FC<EtkinlikReelProps> = (p) => {
  const frame = useCurrentFrame();
  const o = useSpring(2);
  const types = (p.types && p.types.length ? p.types : ['CANLI MÜZİK', 'DJ', 'YOGA', 'SİNEMA', 'PARTİ']).slice(0, 6);
  const per = 9, start = 3;
  const outFade = interpolate(frame, [50, 60], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', background: `radial-gradient(120% 80% at 50% 32%, ${C.navy3} 0%, ${C.navy} 55%, ${C.ink} 100%)`, opacity: outFade }}>
      <div style={{ fontFamily: SANS, fontSize: 26, letterSpacing: 6, color: C.gold, fontWeight: 800, opacity: o, marginBottom: 20 }}>HER ZEVKE GÖRE</div>
      <div style={{ position: 'relative', height: 220, width: '100%' }}>
        {types.map((t, i) => {
          const local = frame - (start + i * per);
          if (local < -2 || local > per + 4) return null;
          const a = interpolate(local, [0, 3, per - 1, per + 3], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const ac = typeColor(t);
          const x = interpolate(local, [0, per + 3], [40, -40]);
          return (
            <AbsoluteFill key={i} style={{ alignItems: 'center', justifyContent: 'center', opacity: a }}>
              <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 104, color: C.cream, letterSpacing: -1.5, transform: `translateX(${x}px)`, textShadow: `0 8px 44px ${ac}88` }}>{t}</div>
              <div style={{ marginTop: 14, width: 90, height: 6, background: ac, borderRadius: 3, opacity: a }} />
            </AbsoluteFill>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── Outro (80f) ──
const Outro: React.FC<EtkinlikReelProps> = (p) => {
  const o = useSpring(6, 13); const o2 = useSpring(22);
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin(Math.max(0, frame - 22) / 10) * 0.025;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: 80 }}>
      <div style={{ fontFamily: SANS, fontSize: 30, letterSpacing: 4, color: C.muted, fontWeight: 500, opacity: o, textAlign: 'center' }}>TÜM PROGRAM GÜN GÜN</div>
      <div style={{ margin: '22px 0' }}><Rule w={320} o={o} /></div>
      <div style={{ fontFamily: SERIF, fontSize: 92, fontWeight: 900, color: C.cream, opacity: o, textAlign: 'center', lineHeight: 0.98, letterSpacing: -1 }}>KALKAN INFO</div>
      <div style={{ marginTop: 50, background: C.gold, color: C.navy, fontFamily: SANS, fontWeight: 900, fontSize: 40, padding: '24px 46px', borderRadius: 14, opacity: o2, transform: `scale(${pulse})`, boxShadow: `0 16px 44px ${C.gold2}66` }}>
        {p.cta || 'kalkaninfo.com/etkinlikler'}
      </div>
      {p.aiNote ? (
        <div style={{ position: 'absolute', bottom: 52, fontFamily: SANS, fontSize: 20, letterSpacing: 1, color: C.muted, opacity: o2 * 0.85 }}>{p.aiNote}</div>
      ) : null}
    </AbsoluteFill>
  );
};

export const EtkinlikReel: React.FC<EtkinlikReelProps> = (props) => {
  const evs = (props.events || []).slice(0, 5);
  const INTRO = 50, MONT = 60, OUTRO = 80;
  const cardsStart = INTRO;
  const cardsEnd = cardsStart + evs.length * CARD;
  const montStart = cardsEnd;
  const outroStart = montStart + MONT;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 0%, ${C.navy3} 0%, ${C.navy} 55%, ${C.ink} 100%)` }}>
      <AbsoluteFill style={{ backgroundImage: GRAIN, opacity: 0.06, mixBlendMode: 'overlay' }} />
      <Sequence from={0} durationInFrames={INTRO}><Intro {...props} /></Sequence>
      {evs.map((ev, i) => (
        <Sequence key={i} from={cardsStart + i * CARD} durationInFrames={CARD}><EventCard ev={ev} /></Sequence>
      ))}
      <Sequence from={montStart} durationInFrames={MONT}><TypeMontage {...props} /></Sequence>
      <Sequence from={outroStart} durationInFrames={OUTRO}><Outro {...props} /></Sequence>
    </AbsoluteFill>
  );
};
