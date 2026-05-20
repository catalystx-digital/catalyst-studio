import React from 'react';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { VideoPlayerServer } from './video-player.server';
import { VideoPlayerClient } from './video-player.client';
import { VideoPlayerProps } from './video-player.types';

const VideoPlayer: React.FC<VideoPlayerProps> = React.memo((props) => {
  return (
    <>
      <VideoPlayerServer {...props} />
      <VideoPlayerClient {...props} />
    </>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default withPerformanceTracking(VideoPlayer, ComponentType.VideoPlayer);
export { VideoPlayer };