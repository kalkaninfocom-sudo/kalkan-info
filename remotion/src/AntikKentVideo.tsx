import React from 'react';
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring,
  OffthreadVideo, Sequence, Easing,
} from 'remotion';
import { z } from 'zod';

const C = {
  bg: '#020510',
  sea: '#4A9EF5',
  gold: '#E8A020',
  white: '#FFFFFF',
};
const FONT_DISPLAY = 'Orbitron, sans-serif';
const FONT_BODY = 'Inter, sans-serif';

export const antikKentVideoSchema = z.object({
  name: z.string(),
  tagline: z.string(),
  era: z.string(),
  highlights: z.array(z.string()).min(3).max(5),
  closingLine: z.string(),
  ctaText: z.string(),
  domain: z.string(),
  clips: z.array(z.object({
    public_url: z.string(),
    photographer: z.string().optional(),
  })).min(3),
  hashtags: z.array(z.string()),
});

export type AntikKentVideoProps = z.infer<typeof antikKentVideoSchema>;

export const defaultAntikKentVideoProps: AntikKentVideoProps = {
  name: 'PATARA',
  tagline: 'Where Democracy Was Born',
  era: '2,200 years ago',
  highlights: [
    "World's first democratic parliament",
    'Birthplace of Saint Nicholas',
    'Capital of the Lycian League',
    "Turkey's longest untouched beach",
  ],
  closingLine: 'One ticket. Two ancient wonders.',
  ctaText: 'Save this for your Kalkan trip',
  domain: 'kalkaninfo.com',
  clips: [
    { public_url: 'https://dgichfealzdpfhdgryym.supabase.co/storage/v1/object/public/social-media/patara/drone/clip-01.mp4', photographer: 'Pexels' },
    { public_url: 'https://dgichfealzdpfhdgryym.supabase.co/storage/v1/object/public/social-media/patara/drone/clip-02.mp4', photographer: 'Pexels' },
    { public_url: 'https://dgichfealzdpfhdgryym.supabase.co/storage/v1/object/public/social-media/patara/drone/clip-03.mp4', photographer: 'Pexels' },
  ],
  hashtags: ['#kalkan', '#patara', '#lycia', '#unesco', '#turkeytravel'],
};

// ─── Drone scene with cinematic overlay ─────────────────────────────────────
const DroneScene: React.FC<{ src: string; from: number; duration: number; startOffset?: number }> = ({ src, from, duration, startOffset = 0 }) => {
  const frame = useCurrentFrame() - from;
  if (frame < 0 || frame > duration) return null;
  const opacity = interpolate(frame, [0, 12, duration - 12, duration], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ opacity, overflow: 'hidden' }}>
      <OffthreadVideo
        src={src}
        startFrom={startOffset}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        muted
      />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(2,5,16,0.50) 0%, rgba(2,5,16,0.12) 35%, rgba(2,5,16,0.55) 75%, rgba(2,5,16,0.95) 100%)' }} />
    </AbsoluteFill>
  );
};

// ─── Animated text ──────────────────────────────────────────────────────────
const AnimatedText: React.FC<{
  text: string; from: number; size?: number; weight?: number; color?: string;
  font?: string; letterSpacing?: number; top?: string; uppercase?: boolean;
}> = ({
  text, from, size = 90, weight = 900, color = C.white, font = FONT_DISPLAY,
  letterSpacing = -2, top = '50%', uppercase = true,
}) => {
  const frame = useCurrentFrame() - from;
  const { fps } = useVideoConfig();
  if (frame < -10) return null;
  const o = spring({ frame, fps, config: { damping: 14, stiffness: 100, mass: 0.5 } });
  const y = interpolate(o, [0, 1], [40, 0]);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: top, opacity: o }}>
      <div style={{
        fontFamily: font, fontWeight: weight, fontSize: size, color,
        letterSpacing, textTransform: uppercase ? 'uppercase' as const : 'none',
        textAlign: 'center', lineHeight: 1.05, padding: '0 60px',
        transform: `translateY(${y}px)`,
        textShadow: '0 4px 30px rgba(0,0,0,0.7)',
      }}>{text}</div>
    </AbsoluteFill>
  );
};

const BrandPill: React.FC<{ domain: string; from: number }> = ({ domain, from }) => {
  const frame = useCurrentFrame() - from;
  const { fps } = useVideoConfig();
  const o = frame < 0 ? 0 : spring({ frame, fps, config: { damping: 20 } });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 140, opacity: o }}>
      <div style={{
        background: 'rgba(255,255,255,0.92)', color: C.bg, padding: '14px 32px',
        borderRadius: 999, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 28,
        letterSpacing: 1, backdropFilter: 'blur(8px)',
      }}>📍 {domain}</div>
    </AbsoluteFill>
  );
};

const HighlightBullets: React.FC<{ items: string[]; from: number }> = ({ items, from }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ alignItems: 'flex-start', justifyContent: 'center', padding: '0 80px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
        {items.map((item, i) => {
          const frame = useCurrentFrame() - from - i * 12;
          const o = frame < 0 ? 0 : spring({ frame, fps, config: { damping: 16, stiffness: 90 } });
          const x = interpolate(o, [0, 1], [-50, 0]);
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 24, opacity: o,
              transform: `translateX(${x}px)`,
            }}>
              <div style={{ width: 14, height: 14, background: C.gold, borderRadius: '50%', marginTop: 18, flexShrink: 0, boxShadow: `0 0 24px ${C.gold}` }} />
              <div style={{
                fontFamily: FONT_BODY, fontWeight: 700, fontSize: 46, color: C.white,
                lineHeight: 1.22, textShadow: '0 2px 22px rgba(0,0,0,0.85)',
              }}>{item}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const OutroCard: React.FC<{ props: AntikKentVideoProps; from: number }> = ({ props, from }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame() - from;
  const o = frame < 0 ? 0 : spring({ frame, fps, config: { damping: 18, stiffness: 80 } });
  const scale = interpolate(o, [0, 1], [0.85, 1]);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg, ${C.bg} 0%, #051028 100%)`, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ opacity: o, transform: `scale(${scale})`, textAlign: 'center', padding: '0 60px' }}>
        <div style={{
          fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 52, color: C.gold,
          letterSpacing: -1, marginBottom: 24, textTransform: 'uppercase',
        }}>{props.closingLine}</div>
        <div style={{ width: 80, height: 4, background: C.sea, margin: '0 auto 48px', borderRadius: 2 }} />
        <div style={{
          fontFamily: FONT_BODY, fontWeight: 500, fontSize: 36, color: C.white,
          marginBottom: 60, opacity: 0.85,
        }}>{props.ctaText}</div>
        <div style={{
          background: `linear-gradient(135deg, ${C.sea}, #2b7fd1)`, color: C.white,
          padding: '24px 48px', borderRadius: 999, fontFamily: FONT_BODY,
          fontWeight: 800, fontSize: 38, letterSpacing: 0.5,
          boxShadow: `0 12px 40px ${C.sea}55`,
          display: 'inline-block',
        }}>📍 {props.domain}</div>
        <div style={{
          marginTop: 72, fontFamily: FONT_BODY, fontWeight: 500, fontSize: 22,
          color: C.white, opacity: 0.55, letterSpacing: 1,
        }}>{props.hashtags.slice(0, 5).join(' ')}</div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Main composition ───────────────────────────────────────────────────────
export const AntikKentVideoReels: React.FC<AntikKentVideoProps> = (props) => {
  const clips = props.clips;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {/* Scene 1: Intro 0-180 frames (6s) — drone clip 1 */}
      <Sequence from={0} durationInFrames={180}>
        <DroneScene src={clips[0].public_url} from={0} duration={180} />
        <AnimatedText text={props.name} from={20} size={150} weight={900} color={C.white} top="40%" letterSpacing={-4} />
        <AnimatedText text={props.tagline} from={50} size={50} weight={600} color={C.gold} font={FONT_BODY} top="58%" letterSpacing={1} uppercase={false} />
        <AnimatedText text={props.era} from={90} size={28} weight={500} color={C.white} font={FONT_BODY} top="68%" letterSpacing={3} uppercase={true} />
        <BrandPill domain={props.domain} from={130} />
      </Sequence>

      {/* Scene 2: Highlights 180-450 frames (9s) — drone clip 2 */}
      <Sequence from={180} durationInFrames={270}>
        <DroneScene src={clips[1 % clips.length].public_url} from={0} duration={270} />
        <HighlightBullets items={props.highlights} from={20} />
      </Sequence>

      {/* Scene 3: Visual hook 450-630 frames (6s) — drone clip 3 */}
      <Sequence from={450} durationInFrames={180}>
        <DroneScene src={clips[2 % clips.length].public_url} from={0} duration={180} />
        <AnimatedText text={props.tagline} from={20} size={74} weight={800} color={C.white} top="40%" letterSpacing={-1} uppercase={false} />
      </Sequence>

      {/* Scene 4: Outro 630-900 frames (9s) */}
      <Sequence from={630} durationInFrames={270}>
        <OutroCard props={props} from={0} />
      </Sequence>
    </AbsoluteFill>
  );
};
