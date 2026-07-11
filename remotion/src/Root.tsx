import { Composition } from 'remotion';
import { AntikKentReels, antikKentSchema, defaultAntikKentProps } from './AntikKent';
import { AntikKentVideoReels, antikKentVideoSchema, defaultAntikKentVideoProps } from './AntikKentVideo';
import { SiteIntroReels, siteIntroSchema, defaultSiteIntroProps } from './SiteIntro';
import { GazeteReel, gazeteReelSchema, defaultGazeteReelProps } from './GazeteReel';
import { RestoranReel, restoranReelSchema, defaultRestoranReelProps } from './RestoranReel';
import { BultenReel, bultenReelSchema, defaultBultenReelProps } from './BultenReel';
import { VillaReel, villaReelSchema, defaultVillaReelProps } from './VillaReel';
import { AntikReel, antikReelSchema, defaultAntikReelProps } from './AntikReel';
import { PlajReel, plajReelSchema, defaultPlajReelProps } from './PlajReel';
import { WebappPromo, webappPromoSchema } from './WebappPromo';
import promoTR from '../props-webapp-promo-tr.json';
import promoEN from '../props-webapp-promo-en.json';

const framesOf = (p: { scenes: { frames: number }[] }) => p.scenes.reduce((n, s) => n + s.frames, 0);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AntikKent"
        component={AntikKentReels}
        durationInFrames={30 * 30}
        fps={30}
        width={1080}
        height={1920}
        schema={antikKentSchema}
        defaultProps={defaultAntikKentProps}
      />
      <Composition
        id="AntikKentVideo"
        component={AntikKentVideoReels}
        durationInFrames={30 * 30}
        fps={30}
        width={1080}
        height={1920}
        schema={antikKentVideoSchema}
        defaultProps={defaultAntikKentVideoProps}
      />
      <Composition
        id="SiteIntro"
        component={SiteIntroReels}
        durationInFrames={30 * 30}
        fps={30}
        width={1080}
        height={1920}
        schema={siteIntroSchema}
        defaultProps={defaultSiteIntroProps}
      />
      <Composition
        id="GazeteReel"
        component={GazeteReel}
        durationInFrames={720}
        fps={30}
        width={1080}
        height={1920}
        schema={gazeteReelSchema}
        defaultProps={defaultGazeteReelProps}
      />
      <Composition
        id="RestoranReel"
        component={RestoranReel}
        durationInFrames={720}
        fps={30}
        width={1080}
        height={1920}
        schema={restoranReelSchema}
        defaultProps={defaultRestoranReelProps}
      />
      <Composition
        id="BultenReel"
        component={BultenReel}
        durationInFrames={720}
        fps={30}
        width={1080}
        height={1920}
        schema={bultenReelSchema}
        defaultProps={defaultBultenReelProps}
      />
      <Composition
        id="VillaReel"
        component={VillaReel}
        durationInFrames={720}
        fps={30}
        width={1080}
        height={1920}
        schema={villaReelSchema}
        defaultProps={defaultVillaReelProps}
      />
      <Composition
        id="AntikReel"
        component={AntikReel}
        durationInFrames={720}
        fps={30}
        width={1080}
        height={1920}
        schema={antikReelSchema}
        defaultProps={defaultAntikReelProps}
      />
      <Composition
        id="PlajReel"
        component={PlajReel}
        durationInFrames={720}
        fps={30}
        width={1080}
        height={1920}
        schema={plajReelSchema}
        defaultProps={defaultPlajReelProps}
      />
      <Composition
        id="WebappPromoTR"
        component={WebappPromo}
        durationInFrames={framesOf(promoTR)}
        fps={30}
        width={1080}
        height={1920}
        schema={webappPromoSchema}
        defaultProps={promoTR as any}
      />
      <Composition
        id="WebappPromoEN"
        component={WebappPromo}
        durationInFrames={framesOf(promoEN)}
        fps={30}
        width={1080}
        height={1920}
        schema={webappPromoSchema}
        defaultProps={promoEN as any}
      />
    </>
  );
};
