/**
 * Location Map Component Definition
 *
 * Embeddable map with address/coordinates, marker info window, and styling options.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'

/**
 * Coordinates schema
 */
const CoordinatesSchema = z.object({
  lat: z.number().describe('Latitude'),
  lng: z.number().describe('Longitude'),
})

/**
 * Info window configuration schema
 */
const InfoWindowSchema = z.object({
  title: z.string().optional().describe('Info window title'),
  description: z.string().optional().describe('Info window description'),
  showDirections: z.boolean().optional().describe('Show directions link'),
})

/**
 * Location Map component definition
 */
export const LocationMapDef = defineComponent({
  type: ComponentType.LocationMap,
  category: ComponentCategory.Contact,

  schema: z.object({
    address: z.string().optional().describe('Address to display (geocoded to coordinates)'),
    coordinates: CoordinatesSchema.optional().describe('Exact latitude/longitude coordinates'),
    zoom: z.number().min(1).max(20).optional().describe('Map zoom level (1-20)'),
    mapType: z.enum(['roadmap', 'satellite', 'hybrid', 'terrain']).optional().describe('Map display type'),
    markerTitle: z.string().optional().describe('Marker tooltip title'),
    infoWindow: InfoWindowSchema.optional().describe('Info window configuration'),
    width: z.union([z.string(), z.number()]).optional().describe('Map width'),
    height: z.union([z.string(), z.number()]).optional().describe('Map height'),
    borderRadius: z.string().optional().describe('Border radius CSS value'),
    border: z.string().optional().describe('Border CSS value'),
    enableControls: z.boolean().optional().describe('Enable map controls (zoom, street view)'),
    apiKey: z.string().optional().describe('Google Maps API key'),
    fallbackImage: z.string().optional().describe('Fallback static image if API unavailable'),
    customStyles: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().describe('Custom map styles object'),
  }),

  detection: {
    keywords: [
      'location map',
      'google map',
      'office location',
      'find us',
      'directions',
    ],
    patterns: [
      'location.*map',
      'office.*map',
      'find.*us',
    ],
    commonNames: [
      'location map',
      'office map',
      'find us',
    ],
    pageLocation: ['main', 'footer'],
    confidence: 0.9,
    relatedComponents: [
      ComponentType.ContactInfo,
      ComponentType.ContactForm,
    ],
    industry: ['general', 'retail', 'public-sector'],
    semanticRole: 'region',
  },

  directives: [
    'Extract: address from nearby address block or contact info',
    'Extract: coordinates from map embed data attributes',
    'Extract: marker title from business name or location label',
    'EMBED: Often embedded as iframe or Google Maps widget',
    'API Key: Extract from map URL or script tag if present',
    'Fallback: Use static map image if interactive map unavailable',
  ],

  sample: {
    address: '123 Main Street, San Francisco, CA 94102',
    coordinates: {
      lat: 37.7749,
      lng: -122.4194,
    },
    zoom: 15,
    mapType: 'roadmap',
    markerTitle: 'Acme Corporation Headquarters',
    infoWindow: {
      title: 'Visit Our Office',
      description: 'Open Monday-Friday, 9:00 AM - 5:00 PM',
      showDirections: true,
    },
    width: '100%',
    height: '400px',
    borderRadius: '8px',
    enableControls: true,
  },

  description: 'Embeddable map with address/coordinates, marker info window, and styling options.',
})

export type LocationMapContent = z.infer<typeof LocationMapDef.schema>
