import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { loadPages } from './pages'
import { launchLabBrowser, browserExecutable, evaluateLocal } from './lab-browser'
import { extractPageEvidence, normalizeText } from './metrics'
import { instrumentHtml, resolveAnchor, proposeFromGeometry, type Geometry, type GeometryDocument, type BlockProposal, UNSTYLED_ISSUE } from './block-proposal'
import { argumentsForPhase2, labelDirectory, slug, atomicJson } from './labels'
import { dataRoot, readJson, digest, main, errorRecord } from './storage'

export async function propose(page: string, javascriptEnabled: boolean | undefined=undefined, offline=false, fromGeometry=false): Promise<BlockProposal> {
  javascriptEnabled ??= (await loadPages(false))[page]?.renderWithJavaScript ?? true
  const directory=labelDirectory(page)
  await fs.mkdir(directory,{recursive:true})
  let result: BlockProposal={version:1,page,snapshotSha256:'',finalUrl:'',javascriptEnabled,renderedHeight:0,viewportWidth:1440,blocks:[],issues:[],status:'failed'}
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  try {
    if(fromGeometry) {
      const geometry=await readJson<GeometryDocument>(path.join(directory,'geometry.json'))
      if(geometry.page!==page)throw new Error('Geometry page does not match requested page')
      result=proposeFromGeometry(geometry)
      printSummary(result)
      return result
    }
    const saved=path.join(dataRoot(),'pages',slug(page)), html=await fs.readFile(path.join(saved,'page.html'),'utf8'), manifest=await readJson(path.join(saved,'manifest.json'))
    if (digest(html)!==manifest.sha256) throw new Error('Saved HTML checksum mismatch')
    result.snapshotSha256=manifest.sha256; result.finalUrl=manifest.finalUrl
    const prepared=instrumentHtml(html,manifest.finalUrl)
    if(browserExecutable())result.issues.push('Explicit Chromium executable: '+browserExecutable())
    browser=await launchLabBrowser()
    const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,javaScriptEnabled:javascriptEnabled,serviceWorkers:'block',bypassCSP:true})
    if (offline) await context.route('**/*', route=>{
      const url=new URL(route.request().url())
      if (url.hostname==='127.0.0.1' || url.protocol==='data:') return route.continue()
      result.issues.push('Offline resource blocked: '+url.href); return route.abort()
    })
    const tab=await context.newPage()
    tab.on('pageerror',error=>result.issues.push('Page script error: '+error.message))
    result.stylesheetFailures=[]
    const pending=new Set<import('playwright').Request>()
    let lastActivity=Date.now()
    const failedStylesheet=(url:string,reason:string)=>{
      result.stylesheetFailures!.push({url,reason})
      result.issues.push('Stylesheet failed: '+url+' '+reason)
    }
    tab.on('request',request=>{pending.add(request);lastActivity=Date.now()})
    tab.on('requestfinished',request=>{pending.delete(request);lastActivity=Date.now()})
    tab.on('requestfailed',request=>{
      pending.delete(request);lastActivity=Date.now()
      const reason=request.failure()?.errorText || 'unknown request failure'
      if(request.resourceType()==='stylesheet')failedStylesheet(request.url(),reason)
      else result.issues.push('Resource failed: '+request.url()+' '+reason)
    })
    tab.on('response',response=>{
      if(response.status()<400)return
      if(response.request().resourceType()==='stylesheet')failedStylesheet(response.url(),'HTTP '+response.status())
      else result.issues.push('Resource HTTP '+response.status()+': '+response.url())
    })
    const documentUrl=new URL(manifest.finalUrl)
    documentUrl.hash=''
    let fulfilled=false
    await tab.route(url=>url.href===documentUrl.href,async route=>{
      if(!fulfilled && route.request().isNavigationRequest() && route.request().frame()===tab.mainFrame()) {
        fulfilled=true
        await route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:prepared.html})
      } else await route.fallback()
    })
    await tab.goto(manifest.finalUrl,{waitUntil:'load',timeout:30000})
    await tab.evaluate(async()=>{await Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,1000))])})
    const before=await tab.evaluate(()=>document.documentElement.scrollHeight)
    const sweepStarted=Date.now(),deadline=sweepStarted+10000,step=tab.viewportSize()!.height
    let y=0,steps=0,settled=false
    while(Date.now()<deadline) {
      const height=await tab.evaluate(()=>document.documentElement.scrollHeight)
      y=Math.min(y,Math.max(0,height-step))
      await tab.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y)
      steps++
      await tab.waitForTimeout(Math.min(100,Math.max(1,deadline-Date.now())))
      if(y+step>=height) {
        while(Date.now()<deadline && (pending.size>0 || Date.now()-lastActivity<500))
          await tab.waitForTimeout(Math.min(100,Math.max(1,deadline-Date.now())))
        const current=await tab.evaluate(()=>document.documentElement.scrollHeight)
        if(current<=y+step){settled=Date.now()<deadline;break}
      }
      y+=step
    }
    await tab.evaluate(()=>scrollTo({top:0,behavior:'instant'}))
    await tab.waitForTimeout(100)
    result.lazyContent={durationMs:Date.now()-sweepStarted,steps,bounded:!settled}
    if(!settled)result.issues.push('Lazy-content sweep reached its 10000ms limit')
    // Count source styling before adding the animation-freeze stylesheet.
    result.styling=await tab.evaluate(()=>{
      let applied=0,inline=0,inaccessible=0
      for(const sheet of Array.from(document.styleSheets)) {
        if(sheet.disabled || (sheet.media.mediaText && !matchMedia(sheet.media.mediaText).matches))continue
        try {
          if(sheet.cssRules.length>0){applied++;if(sheet.ownerNode instanceof HTMLStyleElement)inline++}
        } catch {inaccessible++}
      }
      return {declared:document.querySelectorAll('link[rel~="stylesheet"],style').length,applied,inline,inaccessible}
    })
    result.styling.declared=Math.max(prepared.declaredStylesheets,result.styling.declared)
    if(result.styling.declared>0 && result.styling.applied===0)result.issues.push(UNSTYLED_ISSUE)
    await tab.evaluate(css=>{const style=document.createElement('style');style.textContent=css;document.head.append(style)},'*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}')
    const rendered=await evaluateLocal(tab,({marker}:{marker:string})=>{
      const boxes=(el:Element)=>{const r=el.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height}}
      const seen:Record<string,number>={}; document.querySelectorAll('['+marker+']').forEach(el=>{const key=el.getAttribute(marker)!;seen[key]=(seen[key]||0)+1})
      let serial=0
      const details:Record<string,{html:string;text:string;headings:string[];repeatedChildren:Array<{signature:string;count:number}>;anchorKey:string|null}>={}
      const visible=(el:Element)=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&s.contentVisibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0}
      const walk=(el:Element,region:'header'|'main'|'footer',parentVisible=true,inMain=false):any=>{
        const tag=el.tagName.toLowerCase(); if(!inMain&&(tag==='header'||el.getAttribute('role')==='banner'))region='header';else if(!inMain&&(tag==='footer'||el.getAttribute('role')==='contentinfo'))region='footer';else if(tag==='main'||el.getAttribute('role')==='main'){region='main';inMain=true}
        const key=String(++serial),isVisible=parentVisible&&visible(el)&&!['script','style','template','noscript'].includes(tag)
        const signature=(child:Element)=>child.tagName.toLowerCase()+'>'+Array.from(child.children).map(c=>c.tagName.toLowerCase()).join(',')
        const repeatedChildren:Array<{signature:string;count:number}>=[]; for(const parent of [el,...Array.from(el.querySelectorAll('*'))]) { const counts:Record<string,number>={};Array.from(parent.children).filter(visible).forEach(child=>{const s=signature(child);counts[s]=(counts[s]||0)+1});for(const [signature,count] of Object.entries(counts))if(count>1)repeatedChildren.push({signature:parent.tagName.toLowerCase()+(parent.id?'#'+parent.id:'')+' / '+signature,count}) }
        const text=(el as HTMLElement).innerText || '',anchorKey=el.getAttribute(marker)
        details[key]={html:el.outerHTML,text,headings:[...(/^h[1-6]$/.test(tag)?[el]:[]),...Array.from(el.querySelectorAll('h1,h2,h3,h4,h5,h6'))].filter(visible).map(e=>(e as HTMLElement).innerText),repeatedChildren,anchorKey:anchorKey&&seen[anchorKey]===1?anchorKey:null}
        const ownTextLength=Array.from(el.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent?.trim() || '').join('').length
        return {key,tag,id:el.id,classes:Array.from(el.classList),role:el.getAttribute('role') || '',anchorKey:details[key].anchorKey,ownTextLength,region,box:boxes(el),visible:isVisible,ownContent:ownTextLength>0,meaningful:Boolean(text.trim()||el.querySelector('img,picture,video,svg,input')||['img','svg','video','input'].includes(tag)||getComputedStyle(el).backgroundImage!=='none'),children:Array.from(el.children).map(c=>walk(c,region,isVisible,inMain))}
      }
      const tree=walk(document.body,'main')
      return {tree,details,height:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight)}
    },{marker:prepared.marker})
    result.renderedHeight=rendered.height
    if(before!==rendered.height)result.issues.push('Page height changed during lazy-content sweep: '+before+' -> '+rendered.height)
    await tab.screenshot({path:path.join(directory,'screenshot.png'),fullPage:true})
    const enrich=(node:Geometry):Geometry=>{
      const detail=rendered.details[node.key],anchor=detail.anchorKey?prepared.anchors[detail.anchorKey] || null:null
      const evidence=extractPageEvidence(detail.html,prepared.baseUrl)
      return {...node,evidence:{anchor,anchorResolved:!!anchor&&!!resolveAnchor(html,anchor),text:normalizeText(detail.text),
        images:evidence.images.map(i=>i.url),links:evidence.links.map(l=>l.url),headings:detail.headings.map(normalizeText),repeatedChildren:detail.repeatedChildren},children:node.children.map(enrich)}
    }
    const {blocks:_,status:__,...metadata}=result
    const geometry:GeometryDocument={...metadata,tree:enrich(rendered.tree)}
    await atomicJson(path.join(directory,'geometry.json'),geometry)
    // Both paths consume exactly the saved document; proposing never depends on a live browser.
    result=proposeFromGeometry(await readJson<GeometryDocument>(path.join(directory,'geometry.json')))
    printSummary(result)
  } catch(error) { result.issues.push(JSON.stringify(errorRecord(error))); throw error }
  finally { await browser?.close(); await atomicJson(path.join(directory,'blocks.json'),result); for(const issue of result.issues)console.warn(issue) }
  return result
}
function printSummary(result:BlockProposal) {
  const count=result.blocks.length,tallest=Math.max(0,...result.blocks.map(b=>b.box.height))
  const underCut=result.issues.filter(issue=>issue.startsWith('probably under-cut:')).length
  const resolved=result.blocks.filter(b=>b.anchorResolved).length
  console.log(result.page+': '+count+' blocks; tallest '+tallest+'px; probably under-cut '+underCut+'; resolved anchors '+resolved+'/'+count+' ('+(count?(100*resolved/count).toFixed(1):'n/a')+'%)')
}
if(require.main===module)main(async()=>{const args=argumentsForPhase2(['--page','--no-js','--offline','--from-geometry'],['--no-js','--offline','--from-geometry']);await propose(slug(args['--page']||''),args['--no-js'] ? false : undefined,!!args['--offline'],!!args['--from-geometry'])})
