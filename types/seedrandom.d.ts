declare module 'seedrandom' {
  namespace seedrandom {
    interface PRNG {
      (): number
      quick(): number
      int32(): number
      double(): number
      state(): object
    }

    interface Options {
      entropy?: boolean
      global?: boolean
      state?: boolean | object
    }
  }

  function seedrandom(seed?: string, options?: seedrandom.Options, callback?: (prng: seedrandom.PRNG, seed: string) => void): seedrandom.PRNG

  export = seedrandom
}
