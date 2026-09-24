/** @jest-environment node */
import { scoreSheet } from './scoring'
import { block, component, sheet as oldSheet } from './phase2-fixtures'
import type { FamilySet } from './families'

const url='https://example.com/garden'
const families:FamilySet={set:'C',sha256:'fixture',entries:[{type:'hero',description:'',types:['hero','hero-split']},{type:'content',description:'',types:['text-block']},{type:'collection',description:'',types:['card-grid']}],byType:{hero:'hero','hero-split':'hero','text-block':'content','card-grid':'collection'}}
const label=(changes:Record<string,unknown>={})=>({family:'hero',acceptableFamilies:['hero'],multiple:false,familiesInOrder:[],placement:'main',ignore:false,ignoreReason:'',itemCount:null,itemKind:null,decorativeImages:[],reason:{a:'Invented',b:'Invented'},...changes})
const section=(id:string,order:number,changes:Record<string,unknown>={})=>({blockId:id,order,status:'agreed',label:label(changes)})
const answer=(entries:ReturnType<typeof section>[])=>({version:2 as const,page:'fixture',snapshotSha256:'fixture',proposalSha256:'fixture',familySet:'C',entries})

test('v2 checks families, multiple families, ignore, decoration and item count',()=>{
  const blocks=[block({id:'one',order:1,images:['https://example.com/pixel.png']}),block({id:'two',order:2,text:'Second invented section with unique content'}),block({id:'three',order:3,text:'Third invented section with unique content'})]
  const entries=[section('one',1,{decorativeImages:['https://example.com/pixel.png'],itemCount:2,itemKind:'cards'}),section('two',2,{multiple:true,familiesInOrder:['hero','content']}),section('three',3,{ignore:true,ignoreReason:'Invented decoration'})]
  const components=[{...component,type:'hero-split',content:{...component.content,cards:[{},{}]}},{type:'hero',content:{text:blocks[1].text}},{type:'text-block',content:{text:blocks[1].text}},{type:'hero',content:{text:blocks[2].text}}]
  const result=scoreSheet(answer(entries),components,url,{families,blocks})
  expect(result.rows[0].checks).toMatchObject({C1:{passed:true},C5:{passed:true},C6:{passed:true}})
  expect(result.rows[1].checks.C1.passed).toBe(true)
  expect(result.rows[2]).toMatchObject({ignored:true,verdict:'should have been ignored'})
  expect(result.scoredBlocks).toBe(2)
})

test('any disputed label field makes a block unsettled and excludes it from accuracy',()=>{
  const entry=section('one',1,{itemCount:{disputed:true,a:1,b:2}})
  const result=scoreSheet(answer([entry]),[component],url,{families,blocks:[block({id:'one',order:1})]})
  expect(result.rows[0].verdict).toBe('unsettled')
  expect(result.unsettledBlocks).toBe(1)
  expect(result.accuracy.total).toBe(0)
})

test('version-one answer sheets are rejected',()=>{
  expect(()=>scoreSheet(oldSheet() as any,[component],url,{families,blocks:[block()]})).toThrow(/version-2 answer sheet/i)
})
