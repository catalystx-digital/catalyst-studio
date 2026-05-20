/**
 * Registration of pricing components with the CMS component factory.
 */

import { ComponentType } from '../_core/types';
import { cmsComponentFactory } from '../_factory/factory';
import { detectionToAIMetadata } from '../_core/component-definition';
import { PricingTableAdapter, PricingCardAdapter } from './adapters';
import { PricingTableDef } from './pricing-table/pricing-table.def';
import { PricingCardDef } from './pricing-card/pricing-card.def';

// Register PricingTable component
cmsComponentFactory.registerComponent(
  ComponentType.PricingTable,
  PricingTableAdapter,
  detectionToAIMetadata(PricingTableDef.detection!, ComponentType.PricingTable),
  { description: PricingTableDef.description, schema: PricingTableDef.schema }
);

// Register PricingCard component
cmsComponentFactory.registerComponent(
  ComponentType.PricingCard,
  PricingCardAdapter,
  detectionToAIMetadata(PricingCardDef.detection!, ComponentType.PricingCard),
  { description: PricingCardDef.description, schema: PricingCardDef.schema }
);

// Registration complete - components are now available in factory
if (process.env.NODE_ENV === 'development') {
  console.log('[Pricing Components] Successfully registered:', {
    components: [ComponentType.PricingTable, ComponentType.PricingCard],
    timestamp: new Date().toISOString()
  });
}
