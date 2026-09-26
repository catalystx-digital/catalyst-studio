/** @jest-environment node */
import {checkContent,scoreSheet} from './scoring'
import {labelForFamilySet,validateFamilies} from './families'
import type {SourceEvidence} from './source-evidence'
import {comparisonBlocks} from './phase3-fixtures'
import catalogue from './component-families.json'

const families=validateFamilies({sets:{C:{collection:{description:'Repeated items',types:['card-grid']}}}},['card-grid']).C
const image='https://example.com/invented-picture.svg',target='https://example.com/invented-detail'
const label:any={acceptableFamilies:['collection'],familiesInOrder:['collection'],multiple:false,itemKind:'item',itemCount:2,decorativeImages:[]}
const evidence:SourceEvidence={text:[{text:'Invented collection of workshop ideas',region:'main'}],headings:['Invented collection of workshop ideas'],links:[{url:target,label:'Read detail'}],images:[{addresses:[image],width:100,height:100,kind:'image'}],wordCount:14,sourceText:'Invented collection of workshop ideas First idea Second idea Read detail A small idea for practice'}
const content={heading:'Invented collection of workshop ideas',links:[{label:'More',url:'https://example.com/more',emphasis:'plain' as const,children:[{label:'Read detail',url:target,emphasis:'plain' as const}]}],items:[{title:'First idea',body:'<p>A small idea for practice</p>',media:{kind:'image',url:image,alt:'First idea'}},{title:'Second idea'}]}
test('family shape satisfies C1–C7, including nested link and item picture',()=>{
  const block={...comparisonBlocks()[0],text:evidence.text[0].text,headings:evidence.headings,images:[image],links:[target]}
  const component={type:'collection',placement:'main',content}
  const checks=checkContent(block,label,[component],'https://example.com/',families,evidence)
  expect(Object.values(checks).map(check=>check.passed)).toEqual([true,true,true,true,true,true,true])
  expect(checkContent(block,label,[{...component,content:{...content,items:content.items.slice(0,1)}}],'https://example.com/',families,evidence).C6.passed).toBe(false)
  expect(checkContent(block,label,[{...component,content:{...content,links:[]}}],'https://example.com/',families,evidence).C4.passed).toBe(false)
  expect(checkContent(block,label,[{...component,content:{...content,items:content.items.map(({media,...item})=>item)}}],'https://example.com/',families,evidence).C5.passed).toBe(false)
})
test('family item counts and sparse text, image-address links, and settings score correctly',()=>{
  const block={...comparisonBlocks()[0],text:'Welcome Hello Engineer',headings:[],images:[],links:['https://example.com/icon.svg']}
  const sparse={type:'collection',content:{eyebrow:'Welcome',intro:'Hello',items:[{subtitle:'Engineer',links:[{url:'https://example.com/icon.svg'}]}],settings:{height:'full viewport'}}}
  const sparseLabel={...label,itemKind:'card',itemCount:1}
  const sparseEvidence={...evidence,text:[{text:'Welcome Hello Engineer',region:'main' as const}],headings:[],links:[{url:'https://example.com/icon.svg',label:''}],images:[],sourceText:'Welcome Hello Engineer'}
  const checks=checkContent(block,sparseLabel,[sparse],'https://example.com/',families,sparseEvidence)
  expect(checks.C2.passed).toBe(true)
  expect(checks.C4.passed).toBe(true)
  expect(checks.C6).toMatchObject({passed:true,produced:1})
  expect(checkContent(block,{...sparseLabel,itemKind:null},[sparse],'https://example.com/',families,sparseEvidence).C6).toMatchObject({passed:true,produced:1})
  expect(checks.C7.passed).toBe(true)
})

test('set D scores a historical stats label as collection; set C retains stats',()=>{
  const types=Object.values(catalogue.sets.C).flatMap(family=>family.types)
  const sets=validateFamilies(catalogue,types)
  const block=comparisonBlocks()[0]
  const historical={...label,family:'stats',acceptableFamilies:['stats'],familiesInOrder:['stats'],itemCount:null}
  const output=[{type:'collection',content:{items:[{title:'42',body:'Invented count'}],settings:{itemKind:'stat'}}}]
  expect(checkContent(block,historical,output,'https://example.com/',sets.D).C1).toMatchObject({passed:true,expected:['collection']})
  expect(checkContent(block,historical,output,'https://example.com/',sets.C).C1).toMatchObject({passed:false,expected:['stats']})
  const answer={version:2 as const,page:'invented',snapshotSha256:'fixture',proposalSha256:'fixture',familySet:'C',entries:[{blockId:block.id,order:block.order,status:'agreed',label:historical}]}
  const matched=[{...output[0],content:{...output[0].content,heading:block.text}}]
  expect(scoreSheet(answer,matched,'https://example.com/',{families:sets.D,blocks:[block]}).rows[0]).toMatchObject({acceptableFamilies:['collection'],checks:{C1:{passed:true}}})
  expect(scoreSheet(answer,matched,'https://example.com/',{families:sets.C,blocks:[block]}).rows[0]).toMatchObject({acceptableFamilies:['stats'],checks:{C1:{passed:false}}})
  const savedHistorical=[{...matched[0],type:'stats'}]
  expect(scoreSheet(answer,savedHistorical,'https://example.com/',{families:sets.D,blocks:[block]}).rows[0]).toMatchObject({acceptableFamilies:['collection'],producedFamilies:['collection'],checks:{C1:{passed:true}}})
  expect(labelForFamilySet({family:'stats',acceptableFamilies:['stats','pricing'],familiesInOrder:['stats','pricing']},'D')).toEqual({family:'collection',acceptableFamilies:['collection','collection'],familiesInOrder:['collection','collection']})
})
