/** @jest-environment node */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import { buildDetectionPromptFromCatalog } from '@/lib/studio/import/detection/prompt-builder'
import { familyCatalogueOverride } from './family-fill'
import { familyJsonSchemasForSet } from './family-schemas'
import { parseSectionDetectionResponse } from '@/lib/studio/import/detection/response-parser'
import { aggregateSectionArtifacts } from '@/lib/studio/import/detection/section-aggregation'
import { inferLocationFromType } from '@/lib/studio/import/detection/response-parser'
import { getPageCatalogSummary } from '@/lib/studio/pages/catalog'
import type { DetectionSectionTask } from '@/lib/studio/import/detection/section-plan'
import {
  CONTENT_EXTRACTION_SECTION, VALUE_OBJECT_OUTPUT_SECTION,
  CONTENT_REFERENCE_RULES_SECTION, FORBIDDEN_FIELDS_SECTION
} from '@/lib/studio/ai/component-catalog/prompt-sections'

test('family prompt preserves every description and the complete JSON Schema contract', async () => {
  const { override } = await familyCatalogueOverride()
  const { prompt } = await buildDetectionPromptFromCatalog({
    mode: 'section', pageUrl: 'https://example.com/workshop',
    catalogueContractOverride: override.contract, omitCatalogueRules: override.omitRules
  })
  expect(Object.keys(override.types)).toHaveLength(11)
  expect(prompt.slice(prompt.indexOf(override.contract), prompt.indexOf(override.contract) + override.contract.length)).toBe(override.contract)
  for (const [type, description] of Object.entries(override.types)) {
    expect(prompt).toContain(`${type}: ${description}`)
  }
  expect(prompt).toContain('=== FAMILY CONTENT CONTRACTS ===\n{')
  expect(prompt).toContain(JSON.stringify(familyJsonSchemasForSet('D')))
  const omitted = [CONTENT_EXTRACTION_SECTION, VALUE_OBJECT_OUTPUT_SECTION, CONTENT_REFERENCE_RULES_SECTION, FORBIDDEN_FIELDS_SECTION]
    .flatMap(section => section.split('\n'))
    .filter(line => line.startsWith('- ') && override.omitRules.some(type =>
      new RegExp(`(^|[^a-zA-Z0-9_-])${type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^a-zA-Z0-9_-])`).test(line)))
  expect(omitted.length).toBeGreaterThan(0)
  for (const rule of omitted) expect(prompt).not.toContain(rule)
})

test('set C remains selectable for historical family-fill runs', async () => {
  const {override}=await familyCatalogueOverride('C')
  expect(Object.keys(override.types)).toHaveLength(15)
  expect(override.validateContent('stats',{heading:'Invented count'})).toMatchObject({heading:'Invented count'})
})

test('a filled family header passes the required block check after parsing', async () => {
  const { override } = await familyCatalogueOverride()
  const sectionKey = 'block:1'
  const content = {
    heading: 'Invented Workshop',
    links: [{ label: 'Visit', type: 'external', url: 'https://example.com/visit' }],
    placement: 'header',
    settings: { sticky: true }
  }
  const parsed = parseSectionDetectionResponse({
    rawResponse: JSON.stringify({ sectionKey, components: [{ component: 'site-header', confidence: 0.95, content }] }),
    sectionKey,
    availableComponents: [{ type: 'site-header', confidence: 1 }],
    url: 'https://example.com/',
    confidenceThreshold: 0.6,
    validateContent: ({ canonicalType, content }) => override.validateContent(canonicalType, content)
  })
  expect(parsed.components).toHaveLength(1)
  parsed.components[0].location = override.location(parsed.components[0].type, parsed.components[0].content) as typeof parsed.components[0]['location']
  const tasks: DetectionSectionTask[] = [{ sectionKey, sectionOrder: 0, role: 'header', required: true, candidateTypes: ['site-header'] }]
  const artifacts = [{ ...parsed, sectionOrder: 0 }]
  expect(() => aggregateSectionArtifacts(tasks, artifacts)).toThrow('Required section block:1 produced no components')
  const components = aggregateSectionArtifacts(tasks, artifacts, override.templateEquivalent)
  expect(components).toMatchObject([{ type: 'site-header', confidence: 0.95, content, location: 'header' }])
})

test('shared parser derives an internal page ID before the family validator', async () => {
  const { override } = await familyCatalogueOverride()
  const parsed = parseSectionDetectionResponse({
    rawResponse: JSON.stringify({ sectionKey: 'block:1', components: [{
      component: 'collection', confidence: 0.95,
    content: { items: [{ links: [{ type: 'internal', path: '/details' }, { type: 'internal', path: '/more' }] }] }
    }] }),
    sectionKey: 'block:1',
    availableComponents: [{ type: 'collection', confidence: 1 }],
    url: 'https://example.com/', confidenceThreshold: 0.6,
    validateContent: ({ canonicalType, content }) => override.validateContent(canonicalType, content)
  })
  expect(parsed.components[0].content).toEqual({
    items: [{ links: [{ type: 'internal', path: '/details', pageId: 'details' }, { type: 'internal', path: '/more', pageId: 'more' }] }]
  })
})

test.each(['valid-repair','invalid-twice'])('family fill runs with invented offline clients: %s',mode=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'import-lab-family-fill-'))
  try {
    const result=spawnSync(process.execPath,['--import','tsx',path.join(__dirname,'family-fill-fixtures.ts'),mode],{cwd:path.resolve(__dirname,'../../..'),encoding:'utf8',windowsHide:true,maxBuffer:8000000,timeout:120000,env:{...process.env,IMPORT_LAB_ROOT:root,IMPORT_MODEL_CHAIN:'test/dummy',SKIP_DB_SETUP:'true',NODE_OPTIONS:'--require='+JSON.stringify(path.join(__dirname,'offline-guard.cjs'))}})
    if(result.status!==0)throw new Error(result.stdout+'\n'+result.stderr)
    expect(result.stdout).toContain('PASS family-fill')
  } finally {fs.rmSync(root,{recursive:true,force:true})}
},130000)

test('family fill retains required site-header and site-footer through the production importer',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'import-lab-family-regions-'))
  try {
    const result=spawnSync(process.execPath,['--import','tsx',path.join(__dirname,'family-fill-fixtures.ts'),'required-regions'],{cwd:path.resolve(__dirname,'../../..'),encoding:'utf8',windowsHide:true,maxBuffer:8000000,timeout:120000,env:{...process.env,IMPORT_LAB_ROOT:root,IMPORT_MODEL_CHAIN:'test/dummy',SKIP_DB_SETUP:'true',NODE_OPTIONS:'--require='+JSON.stringify(path.join(__dirname,'offline-guard.cjs'))}})
    if(result.status!==0)throw new Error(result.stdout+'\n'+result.stderr)
    expect(result.stdout).toContain('PASS family-fill required header and footer through production importer')
  } finally {fs.rmSync(root,{recursive:true,force:true})}
},130000)

test('family and production share block payloads and request settings; only catalogue messages differ',()=>{
  const familyRoot=fs.mkdtempSync(path.join(os.tmpdir(),'import-lab-family-side-'))
  const productionRoot=fs.mkdtempSync(path.join(os.tmpdir(),'import-lab-production-side-'))
  const launch=(file:string,mode:string,root:string)=>spawnSync(process.execPath,['--import','tsx',path.join(__dirname,file),mode],{cwd:path.resolve(__dirname,'../../..'),encoding:'utf8',windowsHide:true,maxBuffer:8000000,timeout:120000,env:{...process.env,IMPORT_LAB_ROOT:root,IMPORT_MODEL_CHAIN:'test/dummy',SKIP_DB_SETUP:'true',NODE_OPTIONS:'--require='+JSON.stringify(path.join(__dirname,'offline-guard.cjs'))}})
  try {
    for(const [file,mode,root] of [['family-fill-fixtures.ts','valid-repair',familyRoot],['production-fixtures.ts','complete',productionRoot]]){
      const result=launch(file,mode,root)
      if(result.status!==0)throw new Error(result.stdout+'\n'+result.stderr)
    }
    const calls=(root:string,arm:string,run:string)=>fs.readdirSync(path.join(root,'arms','comparison-fixture',arm,run,'calls')).map(file=>JSON.parse(fs.readFileSync(path.join(root,'arms','comparison-fixture',arm,run,'calls',file),'utf8')))
    const extracts=(root:string,arm:string,run:string)=>calls(root,arm,run).filter(call=>call.kind==='extract').sort((a,b)=>a.sectionKey.localeCompare(b.sectionKey)).map(call=>call.request)
    const family=extracts(familyRoot,'family-fill','fixture'),production=extracts(productionRoot,'blocks-production','complete')
    expect(family).toHaveLength(3)
    expect(production).toHaveLength(3)
    expect(createHash('sha256').update(JSON.stringify(production)).digest('hex')).toBe('5c55bee3bbf04b2bf4e3d95d2c3c5182657e740a7444ff20b636bba702f77446')
    for(let index=0;index<family.length;index++){
      for(const field of ['model','temperature','max_tokens','response_format','reasoning'])expect(family[index][field]).toEqual(production[index][field])
      expect(family[index].messages[0]).toEqual(production[index].messages[0])
      const payload=(request:any)=>request.messages[2].content.split('Extract this single section:\n')[1]
      expect(payload(family[index])).toEqual(payload(production[index]))
      expect(family[index].messages[1].content).toContain('FAMILY CONTENT CONTRACTS')
      expect(family[index].messages[1].content).toContain('Every component item MUST include component, confidence, and content.')
      expect(family[index].messages[1].content).toContain('=== PAGE METADATA EXTRACTION ===')
      expect(production[index].messages[1].content).not.toContain('FAMILY CONTENT CONTRACTS')
    }
    const readRun=(root:string,arm:string,run:string)=>JSON.parse(fs.readFileSync(path.join(root,'arms','comparison-fixture',arm,run,'run.json'),'utf8'))
    expect(readRun(familyRoot,'family-fill','fixture').comparisonKey).not.toBe(readRun(productionRoot,'blocks-production','complete').comparisonKey)
  } finally {fs.rmSync(familyRoot,{recursive:true,force:true});fs.rmSync(productionRoot,{recursive:true,force:true})}
},130000)

test('set C template equivalents use only each family’s first production type', async () => {
  const { familyCatalogueOverride } = await import('./family-fill')
  const { DetectionService } = await import('@/lib/studio/import/web-detection')
  const { override } = await familyCatalogueOverride()
  expect(override.templateEquivalent('content')).toBe('text-block')
  expect(override.templateEquivalent('collection')).toBe('card-grid')
  const service = new DetectionService() as any
  const component = [{ component: 'collection', type: 'collection', location: 'main' }]
  expect(service.templateAllowsDetectedComponents({ requiredRegions: [{ region: 'main', allowedComponents: ['card-grid'] }] }, component, override.templateEquivalent)).toBe(true)
  expect(service.templateAllowsDetectedComponents({ requiredRegions: [{ region: 'main', allowedComponents: ['text-block'] }] }, component, override.templateEquivalent)).toBe(false)
})

test('invented family page uses production-equivalent regions before generic template assembly', async () => {
  const { override } = await familyCatalogueOverride()
  const { DetectionService } = await import('@/lib/studio/import/web-detection')
  const generic = (await getPageCatalogSummary()).templates.find(template => template.templateKey === 'core/generic-default')!
  const service = new DetectionService() as any
  const source = [
    { type: 'site-header', content: { placement: 'header' } },
    { type: 'local-nav', content: { placement: 'sidebar', links: [{ label: 'Overview', type: 'internal', path: '/overview', pageId: 'overview' }] } },
    { type: 'hero', content: { placement: 'main', heading: 'Invented workshop' } },
    { type: 'content', content: { heading: 'Details' } },
    { type: 'site-footer', content: { placement: 'footer' } }
  ]
  const family = source.map(({ type, content }) => ({ type, component: type, content, location: override.location(type, content) }))
  const production = source.map(({ type }) => ({ type: override.templateEquivalent(type), location: inferLocationFromType(override.templateEquivalent(type)) }))
  expect(family.map(component => component.location)).toEqual(production.map(component => component.location))
  expect(family[1].location).toBe('header')
  expect(service.templateAllowsDetectedComponents(generic, family, override.templateEquivalent)).toBe(true)
  expect(service.selectPageTemplate({ templates: [generic], homeEligibleTemplates: [] }, 'https://example.com/invented-workshop', family, override.templateEquivalent).templateKey)
    .toBe('core/generic-default')
})
