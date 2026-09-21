/** @jest-environment node */
import { probabilityBand, scorePicks } from './pick-score'
import { comparisonSheet } from './phase3-fixtures'
import { mapLimited } from './call-recording'
import { callTotals } from './summary'
import { changeSheet } from './review-server'

const ranks=(a:number,b:number,c:number)=>[{type:'text-block',probability:a},{type:'hero-simple',probability:b},{type:'card-grid',probability:c}]
test('all probability boundaries and top-three scoring retain counts and every miss',()=>{
  expect([0,0.1999,0.2,0.4,0.6,0.8,1].map(probabilityBand)).toEqual([0,0,1,2,3,4,4])
  const sheet=comparisonSheet()
  const first={blockId:sheet.entries[0].block.id,order:1,distribution:Object.fromEntries(ranks(0.9,0.05,0.05).map(r=>[r.type,r.probability])),ranked:ranks(0.9,0.05,0.05),multipleProbability:0.1,allowedTypes:['text-block'],branch:'dominant',issues:[]}
  const miss={...first,blockId:sheet.entries[1].block.id,ranked:ranks(0.2,0.6,0.2).sort((a,b)=>b.probability-a.probability)}
  const score=scorePicks(sheet,[first,miss])
  expect(score.top1).toBe(1);expect(score.top3).toBe(2);expect(score.count).toBe(2)
  expect(score.confusions).toHaveLength(1);expect(score.excluded).toHaveLength(1)
  expect(score.bands.reduce((n,b)=>n+b.count,0)).toBe(2)
})
test('telemetry distinguishes unknown reasoning and cost from measured zero',()=>{
  const t=callTotals([{status:'complete',kind:'extract',usage:{total_tokens:12,completion_tokens:4},cost:null},{status:'planned',kind:'extract'}])
  expect(t.calls).toBe(1);expect(t.planned).toBe(1);expect(t.reasoningTokens.known).toBe(0);expect(t.answerTokens.known).toBe(0);expect(t.cost.known).toBe(0)
})
test('review attribution is explicit and old sheets stay readable',()=>{
  const sheet=comparisonSheet();delete sheet.entries[0].reviewedBy
  const changed=changeSheet(sheet,{action:'correct',blockId:sheet.entries[0].block.id,label:sheet.entries[0].label,reviewedBy:'owner'},['text-block'])
  expect(changed.entries[0].reviewedBy).toBe('owner');expect(sheet.entries[0].reviewedBy).toBeUndefined()
  expect(()=>changeSheet(sheet,{action:'correct',blockId:sheet.entries[0].block.id,label:sheet.entries[0].label,reviewedBy:''},['text-block'])).toThrow('reviewedBy')
})
test('bounded work records independent failures without losing ordering',async()=>{
  const results=await mapLimited([1,2,3],2,async n=>{if(n===2)throw new Error('fixture failure');return n})
  expect(results.map(r=>r.status)).toEqual(['fulfilled','rejected','fulfilled'])
})
