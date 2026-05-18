import React from 'react';
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring,
  OffthreadVideo, Sequence,
} from 'remotion';
import { z } from 'zod';

const C = { bg: '#020510', sea: '#4A9EF5', gold: '#E8A020', white: '#FFFFFF', green: '#4ADE80' };
const FONT_DISPLAY = 'Orbitron, sans-serif';
const FONT_BODY = 'Inter, sans-serif';

export const siteIntroSchema = z.object({
  clips: z.array(z.object({
    url: z.string(),
    photographer: z.string().optional(),
  })).min(2),
});

export type SiteIntroProps = z.infer<typeof siteIntroSchema>;

export const defaultSiteIntroProps: SiteIntroProps = {
  clips: [
    { url: 'https://dgichfealzdpfhdgryym.supabase.co/storage/v1/object/public/social-media/site-intro/clip-1.mp4' },
    { url: 'https://dgichfealzdpfhdgryym.supabase.co/storage/v1/object/public/social-media/site-intro/clip-2.mp4' },
    { url: 'https://dgichfealzdpfhdgryym.supabase.co/storage/v1/object/public/social-media/site-intro/clip-3.mp4' },
  ],
};

const DroneScene: React.FC<{ src: string; from: number; duration: number }> = ({ src, from, duration }) => {
  const frame = useCurrentFrame() - from;
  if (frame < 0 || frame > duration) return null;
  const opacity = interpolate(frame, [0, 10, duration - 10, duration], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ opacity, overflow: 'hidden' }}>
      <OffthreadVideo src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(2,5,16,0.50) 0%, rgba(2,5,16,0.12) 35%, rgba(2,5,16,0.55) 75%, rgba(2,5,16,0.95) 100%)' }} />
    </AbsoluteFill>
  );
};

const AnimatedText: React.FC<{ text: string; from: number; size?: number; weight?: number; color?: string; font?: string; letterSpacing?: number; top?: string; uppercase?: boolean }> = ({
  text, from, size = 80, weight = 900, color = C.white, font = FONT_DISPLAY, letterSpacing = -2, top = '50%', uppercase = true,
}) => {
  const frame = useCurrentFrame() - from;
  const { fps } = useVideoConfig();
  if (frame < -10) return null;
  const o = spring({ frame, fps, config: { damping: 14, stiffness: 100, mass: 0.5 } });
  const y = interpolate(o, [0, 1], [40, 0]);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: top, opacity: o }}>
      <div style={{
        fontFamily: font, fontWeight: weight, fontSize: size, color, letterSpacing,
        textTransform: uppercase ? 'uppercase' as const : 'none',
        textAlign: 'center', lineHeight: 1.05, padding: '0 60px',
        transform: `translateY(${y}px)`, textShadow: '0 4px 30px rgba(0,0,0,0.7)',
      }}>{text}</div>
    </AbsoluteFill>
  );
};

const FeatureGrid: React.FC<{ from: number }> = ({ from }) => {
  const { fps } = useVideoConfig();
  const features = [
    { icon: '🏡', label: 'Villas' },
    { icon: '🏖️', label: 'Beaches' },
    { icon: '🍽️', label: 'Restaurants' },
    { icon: '🏛️', label: 'Ancient Cities' },
    { icon: '💬', label: 'Concierge' },
    { icon: '🚕', label: 'Transfer' },
  ];
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: '0 60px' }}>
        {features.map((f, i) => {
          const frame = useCurrentFrame() - from - i * 8;
          const o = frame < 0 ? 0 : spring({ frame, fps, config: { damping: 16, stiffness: 90 } });
          const s = interpolate(o, [0, 1], [0.7, 1]);
          return (
            <div key={i} style={{
              opacity: o, transform: `scale(${s})`,
              background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 28, padding: '28px 32px',
              display: 'flex', alignItems: 'center', gap: 18,
              minWidth: 200,
            }}>
              <div style={{ fontSize: 60 }}>{f.icon}</div>
              <div style={{
                fontFamily: FONT_BODY, fontWeight: 700, fontSize: 32, color: C.white,
                textShadow: '0 2px 12px rgba(0,0,0,0.7)',
              }}>{f.label}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const FinalCTA: React.FC<{ from: number }> = ({ from }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame() - from;
  const o = frame < 0 ? 0 : spring({ frame, fps, config: { damping: 18, stiffness: 80 } });
  const scale = interpolate(o, [0, 1], [0.85, 1]);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg, ${C.bg} 0%, #051028 100%)`, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ opacity: o, transform: `scale(${scale})`, textAlign: 'center', padding: '0 60px' }}>
        <div style={{
          fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: 80, color: C.white,
          letterSpacing: -2, marginBottom: 16, textTransform: 'uppercase',
        }}>kalkaninfo<span style={{ color: C.gold }}>.com</span></div>
        <div style={{ width: 80, height: 4, background: C.sea, margin: '24px auto 32px', borderRadius: 2 }} />
        <div style={{
          fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 44, color: C.gold,
          letterSpacing: -0.5, marginBottom: 56, textTransform: 'uppercase',
        }}>Your Kalkan, Your Way</div>
        <div style={{
          background: `linear-gradient(135deg, ${C.sea}, #2b7fd1)`, color: C.white,
          padding: '24px 56px', borderRadius: 999, fontFamily: FONT_BODY,
          fontWeight: 800, fontSize: 36, letterSpacing: 0.5,
          boxShadow: `0 12px 40px ${C.sea}55`,
          display: 'inline-block',
        }}>📍 Visit kalkaninfo.com</div>
      </div>
    </AbsoluteFill>
  );
};

export const SiteIntroReels: React.FC<SiteIntroProps> = ({ clips }) => {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {/* Scene 1: Hook 0-180 (6s) — drone 1 */}
      <Sequence from={0} durationInFrames={180}>
        <DroneScene src={clips[0].url} from={0} duration={180} />
        <AnimatedText text="Planning a trip to" from={20} size={48} weight={500} color={C.white} font={FONT_BODY} top="38%" letterSpacing={1} uppercase={false} />
        <AnimatedText text="KALKAN?" from={50} size={180} weight={900} color={C.white} top="46%" letterSpacing={-4} />
        <AnimatedText text="Turkey's Lycian Riviera" from={110} size={32} weight={500} color={C.gold} font={FONT_BODY} top="68%" letterSpacing={2} uppercase={true} />
      </Sequence>

      {/* Scene 2: Brand intro 180-360 (6s) — drone 2 */}
      <Sequence from={180} durationInFrames={180}>
        <DroneScene src={(clips[1] || clips[0]).url} from={0} duration={180} />
        <AnimatedText text="MEET" from={10} size={56} weight={700} color={C.gold} font={FONT_BODY} top="32%" letterSpacing={4} />
        <AnimatedText text="kalkaninfo.com" from={40} size={110} weight={900} color={C.white} top="42%" letterSpacing={-3} uppercase={false} />
        <AnimatedText text="Your Local Guide" from={90} size={42} weight={500} color={C.white} font={FONT_BODY} top="58%" letterSpacing={1} uppercase={false} />
      </Sequence>

      {/* Scene 3: Features 360-660 (10s) — drone 3 */}
      <Sequence from={360} durationInFrames={300}>
        <DroneScene src={(clips[2] || clips[0]).url} from={0} duration={300} />
        <AnimatedText text="Everything in one place" from={10} size={36} weight={500} color={C.white} font={FONT_BODY} top="8%" letterSpacing={1} uppercase={false} />
        <FeatureGrid from={50} />
      </Sequence>

      {/* Scene 4: CTA 660-900 (8s) */}
      <Sequence from={660} durationInFrames={240}>
        <FinalCTA from={0} />
      </Sequence>
    </AbsoluteFill>
  );
};
