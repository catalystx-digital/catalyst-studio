export const STICK_VERSION = 'stick1'

export function stickScoreName(arm:string,run:string,familySet?:string) {
  return `${arm}--${run}--${STICK_VERSION}${familySet?`-family-${familySet}`:''}`
}
