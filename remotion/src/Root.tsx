import { Composition } from 'remotion';
import { AntikKentReels, antikKentSchema, defaultAntikKentProps } from './AntikKent';
import { AntikKentVideoReels, antikKentVideoSchema, defaultAntikKentVideoProps } from './AntikKentVideo';
import { SiteIntroReels, siteIntroSchema, defaultSiteIntroProps } from './SiteIntro';

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
    </>
  );
};
