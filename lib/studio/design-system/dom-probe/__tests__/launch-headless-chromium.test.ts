import { chromium, type Browser } from 'playwright-core'
import serverlessChromium from '@sparticuz/chromium'

import { launchHeadlessChromium } from '../launch-headless-chromium'

jest.mock('playwright-core', () => ({
  chromium: { launch: jest.fn() }
}))
jest.mock('@sparticuz/chromium', () => ({
  __esModule: true,
  default: { args: ['--serverless-arg'], executablePath: jest.fn() }
}))

describe('launchHeadlessChromium', () => {
  const originalEnv = process.env
  const browser = { close: jest.fn() } as unknown as Browser
  const launch = jest.mocked(chromium.launch)
  const serverlessPath = jest.mocked(serverlessChromium.executablePath)

  beforeEach(() => {
    process.env = { ...originalEnv }
    for (const key of ['VERCEL', 'AWS_LAMBDA_FUNCTION_NAME', 'NETLIFY', 'SERVERLESS', 'CHROMIUM_EXECUTABLE_PATH']) {
      delete process.env[key]
    }
    jest.clearAllMocks()
    launch.mockResolvedValue(browser)
    serverlessPath.mockResolvedValue('/tmp/chromium')
  })

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  it('uses the serverless executable and arguments even when a local path is set', async () => {
    process.env.VERCEL = '1'
    process.env.CHROMIUM_EXECUTABLE_PATH = '/local/chromium'
    expect(await launchHeadlessChromium()).toBe(browser)
    expect(launch).toHaveBeenCalledWith({
      headless: true, timeout: 60000, executablePath: '/tmp/chromium', args: ['--serverless-arg']
    })
  })

  it('uses the existing explicit executable variable locally', async () => {
    process.env.CHROMIUM_EXECUTABLE_PATH = 'C:/browser/chrome.exe'
    expect(await launchHeadlessChromium()).toBe(browser)
    expect(launch).toHaveBeenCalledWith({
      headless: true, timeout: 60000, executablePath: 'C:/browser/chrome.exe'
    })
    expect(serverlessPath).not.toHaveBeenCalled()
  })

  it('leaves default browser resolution to Playwright', async () => {
    expect(await launchHeadlessChromium()).toBe(browser)
    expect(launch).toHaveBeenCalledWith({ headless: true, timeout: 60000 })
    expect(serverlessPath).not.toHaveBeenCalled()
  })

  it('reports the launch source, path and action on failure', async () => {
    process.env.CHROMIUM_EXECUTABLE_PATH = '/bad/chrome'
    launch.mockRejectedValueOnce(new Error('Launch refused'))
    await expect(launchHeadlessChromium()).rejects.toThrow(
      'Chromium launch failed (source: CHROMIUM_EXECUTABLE_PATH; path: /bad/chrome). Set CHROMIUM_EXECUTABLE_PATH to an installed Chromium executable'
    )
    expect(launch).toHaveBeenCalledTimes(1)
  })
})
