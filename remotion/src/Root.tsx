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
        durationInFrames={900}
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
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        schema={bultenReelSchema}
        defaultProps={defaultBultenReelProps}
      />
      <Composition
        id="VillaReel"
        component={VillaReel}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        schema={villaReelSchema}
        defaultProps={defaultVillaReelProps}
      />
      <Composition
        id="AntikReel"
        component={AntikReel}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        schema={antikReelSchema}
        defaultProps={defaultAntikReelProps}
      />
      <Composition
        id="PlajReel"
        component={PlajReel}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        schema={plajReelSchema}
        defaultProps={defaultPlajReelProps}
      />
    </>
  );
};
