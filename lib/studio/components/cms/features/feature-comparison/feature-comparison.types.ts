import type { CMSComponentProps, ComponentContent } from '../../_core/types';
import type { SmartLink } from '../../_core/value-objects';

export type ComparisonValue = boolean | string | number;

export interface ComparisonProduct {
  name: string;
  price?: string;
  recommended?: boolean;
  cta?: {
    text: string;
    href: SmartLink;
  };
}

export interface ComparisonFeature {
  name: string;
  description?: string;
  values: ComparisonValue[];
}

export interface FeatureComparisonContent extends ComponentContent {
  heading?: string;
  subheading?: string;
  products: ComparisonProduct[];
  features: ComparisonFeature[];
}

export interface FeatureComparisonProps extends CMSComponentProps {
  content: FeatureComparisonContent;
  ariaLabel?: string;
}
