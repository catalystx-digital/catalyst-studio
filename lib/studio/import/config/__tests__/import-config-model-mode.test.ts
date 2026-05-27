describe('import model mode config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  async function loadConfig() {
    return await import('../import-config')
  }

  it('uses IMPORT_MODEL_CHAIN in quality mode by default', async () => {
    process.env.IMPORT_MODEL_CHAIN = 'quality/model|quality/retry'
    delete process.env.IMPORT_MODEL_MODE

    const { ModelConfig } = await loadConfig()

    expect(ModelConfig.mode).toBe('quality')
    expect(ModelConfig.chain).toBe('quality/model|quality/retry')
    expect(ModelConfig.primary).toBe('quality/model')
    expect(ModelConfig.fallbackEnabled).toBe(true)
  })

  it('uses DeepSeek V4 Flash as the default cheap model chain', async () => {
    process.env.IMPORT_MODEL_CHAIN = 'quality/model'
    process.env.IMPORT_MODEL_MODE = 'cheap'
    delete process.env.IMPORT_CHEAP_MODEL_CHAIN

    const { ModelConfig } = await loadConfig()

    expect(ModelConfig.mode).toBe('cheap')
    expect(ModelConfig.chain).toBe('deepseek/deepseek-v4-flash')
    expect(ModelConfig.primary).toBe('deepseek/deepseek-v4-flash')
    expect(ModelConfig.fallbackEnabled).toBe(false)
  })

  it('uses IMPORT_CHEAP_MODEL_CHAIN when cheap mode is configured', async () => {
    process.env.IMPORT_MODEL_CHAIN = 'quality/model'
    process.env.IMPORT_MODEL_MODE = 'cheap'
    process.env.IMPORT_CHEAP_MODEL_CHAIN = 'cheap/model|cheap/retry'

    const { ModelConfig } = await loadConfig()

    expect(ModelConfig.mode).toBe('cheap')
    expect(ModelConfig.chain).toBe('cheap/model|cheap/retry')
    expect(ModelConfig.primary).toBe('cheap/model')
    expect(ModelConfig.fallbackEnabled).toBe(true)
  })

  it('uses IMPORT_MODEL_CHAIN in benchmark mode', async () => {
    process.env.IMPORT_MODEL_CHAIN = 'benchmark/model'
    process.env.IMPORT_MODEL_MODE = 'benchmark'

    const { ModelConfig } = await loadConfig()

    expect(ModelConfig.mode).toBe('benchmark')
    expect(ModelConfig.chain).toBe('benchmark/model')
    expect(ModelConfig.primary).toBe('benchmark/model')
    expect(ModelConfig.fallbackEnabled).toBe(false)
  })

  it('rejects invalid model modes', async () => {
    process.env.IMPORT_MODEL_CHAIN = 'quality/model'
    process.env.IMPORT_MODEL_MODE = 'fast'

    await expect(loadConfig()).rejects.toThrow('IMPORT_MODEL_MODE must be one of: quality, cheap, benchmark')
  })

  it('rejects empty entries in the selected model chain', async () => {
    process.env.IMPORT_MODEL_CHAIN = 'quality/model'
    process.env.IMPORT_MODEL_MODE = 'cheap'
    process.env.IMPORT_CHEAP_MODEL_CHAIN = 'cheap/model|'

    await expect(loadConfig()).rejects.toThrow('IMPORT_CHEAP_MODEL_CHAIN must be a pipe-separated list of non-empty model ids')
  })
})
