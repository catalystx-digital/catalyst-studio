export interface GoogleFontRegistryEntry {
  importName: string
  weights?: readonly string[]
}

export const GOOGLE_FONT_REGISTRY: Record<string, GoogleFontRegistryEntry> = {
  inter: { importName: 'Inter', weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] },
  roboto: { importName: 'Roboto', weights: ['100', '300', '400', '500', '700', '900'] },
  poppins: { importName: 'Poppins', weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] },
  lato: { importName: 'Lato', weights: ['100', '300', '400', '700', '900'] },
  montserrat: { importName: 'Montserrat', weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] },
  'open sans': { importName: 'Open_Sans', weights: ['300', '400', '500', '600', '700', '800'] },
  'playfair display': { importName: 'Playfair_Display', weights: ['400', '500', '600', '700', '800', '900'] },
  'source sans pro': { importName: 'Source_Sans_Pro', weights: ['200', '300', '400', '600', '700', '900'] },
  'source sans 3': { importName: 'Source_Sans_3', weights: ['200', '300', '400', '500', '600', '700', '800', '900'] },
  'work sans': { importName: 'Work_Sans', weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] },
  manrope: { importName: 'Manrope', weights: ['200', '300', '400', '500', '600', '700', '800'] },
  nunito: { importName: 'Nunito', weights: ['200', '300', '400', '600', '700', '800', '900'] },
  'nunito sans': { importName: 'Nunito_Sans', weights: ['200', '300', '400', '600', '700', '800', '900'] },
  merriweather: { importName: 'Merriweather', weights: ['300', '400', '700', '900'] },
  lora: { importName: 'Lora', weights: ['400', '500', '600', '700'] },
  'plus jakarta sans': { importName: 'Plus_Jakarta_Sans', weights: ['200', '300', '400', '500', '600', '700', '800'] },
  mulish: { importName: 'Mulish', weights: ['200', '300', '400', '500', '600', '700', '800', '900'] },
  raleway: { importName: 'Raleway', weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] },
  urbanist: { importName: 'Urbanist', weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] }
}

export const SYSTEM_FONT_ALLOWLIST = new Set([
  'arial',
  'georgia',
  'times',
  'times new roman',
  'trebuchet ms',
  'verdana',
  'palatino',
  'gill sans',
  'franklin gothic medium',
  'lucida grande',
  'candara',
  'optima',
  'segoe ui',
  'sf pro text',
  'sf pro display'
])

export const GENERIC_FONT_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'ui-rounded',
  'emoji',
  'math',
  'fangsong',
  'inherit',
  'initial',
  'unset',
  'default'
])

export const DEFAULT_SYSTEM_FONT_STACK = 'system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif'
