import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs/promises'
import { comparisonSnapshot, comparisonBlocks } from './phase3-fixtures'
import { dataRoot, saveSnapshot, writeJson, readJson } from './storage'
import { runArm } from './run-arm'
import { runtimeRequire } from './runtime'

async function verify() {
  const mode = process.argv[2], page = 'comparison-fixture', root = dataRoot()
  process.env.DECISION_MODEL_ENABLED = 'true'
  process.env.DECISION_MODEL_SHADOW = 'false'
  process.env.DECISION_MODEL_API_KEY = 'offline-fixture'
  process.env.DECISION_MODEL_LOG_DIR = path.join(root, 'decisions')
  const snapshot = comparisonSnapshot()
  const { DetectionConfig } = runtimeRequire('@/lib/studio/import/config')
  snapshot.models.data.push({ ...snapshot.models.data[0], id: DetectionConfig.blockFillModel })
  const { WebFetchTools } = runtimeRequire('@/lib/studio/import/services/web-tools')
  const nativeFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response(snapshot.html, { headers: { 'content-type': 'text/html' } })
    const web = new WebFetchTools()
    snapshot.outline = await web.fetchOutline({ url: snapshot.manifest.url })
    snapshot.sections = {}
    snapshot.manifest.sectionKeys = Object.keys(snapshot.sections)
  } finally { globalThis.fetch = nativeFetch }
  await saveSnapshot(path.join(root, 'pages', page), snapshot)
  const blocks = comparisonBlocks().map(block => ({ ...block, oversized: false, children: [] }))
  const geometry = { key: 'body', tag: 'body', region: 'main', box: { x: 0, y: 0, width: 1440, height: 1800 }, visible: true, meaningful: true, children: [{ key: 'main', tag: 'main', region: 'main', box: { x: 0, y: 0, width: 1440, height: 1800 }, visible: true, meaningful: true, children: blocks.map((block, index) => ({ key: block.id, tag: 'section', region: 'main', ownTextLength: 20, box: { ...block.box, y: index * 600, height: 600 }, visible: true, meaningful: true, evidence: { anchor: block.anchor, repeatedChildren: [] }, children: [] })) }] }
  await writeJson(path.join(root, 'labels', page, 'geometry.json'), { page, snapshotSha256: snapshot.manifest.sha256, tree: geometry })
  let decisionCalls = 0, fillCalls = 0, cuts = 0
  const { createFakeDecisionClient } = runtimeRequire('@/lib/studio/decisions')
  const decision = { async askRaw(state: string, questions: any[]) {
    decisionCalls++
    const answers = Object.fromEntries(questions.map(question => {
      if (question.shape === 'boolean') return [question.id, 0.1]
      const types = Object.keys(question.criteria), type = types.includes('text-block') ? 'text-block' : types.includes('core/generic-default') ? 'core/generic-default' : types[0]
      return [question.id, { value: type, probability: 0.99, distribution: Object.fromEntries(types.map(option => [option, option === type ? 0.99 : 0.01 / (types.length - 1)])) }]
    }))
    return createFakeDecisionClient(answers).askRaw(state, questions)
  } }
  const llm = { chat: { completions: { async create(payload: any) {
    fillCalls++
    if (mode === 'failure') throw new Error('Invented provider failure')
    if (mode === 'retry' && fillCalls === 1) return { choices: [{ finish_reason: 'length', message: { content: '{' } }], usage: { cost: 0 } }
    const user = payload.messages.find((m: any) => m.role === 'user').content
    const body = JSON.parse(user.slice(user.indexOf('\n{') + 1))
    return { model: payload.model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ sectionKey: body.sectionKey, components: [{ component: 'text-block', confidence: 0.95, content: { heading: body.nodes.find((n: any) => /^h[1-6]$/.test(n.tag))?.text || '', body: body.nodes.filter((n: any) => n.tag === 'p').map((n: any) => '<p>' + n.text + '</p>').join('') } }] }) } }], usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140, cost: 0 } }
  } } } }
  const record = await runArm({ page, arm: 'blocks-production', run: mode, dryRun: mode === 'dry' }, { decision, llm, cut: async () => { cuts++; return { blocks, issues: [], javascriptEnabled: true, anchorResolutionShare: 1 } } })
  const directory = path.join(root, 'arms', page, 'blocks-production', mode)
  const calls = await Promise.all((await fs.readdir(path.join(directory, 'calls'))).map(file => readJson(path.join(directory, 'calls', file))))
  assert.equal(record.replayReady, true)
  assert.equal(record.stylingReplay.rebuilt, true)
  assert.deepEqual((await readJson(path.join(directory, 'run.json'))).stylingReplay, record.stylingReplay)
  assert.equal(record.rules.harness, 'blocks')
  assert.equal(record.rules.postExtractionRepair, false)
  assert.equal(record.rules.stallTimeoutMs, 120000)
  assert.equal(record.rules.infrastructureRetries, 2)
  assert(record.wallClockSeconds >= 0)
  assert.equal((await readJson(path.join(directory, 'run.json'))).status, record.status)
  if (mode === 'dry') {
    assert.equal(record.status, 'dry-run', JSON.stringify(record.failures))
    assert.deepEqual([cuts, decisionCalls, fillCalls], [0, 0, 0])
    assert.deepEqual([record.plan.decisionCalls, record.plan.fillCalls], [3, 3])
    assert.equal(record.callCount, 0)
    assert.equal(calls.length, 6)
    assert(calls.every(call => call.status === 'planned'))
  } else {
    assert.equal(cuts, 1)
    assert.equal(record.callCount, decisionCalls + fillCalls)
    assert.equal(calls.length, record.callCount)
    assert(calls.every(call => call.request && call.latencyMs >= 0 && Object.hasOwn(call, 'usage') && Object.hasOwn(call, 'cost')))
    if (mode === 'failure') {
      assert.equal(record.status, 'failed')
      assert(record.failures.some((failure: any) => failure.error?.message.includes('Invented provider failure')))
      assert.equal(record.failedCalls, 3)
      assert.equal((await readJson(path.join(directory, 'components.json'))).length, 0)
    } else {
      assert.equal(record.status, 'complete', JSON.stringify(record.failures))
      assert.equal((await readJson(path.join(directory, 'components.json'))).length, 3)
      assert.equal(record.retryCount, mode === 'retry' ? 1 : 0)
      assert.equal(fillCalls, mode === 'retry' ? 4 : 3)
      assert(calls.some(call => call.kind === 'decision' && call.request.questions['import.block.component']))
      assert(calls.every(call => call.status === 'complete' && call.response && call.cost === 0))
    }
  }
  console.log('PASS production ' + mode)
}
verify().catch(error => { console.error(error); process.exitCode = 1 })
