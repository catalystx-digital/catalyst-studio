import path from 'node:path'
import { main, loadSnapshot, readJson, writeJson } from './storage'
import { labelDirectory, sha, type Sheet, type Proposal } from './labels'
import { loadFamilies, type FamilyOptions } from './families'
import { runtimeRequire } from './runtime'
import { createReplayTools } from './replay'
import { CallRecorder, replayTransport, mapLimited } from './call-recording'
import { decisionRequest, type RunFixtures } from './blocks-production'
import { scorePicks, type Pick } from './pick-score'

export async function blockCatalogue() {
  const { getQuestion } = runtimeRequire('@/lib/studio/decisions') as typeof import('@/lib/studio/decisions')
  const question = getQuestion('import.block.component')
  if (question.shape !== 'choice') throw new Error('Production block question is not a choice')
  const criteria = typeof question.criteria === 'function' ? await question.criteria() : question.criteria
  return { entries: Object.entries(criteria).map(([type, description]) => ({ type, description })) }
}

export async function runPick(page: string, directory: string, dryRun: boolean, record: any, options: FamilyOptions, fixtures?: RunFixtures) {
  const recorder = new CallRecorder(directory, dryRun)
  const restore: Array<() => void> = []
  const picks: Pick[] = []
  try {
    const snapshot = await loadSnapshot(page)
    const proposal = await readJson<Proposal>(path.join(labelDirectory(page), 'blocks.json'))
    const sheet = await readJson<Sheet>(path.join(labelDirectory(page), 'answer-sheet.json'))
    if (proposal.status !== 'complete' || proposal.snapshotSha256 !== snapshot.manifest.sha256 || sheet.snapshotSha256 !== proposal.snapshotSha256 || sheet.proposalSha256 !== sha(proposal)) throw new Error('Proposal or answer sheet is stale')
    record.snapshotSha256 = snapshot.manifest.sha256
    record.proposalSha256 = sha(proposal)
    record.answerSheetSha256 = sha(sheet)
    record.pageUrl = snapshot.manifest.url
    const decisions = runtimeRequire('@/lib/studio/decisions') as typeof import('@/lib/studio/decisions')
    const config = decisions.getDecisionConfig()
    const families = options.families ? await loadFamilies(options.families, options.familySet!) : undefined
    record.catalogue = await blockCatalogue()
    record.models = { decision: config.modelId }
    if (families) record.families = families
    const question = decisions.getQuestion('import.block.component')
    if (question.shape !== 'choice') throw new Error('Production block question is not a choice')
    // askPanel resolves registered question IDs internally; passing options would require changing the shared decision API.
    if (families) {
      const original = { criteria: question.criteria, instructions: question.instructions }
      question.criteria = Object.fromEntries(families.entries.map(entry => [entry.type, entry.description]))
      question.instructions = question.instructions.replace('catalogue page-level component type', 'component family')
      restore.push(() => Object.assign(question, original))
    }
    restore.push(replayTransport(snapshot, recorder, [config.baseUrl.replace(/\/$/, '') + '/alpha/decisions']))
    if (!dryRun) {
      const client = fixtures?.decision ?? decisions.createDecisionClient()
      decisions.setDecisionClient({ askRaw: async (state, questions) => recorder.call('decision', await decisionRequest(config.modelId, state, questions), () => client.askRaw(state, questions), { fixture: !!fixtures }) })
      restore.push(() => decisions.setDecisionClient(null))
    }
    const { buildBlockInput } = runtimeRequire('@/lib/studio/import/detection/blocks/block-input') as typeof import('@/lib/studio/import/detection/blocks/block-input')
    const { pickBlockTypes, renderPickEvidence } = runtimeRequire('@/lib/studio/import/detection/blocks/block-pick') as typeof import('@/lib/studio/import/detection/blocks/block-pick')
    const replay = createReplayTools(snapshot)
    await replay.fetchOutline({ url: snapshot.manifest.url })
    record.stylingReplay = replay.styling
    const { bgImageMap } = replay.getPageStyling(snapshot.outline.handle)
    replay.release(snapshot.outline.handle)
    const entries = sheet.entries.filter(entry => entry.status !== 'draft' && entry.label)
    if (!entries.length) throw new Error('No reviewed blocks')
    record.blockCount = entries.length
    const outcomes = await mapLimited(entries, 8, async ({ block }) => {
      const input = buildBlockInput({ html: snapshot.html, bgImageMap, block: block as import('@/lib/studio/import/detection/blocks/block-cutter').Block })
      if (dryRun) {
        const evidence = renderPickEvidence(input)
        await recorder.call('decision', await decisionRequest(config.modelId, evidence.state, [question, decisions.getQuestion('import.block.multiple')]), async () => { throw new Error('Dry run called a client') }, { blockId: block.id })
        return
      }
      const result = await pickBlockTypes({ ...input, url: snapshot.manifest.url })
      if (result.source !== 'model') throw new Error('Production decision used ' + result.source + ': ' + result.issues.join('; '))
      const component = result.answer['import.block.component'], multiple = result.answer['import.block.multiple']
      const distribution = component.distribution!
      const ranked = Object.entries(distribution).map(([type, probability]) => ({ type, probability })).sort((a, b) => b.probability - a.probability || a.type.localeCompare(b.type))
      picks.push({ blockId: block.id, order: block.order, distribution, ranked, multipleProbability: multiple.value === true ? multiple.probability! : 1 - multiple.probability!, allowedTypes: result.allowedTypes, branch: result.allowedTypes.length === 1 ? 'dominant' : result.topChoices.multiple ? 'multiple' : 'uncertain', issues: result.issues })
    })
    outcomes.forEach((outcome, index) => { if (outcome.status === 'rejected') record.failures.push({ blockId: entries[index].block.id, stage: 'decision', message: String(outcome.reason) }) })
    picks.sort((a, b) => a.order - b.order)
    await writeJson(path.join(directory, 'picks.json'), { picks, dryAssumptions: dryRun, ...(families ? { familySet: families.set, familySha256: families.sha256 } : {}) })
    if (!dryRun) await writeJson(path.join(directory, 'pick-score.json'), { ...scorePicks(sheet, picks, { families }), answerSheetSha256: sha(sheet) })
    record.status = record.failures.length ? 'failed' : dryRun ? 'dry-run' : 'complete'
  } finally {
    for (const undo of restore.reverse()) undo()
    record.callCount = recorder.calls.filter(call => call.status !== 'planned').length
    record.plannedCallCount = recorder.calls.filter(call => call.status === 'planned').length
    record.failedCalls = recorder.calls.filter(call => ['failed', 'timeout'].includes(call.status)).length
  }
}
if (require.main === module) main(async () => { const { armCLI } = await import('./run-arm'); await armCLI('jev-pick') })
