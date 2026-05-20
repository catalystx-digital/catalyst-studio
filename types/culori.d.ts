declare module 'culori' {
  export interface Color {
    mode: string
    l?: number
    c?: number
    h?: number
    r?: number
    g?: number
    b?: number
    a?: number
    alpha?: number
    [key: string]: unknown
  }

  export interface RGBColor extends Color {
    mode: 'rgb'
    r: number
    g: number
    b: number
    alpha?: number
  }

  export interface LABColor extends Color {
    mode: 'lab'
    l: number
    a: number
    b: number
    alpha?: number
  }

  export interface OKLCHColor extends Color {
    mode: 'oklch'
    l: number
    c: number
    h: number
    alpha?: number
  }

  export function converter<T extends Color = Color>(mode: string): (color: Color | string) => T | undefined
  export function differenceCiede2000(): (a: Color | string, b: Color | string) => number
  export function formatHex(color: Color | string): string | undefined
  export function parse(color: string): Color | undefined
}
