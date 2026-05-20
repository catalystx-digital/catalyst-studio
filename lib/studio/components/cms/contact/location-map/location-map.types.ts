import { CMSComponentProps, ComponentType, ComponentCategory } from '@/lib/studio/components/cms/_core/types';
import { type Image } from '@/lib/studio/components/cms/_core/value-objects';

export interface LocationMapContent {
  address?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  zoom?: number; // 1-20, default 15
  mapType?: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
  markerTitle?: string;
  infoWindow?: {
    title?: string;
    description?: string;
    showDirections?: boolean;
  };
  width?: string | number; // default '100%'
  height?: string | number; // default 400
  borderRadius?: string;
  border?: string;
  enableControls?: boolean;
  apiKey?: string; // Optional - can be set via environment variable
  fallbackImage?: Image | string; // Static image URL for no-JS scenarios
  customStyles?: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- JSON configuration for custom map styles
}

export interface LocationMapProps extends CMSComponentProps {
  type: ComponentType.LocationMap;
  category: ComponentCategory;
  content: LocationMapContent;
}