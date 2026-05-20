declare module 'wcag-contrast' {
  export function hex(color1: string, color2: string): number
  export function rgb(rgb1: [number, number, number], rgb2: [number, number, number]): number
  export function luminance(hex: string): number
  export function score(contrast: number): 'Fail' | 'AA' | 'AAA'
}
