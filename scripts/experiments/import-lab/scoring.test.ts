/** @jest-environment node */
import { matchComponents, countItems } from './scoring'
import { block, label, entry, sheet, component, scoreFixture as scoreSheet } from './phase2-fixtures'
const url='https://example.com/garden'
describe('content matching',()=>{
  test('matches by content rather than type or location',()=>{const result=matchComponents([block()], [{...component,type:'footer',location:'footer'}],url);expect(result.matches[0].primaryBlockId).toBe('hero')})
  test('ignores bookkeeping and lists extras',()=>{expect(matchComponents([block()],[{type:'hero',metadata:{region:block().text}}],url).extra).toEqual([0])})
  test.each(['images','links'] as const)('matches exact %s with no shared text',kind=>{const source=block({text:'',headings:[],[kind]:['https://example.com/item.png']});const content=kind==='images'?{image:'/item.png'}:{href:'/item.png'};expect(matchComponents([source],[{type:'card-grid',content}],url).extra).toEqual([])})
  test('uses strongest overlap and deterministic document order for ties',()=>{const blocks=[block({id:'first'}),block({id:'second',text:'start growing'})];expect(matchComponents(blocks,[component],url).matches[0].primaryBlockId).toBe('first')})
  test('flags one component spanning two blocks',()=>{const blocks=[block({id:'first',text:'first unique paragraph with several words here'}),block({id:'second',text:'second distinct paragraph with other words here'})];const result=matchComponents(blocks,[{type:'hero',content:{text:blocks.map(b=>b.text).join(' ')}}],url);expect(result.merged).toHaveLength(1);expect(result.merged[0].blockIds).toEqual(['first','second'])})
  test('shared links alone do not establish a merge',()=>{const blocks=[block({id:'first',links:['https://example.com/']}),block({id:'second',text:'wholly unrelated footer words on this page',links:['https://example.com/']})];expect(matchComponents(blocks,[{...component,content:{...component.content,href:'https://example.com/'}}],url).merged).toEqual([])})
  test('unreviewed matches are not extras or scored blocks',()=>{const result=scoreSheet(sheet([entry({status:'draft'})]),[component],url);expect(result.rows).toEqual([]);expect(result.unreviewedBlocks).toBe(1);expect(result.unreviewedComponents).toEqual([0]);expect(result.extra).toEqual([])})
  test('found collection counts, mismatches and missing collection stay distinct',()=>{
    const answer=sheet([entry({label:label({expected:{headings:[],itemCount:2,itemKind:'cards',hasImage:false,ctaLabels:[]}})})])
    const counted=scoreSheet(answer,[{...component,content:{...component.content,cards:[{},{}]}}],url)
    expect(counted.rows[0].checks.C6.passed).toBe(true)
    const mismatch=scoreSheet(answer,[{...component,content:{...component.content,cards:[{}]}}],url)
    expect(mismatch.rows[0].checks.C6.passed).toBe(false)
    expect(mismatch.itemCountMismatches).toHaveLength(1)
    expect(scoreSheet(answer,[component],url).rows[0].checks.C6).toMatchObject({passed:null,structureUnknown:true,detail:expect.stringContaining('structure-unknown')})
    const noKind=sheet([entry({label:label({expected:{headings:[],itemCount:2,itemKind:null,hasImage:false,ctaLabels:[]}})})])
    expect(scoreSheet(noKind,[component],url).rows[0].checks.C6).toMatchObject({passed:null,structureUnknown:true,detail:expect.stringContaining('structure-unknown')})
    expect(countItems([{type:'card-grid',content:{cards:[]}}],'cards').count).toBe(0)
    expect(countItems([{type:'card-grid',content:{cards:[{links:[{},{}]}],metadata:{cards:[{}]}}}],'cards').count).toBe(1)
    expect(countItems([{type:'card-grid',content:{cards:[{}]},props:{cards:[{}]}}],'cards')).toMatchObject({count:null,reason:expect.stringContaining('Ambiguous')})
  })
  test('ignored imports are junk and multiple matches are reported as splits',()=>{
    const ignored=sheet([entry({label:label({ignore:true,ignoreReason:'Fixture decoration'})})])
    expect(scoreSheet(ignored,[component],url).rows[0].verdict).toBe('should have been ignored')
    const split=scoreSheet(sheet(),[component,component],url).rows[0]
    expect(split.split).toBe(true)
    expect(split.structuralErrors).toContain('Unexpected split')
    expect(scoreSheet(ignored,[],url).rows[0]).toMatchObject({verdict:'correct',ignored:true})
    expect(scoreSheet(ignored,[],url).rows[0].checks.C6.structureUnknown).toBe(false)
    expect(scoreSheet(sheet(),[],url).rows[0].checks.C6.structureUnknown).toBe(false)
  })
  test('allowed splits require the exact component type multiset',()=>{
    const answer=sheet([entry({label:label({containsMultipleComponents:true,componentTypes:['hero','hero']})})])
    expect(scoreSheet(answer,[component,component],url).rows[0]).toMatchObject({split:true,splitAllowed:true,checks:{C1:{passed:true}}})
    expect(scoreSheet(answer,[component,{...component,type:'footer'}],url).rows[0].checks.C1.passed).toBe(false)
  })
  test('sentence and label punctuation at phrase boundaries match',()=>{
    const sentence='We offer clear practical help for every local family.'
    const source={text:[{text:sentence,region:'main' as const}],headings:[],links:[{url:'https://example.com/help',label:'Ask our team.'}],images:[],wordCount:9,sourceText:sentence+' Ask our team.'}
    const answer=sheet([entry({block:block({text:sentence,links:['https://example.com/help'],headings:[]})})])
    const output={type:'hero',content:{body:sentence+' More details follow.',link:{href:'/help',label:'Ask our team.',description:'A helpful description follows.'}}}
    const row=scoreSheet(answer,[output],url,{evidence:[source]}).rows[0]
    expect(row.checks.C2.passed).toBe(true)
    expect(row.checks.C4.passed).toBe(true)
    expect(scoreSheet(answer,[{type:'hero',content:{bodyHtml:'<p>'+sentence+'</p><p>More details follow.</p>',link:output.content.link}}],url,{evidence:[source]}).rows[0].checks.C2.passed).toBe(true)
  })
})
