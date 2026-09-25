/** @jest-environment node */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createDecisionClient, getQuestion } from '@/lib/studio/decisions'
import { CallRecorder, replayTransport } from './call-recording'
import { decisionRequest } from './blocks-production'

test.each(['production', 'family override'])('%s records a 500 then 200 as one decision call with two attempts', async arm => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'import-lab-decision-retry-'))
  fs.mkdirSync(path.join(root, 'calls'))
  const originalFetch = globalThis.fetch
  const previous = { ...process.env }
  process.env.DECISION_MODEL_API_KEY = 'offline-fixture'
  process.env.DECISION_MODEL_BASE_URL = 'https://decision.example.test/api'
  let attempts = 0
  globalThis.fetch = async () => {
    attempts++
    return new Response(attempts === 1 ? '{"error":"temporary"}' : JSON.stringify({
      answers: { 'import.block.component': { choice: 'first', probabilities: { first: 1, second: 0, third: 0 } }, 'import.block.multiple': { noul: 0.1 } },
      usage: { cost: 0.001 }
    }), { status: attempts === 1 ? 500 : 200, headers: { 'content-type': 'application/json' } })
  }
  const recorder = new CallRecorder(root, false)
  const restore = replayTransport({ models: {} } as any, recorder, ['https://decision.example.test/api/alpha/decisions'])
  try {
    const registered = getQuestion('import.block.component')
    if (registered.shape !== 'choice') throw new Error('Expected choice question')
    const question = { ...registered, criteria: { first: 'First', second: 'Second', third: 'Third' },
      instructions: arm === 'family override' ? 'Choose a family' : registered.instructions }
    const questions = [question, getQuestion('import.block.multiple')]
    const client = createDecisionClient()
    await recorder.call('decision', await decisionRequest('test/model', 'Fixture state', questions), () => client.askRaw('Fixture state', questions))
    expect(recorder.calls).toHaveLength(1)
    expect(recorder.calls[0].status).toBe('complete')
    expect(recorder.calls[0].transport.map((attempt: any) => attempt.httpStatus)).toEqual([500, 200])
    expect(attempts).toBe(2)
  } finally {
    restore()
    globalThis.fetch = originalFetch
    process.env = { ...previous }
    fs.rmSync(root, { recursive: true, force: true })
  }
}, 30000)
