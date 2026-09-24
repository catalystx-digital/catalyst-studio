export const STICK_VERSION = 'stick2'

export function stickScoreName(arm:string,run:string,familySet?:string) {
  return `${arm}--${run}--${STICK_VERSION}${familySet?`-family-${familySet}`:''}`
}
