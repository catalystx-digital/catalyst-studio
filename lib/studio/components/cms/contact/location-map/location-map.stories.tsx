import type { Meta, StoryObj } from '@storybook/react';
import LocationMap from './index';
import type { LocationMapContent } from './location-map.types';
import { ComponentType, ComponentCategory } from '../../_core/types';

const meta = {
  title: 'Studio/CMS/Contact/LocationMap',
  component: LocationMap,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof LocationMap>;

export default meta;
type Story = StoryObj<typeof meta>;

const defaultContent: LocationMapContent = {
  markerTitle: 'Headquarters',
  address: '123 Main St, City, State 12345',
  coordinates: { lat: 40.7128, lng: -74.006 },
  zoom: 14,
  mapType: 'roadmap',
  infoWindow: {
    title: 'Visit our office',
    description: 'Open Monday to Friday, 9am – 5pm.',
    showDirections: true,
  },
  enableControls: true,
  width: '100%',
  height: 420,
};

export const Default: Story = {
  args: {
    id: 'locationmap-default',
    type: ComponentType.LocationMap,
    category: ComponentCategory.Contact,
    content: defaultContent,
  },
};

export const StaticFallback: Story = {
  args: {
    id: 'locationmap-static',
    type: ComponentType.LocationMap,
    category: ComponentCategory.Contact,
    content: {
      ...defaultContent,
      apiKey: undefined,
      fallbackImage: 'https://placehold.co/1200x800/png',
    },
  },
};

export const ConfigurationRequired: Story = {
  args: {
    id: 'locationmap-placeholder',
    type: ComponentType.LocationMap,
    category: ComponentCategory.Contact,
    content: {
      apiKey: undefined,
      address: undefined,
      coordinates: undefined,
    },
  },
};
