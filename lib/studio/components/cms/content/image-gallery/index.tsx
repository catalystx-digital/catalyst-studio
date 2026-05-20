import React from 'react';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { ImageGalleryServer } from './image-gallery.server';
import { ImageGalleryClient } from './image-gallery.client';
import { ImageGalleryProps } from './image-gallery.types';

const ImageGallery: React.FC<ImageGalleryProps> = React.memo((props) => {
  return (
    <>
      <ImageGalleryServer {...props} />
      <ImageGalleryClient {...props} />
    </>
  );
});

ImageGallery.displayName = 'ImageGallery';

export default withPerformanceTracking(ImageGallery, ComponentType.ImageGallery);
export { ImageGallery };