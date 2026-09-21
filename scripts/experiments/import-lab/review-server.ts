import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import { dataRoot, readJson, main } from './storage'
import { catalogue, labelDirectory, directories, optionalJson, atomicJson, sha, slug, validateLabel, blankLabel, argumentsForPhase2, type Sheet, type Proposal } from './labels'
import { mergeBlocks } from './block-proposal'

async function loadReview(page:string) {
  const directory=labelDirectory(page),proposal=await readJson<Proposal>(path.join(directory,'blocks.json'))
  if(proposal.status!=='complete')throw new Error('Page rendering failed; inspect blocks.json')
  const answer=await optionalJson<Sheet>(path.join(directory,'answer-sheet.json')),draft=await optionalJson<Sheet>(path.join(directory,'draft.json'))
  const sheet=answer||draft||{version:1 as const,page,snapshotSha256:proposal.snapshotSha256,proposalSha256:sha(proposal),updatedAt:'',entries:proposal.blocks.map(block=>({block,status:'draft' as const,label:null,draftStatus:'manual' as const})),issues:['No draft exists; label each block manually',...proposal.issues]}
  if(sheet.snapshotSha256!==proposal.snapshotSha256||sheet.proposalSha256!==sha(proposal))throw new Error('Block proposals changed after labelling; restore the matching proposal before review')
  return {sheet,proposal,revision:sha(sheet),draftReasons:Object.fromEntries((draft?.entries||[]).map(e=>[e.block.id,e.label?.reason||null]))}
}
export function changeSheet(sheet:Sheet,body:any,types:string[]):Sheet {
  const next=structuredClone(sheet),index=next.entries.findIndex(e=>e.block.id===body.blockId),entry=next.entries[index]
  if(!entry)throw new Error('Block not found')
  if(body.action==='merge') {
    const following=next.entries[index+1]
    if(!following)throw new Error('There is no next block')
    const block=mergeBlocks(entry.block,following.block)
    next.entries.splice(index,2,{block,status:'draft',label:blankLabel(block),draftStatus:'manual'})
  } else if(body.action==='split') {
    if(entry.block.children.length<2)throw new Error('This block has no separate child blocks to split into')
    next.entries.splice(index,1,...entry.block.children.map(block=>({block,status:'draft' as const,label:blankLabel(block),draftStatus:'manual' as const})))
  } else if(body.action==='ignore') {
    entry.label=entry.label||blankLabel(entry.block);entry.label.ignore=true;entry.label.ignoreReason=typeof body.reason==='string'?body.reason:'';entry.status='draft'
  } else if(body.action==='approve'||body.action==='correct') {
    const label=validateLabel(body.label,types)
    if(body.action==='approve'&&(!entry.label||sha(label)!==sha(validateLabel(entry.label,types))))throw new Error('The label was changed. Use Save correction.')
    if(body.reviewedBy !== undefined && (typeof body.reviewedBy !== 'string' || !body.reviewedBy.trim()))throw new Error('reviewedBy must name the reviewer')
    entry.label=label;entry.status=body.action==='approve'?'approved':'corrected';entry.reviewedBy=body.reviewedBy?.trim()||'unspecified-reviewer'
  } else throw new Error('Unknown review action')
  next.entries.forEach((entry,i)=>entry.block.order=i+1)
  next.updatedAt=new Date().toISOString()
  return next
}
export async function startReviewServer(port=4777, reviewedBy="unspecified-reviewer") {
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid port')
  const types=await catalogue()
  let queue=Promise.resolve()
  const server=http.createServer(async(req,res)=>{
    const json=(status:number,value:unknown)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value))}
    try {
      const address=server.address(),actualPort=typeof address==='object'&&address?address.port:port,host='127.0.0.1:'+actualPort
      if(req.headers.host!==host){json(403,{error:'Use the 127.0.0.1 review address'});return}
      const url=new URL(req.url||'/','http://'+host)
      if(req.method==='GET'&&url.pathname==='/') {res.writeHead(200,{'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(await fs.readFile(path.join(__dirname,'review.html')));return}
      if(req.method==='GET'&&url.pathname==='/api/pages') {
        const pages=[...new Set([...await directories(path.join(dataRoot(),'pages')),...await directories(path.join(dataRoot(),'labels'))])].sort()
        json(200,await Promise.all(pages.map(async page=>{try{const {sheet}=await loadReview(page);return {page,total:sheet.entries.length,done:sheet.entries.filter(e=>e.status!=='draft').length,issues:sheet.issues}}catch(error){return {page,total:0,done:0,error:String(error)}}})));return
      }
      const page=slug(url.searchParams.get('page')||'')
      if(req.method==='GET'&&url.pathname==='/api/page'){json(200,{...await loadReview(page),catalogue:types});return}
      if(req.method==='GET'&&url.pathname==='/screenshot.png'){res.writeHead(200,{'content-type':'image/png','cache-control':'no-store'});res.end(await fs.readFile(path.join(labelDirectory(page),'screenshot.png')));return}
      if(req.method==='POST'&&url.pathname==='/api/review') {
        if(req.headers.origin&&req.headers.origin!=='http://'+host){json(403,{error:'Cross-origin writes are forbidden'});return}
        if(!req.headers['content-type']?.startsWith('application/json')){json(415,{error:'Send application/json'});return}
        let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>1024*1024)throw new Error('Review request too large')}
        const body=JSON.parse(raw)
        const job=queue.then(async()=>{
          const {sheet,revision}=await loadReview(page)
          if(body.revision!==revision){json(409,{error:'This page changed in another tab. Reload before saving.'});return}
          const next=changeSheet(sheet,{...body,reviewedBy:body.reviewedBy??reviewedBy},types.map(c=>c.type))
          await atomicJson(path.join(labelDirectory(page),'answer-sheet.json'),next,true)
          json(200,{sheet:next,revision:sha(next)})
        })
        queue=job.then(()=>undefined,()=>undefined)
        await job;return
      }
      json(404,{error:'Not found'})
    } catch(error) {
      console.error('Review request failed: '+String(error))
      if(!res.headersSent)json(400,{error:String(error)});else res.end()
      const eventsFile=path.join(dataRoot(),'labels','review-errors.json')
      try{const events=await optionalJson<any[]>(eventsFile)||[];events.push({at:new Date().toISOString(),method:req.method,path:req.url,error:String(error)});await atomicJson(eventsFile,events)}catch(recordError){console.error('Could not record review failure: '+String(recordError))}
    }
  })
  await new Promise<void>((resolve,reject)=>{const failed=(error:NodeJS.ErrnoException)=>reject(error.code==='EADDRINUSE'?new Error('Port '+port+' is already in use. Close the existing review server or choose --port with a different number.'):error);server.once('error',failed);server.listen(port,'127.0.0.1',()=>{server.off('error',failed);resolve()})})
  const address=server.address();console.log('Review: http://127.0.0.1:'+(typeof address==='object'&&address?address.port:port))
  return server
}
if(require.main===module)main(async()=>{const a=argumentsForPhase2(['--port','--reviewer']);await startReviewServer(Number(a['--port']||4777),a['--reviewer']||'unspecified-reviewer')})
