/** @jest-environment node */
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createServer, type Server } from 'node:http'
import { execFileSync } from 'node:child_process'
import { fixtureHtml, blockFinderHtml, cspBlockHtml, cspBlockCss, lazyBlockHtml } from './phase2-fixtures'
import { digest } from './storage'
import { propose } from './propose-blocks'
import { resolveAnchor } from './block-proposal'
const browserDescribe=process.env.IMPORT_LAB_SKIP_BROWSER==='true'?describe.skip:describe
if(process.env.IMPORT_LAB_SKIP_BROWSER==='true')console.warn('Browser tests explicitly skipped: IMPORT_LAB_SKIP_BROWSER=true; no browser pass is claimed')
browserDescribe('local Chromium block proposal fixtures',()=>{
  const previous=process.env.IMPORT_LAB_ROOT
  let server:Server,origin:string
  const requests:string[]=[]
  beforeAll(async()=>{
    process.env.IMPORT_LAB_ROOT=await fs.mkdtemp(path.join(os.tmpdir(),'import-lab-browser-'))
    server=createServer((request,response)=>{
      requests.push(request.url!)
      if(request.url==='/fixtures/theme.css') {response.writeHead(200,{'content-type':'text/css'});response.end(cspBlockCss)}
      else if(request.url==='/lazy-copy' || request.url==='/extended-copy')setTimeout(()=>{response.writeHead(200,{'content-type':'text/plain'});response.end(request.url==='/lazy-copy'?'Garden content loaded after scrolling':'More garden content at the extended bottom')},200)
      else {response.writeHead(404);response.end('Fixture not found')}
    })
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
    origin='http://127.0.0.1:'+(server.address() as {port:number}).port
  })
  afterAll(async()=>{
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))
    await fs.rm(process.env.IMPORT_LAB_ROOT!,{recursive:true,force:true})
    if(previous===undefined)delete process.env.IMPORT_LAB_ROOT;else process.env.IMPORT_LAB_ROOT=previous
  })
  async function save(page:string,html:string,finalUrl='https://example.com/garden'){const dir=path.join(process.env.IMPORT_LAB_ROOT!,'pages',page);await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'page.html'),html);await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify({sha256:digest(html),finalUrl}))}
  test('keeps the sub-700px main container with two row candidates offline',async()=>{await save('_geometry',fixtureHtml);const result=await propose('_geometry',false,true);expect(result.blocks).toHaveLength(3);expect(result.blocks.map(b=>b.region)).toEqual(['header','main','footer']);expect(result.blocks.every(b=>b.anchorResolved&&resolveAnchor(fixtureHtml,b.anchor!))).toBe(true);expect(result.blocks[1].children).toHaveLength(2);expect(result.blocks[1].children.map(b=>b.text).join(' ')).toBe(result.blocks[1].text);expect(result.renderedHeight).toBeGreaterThanOrEqual(850);expect(result.issues.filter(issue=>!issue.startsWith('Explicit Chromium executable:'))).toEqual([])},30000)
  test('article headers and footers within main retain the main region',async()=>{const html=fixtureHtml.replace(/<main>[\s\S]*?<\/main>/,'<main><article><header style="height:100px">Article introduction</header><footer style="height:100px">Article credits</footer></article></main>');await save('_nested',html);const result=await propose('_nested',false,true);expect(result.blocks.filter(b=>b.region==='header')).toHaveLength(1);expect(result.blocks.filter(b=>b.region==='footer')).toHaveLength(1)},30000)
  test('script-created bands are kept with unresolved anchors',async()=>{const html=fixtureHtml.replace('</body>','<script>const section=document.createElement("section");section.style.cssText="height:100px;width:100%;background:white";section.innerText="A new dynamically inserted visual band";document.body.append(section)</script></body>');await save('_dynamic',html);const result=await propose('_dynamic',true,true);expect(result.blocks.some(b=>!b.anchorResolved&&b.text.includes('dynamically'))).toBe(true);expect(result.issues.join(' ')).toContain('anchors unresolved')},30000)
  test('tagless centred page ignores the spacer and keeps tiles and feature grids intact',async()=>{
    await save('_tagless',blockFinderHtml)
    const result=await propose('_tagless',false,true)
    expect(result.blocks.map(b=>b.region)).toEqual(['header','main','main','main','main','main','footer'])
    expect(result.blocks.map(b=>b.box.height)).toEqual([164,500,200,550,282,300,200])
    expect(result.blocks.every(b=>b.box.height<=700)).toBe(true)
    expect(result.blocks.every(b=>b.anchorResolved)).toBe(true)
    for(const block of result.blocks)for(const anchor of block.sourceAnchors || (block.anchor?[block.anchor]:[]))expect(resolveAnchor(blockFinderHtml,anchor)).not.toBeNull()
    expect(result.blocks[2].children).toEqual([])
    expect(result.blocks[3].children).toHaveLength(2)
    expect(result.blocks[3].children.every(b=>b.sourceAnchors?.length===2)).toBe(true)
    expect(result.issues.filter(issue=>!issue.startsWith('Explicit Chromium executable:'))).toEqual([])
    const geometry=JSON.parse(await fs.readFile(path.join(process.env.IMPORT_LAB_ROOT!,'labels','_tagless','geometry.json'),'utf8'))
    const nodes:any[]=[]
    const visit=(node:any)=>{nodes.push(node);node.children.forEach(visit)}
    visit(geometry.tree)
    expect(nodes.find(n=>n.id==='spacer')).toMatchObject({box:{height:21},ownTextLength:0,visible:true,meaningful:false})
    expect(nodes.find(n=>n.id==='content')).toMatchObject({tag:'div',box:{width:1170},classes:['content'],ownTextLength:0})
    expect(nodes.every(n=>'anchorKey' in n && 'ownTextLength' in n && 'visible' in n && 'children' in n)).toBe(true)
  },30000)
  test('--from-geometry reproduces browser blocks with no saved HTML and no usable browser',async()=>{
    await save('_replay_source',blockFinderHtml)
    const result=await propose('_replay_source',false,true)
    const directory=path.join(process.env.IMPORT_LAB_ROOT!,'labels','_replay_geometry')
    const geometry=JSON.parse(await fs.readFile(path.join(process.env.IMPORT_LAB_ROOT!,'labels','_replay_source','geometry.json'),'utf8'))
    await fs.mkdir(directory,{recursive:true})
    await fs.writeFile(path.join(directory,'geometry.json'),JSON.stringify({...geometry,page:'_replay_geometry'}))
    const output=execFileSync(process.execPath,['--require',path.join(__dirname,'offline-guard.cjs'),'--import','tsx',path.join(__dirname,'propose-blocks.ts'),'--page','_replay_geometry','--from-geometry'],{
      cwd:path.resolve(__dirname,'../../..'),encoding:'utf8',env:{...process.env,CHROMIUM_EXECUTABLE_PATH:'does-not-exist.exe'},timeout:30000,windowsHide:true
    })
    const replay=JSON.parse(await fs.readFile(path.join(directory,'blocks.json'),'utf8'))
    expect(replay).toEqual({...result,page:'_replay_geometry'})
    expect(output).toContain('7 blocks; tallest 550px; probably under-cut 0; resolved anchors 7/7 (100.0%)')
  },30000)
  test.each([true,false])('saved CSP document uses its final origin and relative local stylesheet (JS %s)',async javascriptEnabled=>{
    const page='_csp_'+javascriptEnabled,finalUrl=origin+'/fixtures/saved-page'
    await save(page,cspBlockHtml,finalUrl)
    const result=await propose(page,javascriptEnabled,true)
    expect(result.status).toBe('complete')
    expect(result.styling).toMatchObject({declared:1,applied:1,inline:0})
    expect(result.stylesheetFailures).toEqual([])
    expect(requests).toContain('/fixtures/theme.css')
    expect(requests).not.toContain('/fixtures/saved-page')
    expect(result.blocks[0].box).toMatchObject({width:600,height:420})
    expect(result.blocks[0].links).toContain(origin+'/fixtures/next')
    if(javascriptEnabled)expect(result.blocks[0].text).toContain('document origin: '+origin+' path: /fixtures/saved-page')
    expect(resolveAnchor(cspBlockHtml,result.blocks[0].anchor!)).not.toBeNull()
  },30000)
  test('a missing stylesheet records its reason and persists unstyled status on replay',async()=>{
    await save('_unstyled',cspBlockHtml.replace('./theme.css','./missing.css'),origin+'/fixtures/missing-page')
    const result=await propose('_unstyled',true,true)
    expect(result.status).toBe('unstyled')
    expect(result.issues).toContain('rendered without styling - blocks are not trustworthy')
    expect(result.styling).toMatchObject({declared:1,applied:0})
    expect(result.stylesheetFailures).toContainEqual({url:origin+'/fixtures/missing.css',reason:'HTTP 404'})
    expect(await propose('_unstyled',true,true,true)).toEqual(result)
  },30000)
  test('scroll sweep waits for lazy responses and follows a growing document before measuring',async()=>{
    await save('_lazy',lazyBlockHtml,origin+'/fixtures/lazy-page')
    const result=await propose('_lazy',true,true)
    expect(result.blocks.map(b=>b.text).join(' ')).toContain('garden content loaded after scrolling')
    expect(result.blocks.map(b=>b.text).join(' ')).toContain('more garden content at the extended bottom')
    expect(result.renderedHeight).toBe(7200)
    expect(result.lazyContent).toMatchObject({bounded:false})
    expect(result.lazyContent!.steps).toBeGreaterThanOrEqual(7)
    expect(result.lazyContent!.durationMs).toBeGreaterThanOrEqual(700)
    expect(result.lazyContent!.durationMs).toBeLessThan(11000)
    expect(result.blocks[0].box.y).toBe(0)
  },30000)
  test('--no-js leaves scroll-triggered scripts disabled',async()=>{
    await save('_lazy_no_js',lazyBlockHtml,origin+'/fixtures/lazy-no-js')
    const result=await propose('_lazy_no_js',false,true)
    expect(result.javascriptEnabled).toBe(false)
    expect(result.renderedHeight).toBe(4800)
    expect(result.blocks.map(b=>b.text).join(' ')).toContain('waiting for scroll')
    expect(result.blocks.map(b=>b.text).join(' ')).not.toContain('garden content loaded after scrolling')
  },30000)

  test('a blocked stylesheet records the request failure reason',async()=>{
    const html=cspBlockHtml.replace('./theme.css','https://example.invalid/theme.css')
    await save('_blocked_stylesheet',html,origin+'/fixtures/blocked-page')
    const result=await propose('_blocked_stylesheet',true,true)
    expect(result.status).toBe('unstyled')
    expect(result.stylesheetFailures).toContainEqual({url:'https://example.invalid/theme.css',reason:expect.stringMatching(/^net::ERR_/)})
  },30000)

})
