/** @jest-environment node */
import { blockEvidence } from './source-evidence'
import { block, entry, label, sheet, scoreFixture as scoreSheet } from './phase2-fixtures'
import type { Component } from './metrics'
import { absoluteUrl, extractPageEvidence, normalizeText } from './metrics'
import { validateFamilies } from './families'
import families from './component-families.json'

const url = 'https://example.test/page'
const paragraph = 'Families can discover welcoming activities nearby with practical guidance about access times locations and friendly people who help everyone participate throughout the year.'
const items = [1, 2, 3].map(n => ({title:`Item title ${n} here`, text:`This helpful item shares clear details about local options schedules support and ways families can take part together ${n}.`}))
const html = `<html><body><section id="fixture"><h2>Our services for families</h2><p>${paragraph}</p><ul>${items.map(i=>`<li><h3>${i.title}</h3><p>${i.text}</p></li>`).join('')}</ul><img width="300" height="200" src="/photo-small.jpg" srcset="/photo-small.jpg 300w, /photo-large.jpg 600w"><p><a href="/stories/one?utm_source=x">Read the full story</a></p></section></body></html>`
const sourceBlock = block({id:'fixture', anchor:{path:[0],tag:'section',id:'fixture',classes:[]},text:`Our services for families ${paragraph} ${items.map(i=>`${i.title} ${i.text}`).join(' ')} Read the full story`,images:['https://example.test/photo-small.jpg'],links:['https://example.test/stories/one?utm_source=x']})
const sourceSheet = sheet([entry({block:sourceBlock,label:label({bestType:'card-grid',acceptableTypes:['card-grid'],expected:{headings:[],itemCount:3,itemKind:'items',hasImage:false,ctaLabels:[]}})})])
const geometry = {tree:{anchorKey:'body',box:{width:800,height:800},children:[{anchorKey:'0',box:{width:600,height:600},children:[{anchorKey:'0.3',box:{width:300,height:200},children:[],evidence:{images:['https://example.test/photo-small.jpg']}}]}]}}
const content = {heading:'Our services for families',description:paragraph,items:items.map(i=>({title:i.title,text:i.text})),image:'/photo-large.jpg',label:'Read the full story',href:'/stories/one'}
const score = (value: Component[]) => scoreSheet(sourceSheet,value,url,{evidence:[blockEvidence(html,[],sourceBlock,geometry,url)]}).rows[0]

test('F1 mutations fail only their defined checks',()=>{
  const mutations: Array<[string,Component[],string[]]> = [
    ['M1',[{type:'card-grid',content}],[]],
    ['M2',[{type:'card-grid',content:{...content,heading:''}}],['C2','C3']],
    ['M3',[{type:'card-grid',content:{...content,heading:'',body:'Our services for families'}}],['C3']],
    ['M4',[{type:'card-grid',content:{...content,description:paragraph.split(' ').slice(0,10).join(' ')}}],['C2']],
    ['M5',[{type:'card-grid',content:{...content,href:undefined}}],['C4']],
    ['M6',[{type:'card-grid',content:{...content,href:undefined,label:undefined}}],['C2','C4']],
    ['M7',[{type:'card-grid',content:{...content,image:undefined}}],['C5']],
    ['M8',[{type:'card-grid',content:{...content,items:content.items.slice(0,2)}}],['C2','C3','C6']],
    ['M9',[{type:'card-grid',content:{...content,body:Array(30).fill('invented').join(' ')}}],['C7']],
    ['M10',[{type:'footer',content}],['C1']],
    ['M11',[],[]]
  ]
  for (const [name,components,expected] of mutations) {
    const row=score(components)
    expect(row.failedChecks.sort()).toEqual(expected.sort())
    if(name==='M11')expect(row.verdict).toBe('missed')
  }
})

test('image variants form groups, and hidden or tiny images do not count',()=>{
  const variant=`<html><head><style>.gone{display:none}</style></head><body><section id="fixture"><picture><source srcset="/wide.jpg 2x"><img src="/small.jpg" data-src="/lazy.jpg" width="300" height="200"></picture><img src="/slide.jpg" aria-hidden="true"><img src="/tiny.jpg" width="12" height="12"><div class="slick-cloned"><img src="/clone.jpg"></div><div class="gone"><img src="/gone.jpg"></div><div style="background-image:url('/back.jpg')"></div></section></body></html>`
  const b=block({id:'fixture',anchor:{path:[0],tag:'section',id:'fixture',classes:[]}})
  const g={tree:{anchorKey:'body',children:[{anchorKey:'0',children:[{anchorKey:'0.0',box:{width:300,height:200},children:[]},{anchorKey:'0.5',box:{width:200,height:100},children:[]}]}]}}
  const evidence=blockEvidence(variant,['.other{display:none}'],b,g,url)
  expect(evidence.images).toHaveLength(3)
  expect(evidence.images[0].addresses).toEqual(expect.arrayContaining(['https://example.test/wide.jpg','https://example.test/small.jpg','https://example.test/lazy.jpg']))
  expect(evidence.images.flatMap(i=>i.addresses)).not.toEqual(expect.arrayContaining(['https://example.test/tiny.jpg','https://example.test/clone.jpg','https://example.test/gone.jpg']))
})

test('visibility, headings, links and URLs share source rules',()=>{
  const variant=`<html><body><section id="fixture"><h2 class="sr-only">Hidden heading</h2><h2>VISIBLE HEADING</h2><div class="gone"><a href="/gone">Gone link</a></div><a href="/stories/one?utm_source=x">Read story</a><a href="https://example.test/stories/one/">Read story</a><a href="/stories/one?gclid=x">View the story</a><a href="mailto:INFO@EXAMPLE.TEST?subject=hello">Email us</a><a href="tel:+12345?ext=2">Call us</a></section></body></html>`
  const b=block({id:'fixture',anchor:{path:[0],tag:'section',id:'fixture',classes:[]}})
  const evidence=blockEvidence(variant,['.gone{display:none}'],b,{tree:{anchorKey:'body',children:[]}},url)
  expect(evidence.headings).toEqual(['visible heading'])
  expect(evidence.links.map(l=>l.url)).toEqual(['https://example.test/stories/one','https://example.test/stories/one','mailto:info@example.test','tel:+12345'])
  expect(evidence.links[1].label).toBe('view the story')
  expect(absoluteUrl('/stories/one/?fbclid=x',url,'link')).toBe('https://example.test/stories/one')
})

test('a logo image alone is not a required heading, but visible heading text is',()=>{
  const b=block({id:'fixture',anchor:{path:[0],tag:'section',id:'fixture',classes:[]},text:'Site name'})
  const logo='<html><body><section id="fixture"><h1><a href="/"><img src="/logo.png" alt="Site name" width="200" height="80"></a></h1></section></body></html>'
  const logoEvidence=blockEvidence(logo,[],b,geometry,url)
  expect(logoEvidence.headings).toEqual([])
  expect(logoEvidence.images[0].alt).toBe('Site name')
  expect(logoEvidence.sourceText).toContain('site name')
  const answer=sheet([entry({block:b})])
  const logoChecks=scoreSheet(answer,[{type:'hero',content:{image:'/logo.png',alt:'Site name'}}],url,{evidence:[logoEvidence]}).rows[0].checks
  expect(logoChecks.C3.passed).toBe(true)
  expect(logoChecks.C5.passed).toBe(true)
  expect(logoChecks.C7.passed).toBe(true)

  for(const heading of ['<h1>Real page title</h1>','<div role="heading">Real page title</div>']) {
    const titledBlock=block({...b,text:'Real page title'})
    const evidence=blockEvidence('<html><body><section id="fixture">'+heading+'</section></body></html>',[],titledBlock,geometry,url)
    expect(evidence.headings).toEqual(['real page title'])
    expect(scoreSheet(sheet([entry({block:titledBlock})]),[{type:'hero',content:{text:'Real page title'}}],url,{evidence:[evidence]}).rows[0].checks.C3.passed).toBe(false)
  }
})

test('header-like visibility is shared by page and block evidence',()=>{
  const variant='<html><body><div id="fixture" class="desktop-header"><h2>Helpful local services</h2><a href="/help">Ask for support</a><img src="/logo.jpg" width="200" height="80"></div><div class="hidden-panel"><h2>Hidden panel</h2><a href="/hidden">Hidden link</a><img src="/hidden.jpg"></div></body></html>'
  const b=block({id:'fixture',anchor:{path:[0],tag:'div',id:'fixture',classes:['desktop-header']}})
  const css=['.desktop-header{display:none}.hidden-panel{display:none}']
  const g={tree:{anchorKey:'body',children:[{anchorKey:'0',children:[]}]}}
  const page=extractPageEvidence(variant,url,css)
  const evidence=blockEvidence(variant,css,b,g,url)
  expect(page.visibleText.join(' ')).toContain('helpful local services')
  expect(evidence.headings).toEqual(['helpful local services'])
  expect(evidence.links.map(link=>link.url)).toEqual(['https://example.test/help'])
  expect(evidence.images.flatMap(group=>group.addresses)).toContain('https://example.test/logo.jpg')
  expect(page.visibleText.join(' ')).not.toContain('hidden panel')
})
test('a hidden header inside main inherits the full page visibility context',()=>{
  const variant='<html><body><header>Real page header</header><main><div class="site-header"><h2>Hidden service heading</h2><p>Hidden service text has several complete words.</p><a href="/hidden">Hidden service link</a><img src="/hidden.jpg"></div></main></body></html>'
  const b=block({id:'fixture',anchor:{path:[1,0],tag:'div',id:'',classes:['site-header']}})
  const e=blockEvidence(variant,['.site-header{display:none}'],b,{tree:{anchorKey:'body',children:[]}},url)
  expect(e.text).toEqual([])
  expect(e.sourceText).toBe('')
  expect(e.headings).toEqual([])
  expect(e.links).toEqual([])
  expect(e.images).toEqual([])
})

test('no anchor uses blocks.json evidence and records an issue',()=>{
  const b=block({anchor:null,anchorResolved:false,text:'A short saved paragraph from the block',images:['/saved.jpg'],links:['/saved']})
  const evidence=blockEvidence('<html></html>',[],b,{tree:{}},url)
  expect(evidence.issue).toContain('no resolved anchor')
  expect(evidence.images).toHaveLength(1)
  expect(scoreSheet(sheet([entry({block:b})]),[],url,{evidence:[evidence]}).issues).toContain(evidence.issue)
  expect(()=>blockEvidence('<html></html>',[],b,null,url)).toThrow('Missing geometry.json')
})

test('set C maps all 50 catalogue types exactly once and rejects an unknown output',()=>{
  const expected:Record<string,string[]>={
    'site-header':['navbar'],'site-footer':['footer'],'local-nav':['breadcrumbs','sidemenu'],
    hero:['hero-banner','hero-simple','hero-minimal','hero-with-image','hero-video','hero-carousel','hero-split','article-header'],
    content:['text-block','html-block','two-column','about-section','feature-showcase','author-bio','blog-post','contact-info'],
    collection:['card-grid','feature-grid','feature-list','team-grid','content-feed','blog-list','related-posts','timeline'],
    'logo-strip':['logo-cloud'],stats:['statistics'],testimonials:['testimonials','reviews','quote-block'],
    pricing:['pricing-table','pricing-card'],disclosure:['accordion','tabs'],cta:['cta-banner','cta-simple','cta-button-group'],
    form:['cta-with-form','contact-form','simple-form'],table:['data-table','chart','feature-comparison'],
    media:['image-gallery','video-player','video-embed','location-map']
  }
  expect(Object.fromEntries(Object.entries(families.sets.C).map(([name,group])=>[name,[...group.types]]))).toEqual(expected)
  const types=Object.values(expected).flat()
  expect(types).toHaveLength(50)
  expect(new Set(types).size).toBe(50)
  const set=validateFamilies(families,types).C
  expect(()=>scoreSheet(sourceSheet,[{type:'unmapped',content}],url,{families:set})).toThrow('Unknown catalogue type')
})

test('executable and inert elements do not contribute headings or link labels',()=>{
  const variant='<html><body><section id="fixture"><script><h2>Script heading</h2></script><style><h2>Style heading</h2></style><template><h2>Template heading</h2><a href="/hidden">Hidden label</a></template><noscript><h2>Fallback heading</h2></noscript><a href="/shown"><span>Shown label</span><script>Secret label</script></a></section></body></html>'
  const evidence=blockEvidence(variant,[],sourceBlock,geometry,url)
  expect(evidence.headings).toEqual([])
  expect(evidence.links).toEqual([{url:'https://example.test/shown',label:'shown label'}])
})

test('short visible text and attributes count for invented text independently of C2',()=>{
  const b=block({id:'fixture',anchor:{path:[0],tag:'section',id:'fixture',classes:[]},text:'Hi'})
  const e=blockEvidence('<html><body><section id="fixture"><p>Hi</p><img alt="Useful map" src="/a.jpg"><span title="Open today" aria-label="Public desk"></span></section></body></html>',[],b,geometry,url)
  expect(e.text).toEqual([])
  expect(e.sourceText).toContain('hi useful map open today public desk')
  const checks=scoreSheet(sheet([entry({block:b})]),[{type:'hero',content:{text:'Hi',note:'invented tiny note',label:'More'}}],url,{evidence:[e]}).rows[0].checks
  expect(checks.C7.passed).toBe(false)
})

test('HTML headings count in heading fields, while plain body headings do not',()=>{
  const b=block({text:'Our services for families'})
  const e={text:[],headings:['our services for families'],links:[],images:[],wordCount:4,sourceText:'Our services for families'}
  const answer=sheet([entry({block:b})])
  expect(scoreSheet(answer,[{type:'hero',content:{bodyHtml:'<div><h2><span>Our services</span> for families</h2></div>'}}],url,{evidence:[e]}).rows[0].checks.C3.passed).toBe(true)
  expect(scoreSheet(answer,[{type:'hero',content:{body:'Our services for families'}}],url,{evidence:[e]}).rows[0].checks.C3.passed).toBe(false)
})

test('link labels use joined component text including contact addresses',()=>{
  const b=block({text:'Reach our team',links:['mailto:info@example.test']})
  const e={text:[],headings:[],links:[{url:'mailto:info@example.test',label:'info@example.test'}],images:[],wordCount:3,sourceText:b.text}
  const row=scoreSheet(sheet([entry({block:b})]),[{type:'hero',content:{text:'Reach our team',contact:'info@example.test',href:'mailto:info@example.test'}}],url,{evidence:[e]}).rows[0]
  expect(row.checks.C4.passed).toBe(true)
})

test('fragment links and punctuation-only trailing cleanup preserve symbols',()=>{
  expect(absoluteUrl('#detail',url,'link')).toBe('https://example.test/page')
  expect(absoluteUrl('#',url,'link')).toBeNull()
  expect(normalizeText('C++')).toBe('c++')
  expect(normalizeText('C++!')).toBe('c++')
  expect(normalizeText('C')).not.toBe(normalizeText('C++'))
})

test('image addresses, multi backgrounds, geometry and decoration marks',()=>{
  const b=block({id:'fixture',anchor:{path:[0],tag:'section',id:'fixture',classes:[]}})
  const variant='<html><body><section id="fixture"><picture src="/own,picture.jpg" width="1" height="1"><img src="/small.jpg" width="1" height="1"></picture><img src="/comma,name.jpg" width="1" height="1"><div style="background-image:url(/one.jpg),url(/two.jpg)"></div></section></body></html>'
  const g={tree:{anchorKey:'body',children:[{anchorKey:'0',children:[{anchorKey:'0.0',box:{width:300,height:200},evidence:{images:['https://example.test/own,picture.jpg']},children:[]},{anchorKey:'0.1',box:{width:200,height:100},children:[]}]}]}}
  const e=blockEvidence(variant,[],b,g,url)
  expect(e.images.flatMap(group=>group.addresses)).toEqual(expect.arrayContaining(['https://example.test/own,picture.jpg','https://example.test/comma,name.jpg','https://example.test/one.jpg','https://example.test/two.jpg']))
  expect(e.images[0].addresses.filter(a=>a.endsWith('own,picture.jpg'))).toHaveLength(1)
  const marked=sheet([entry({block:b,label:label({decorativeImages:['/one.jpg','/two.jpg']})})])
  expect(scoreSheet(marked,[{type:'hero',content:{text:b.text,image:'/own,picture.jpg',other:'/comma,name.jpg'}}],url,{evidence:[e]}).rows[0].checks.C5.expected).toHaveLength(2)
})

test('scoring is deterministic and run-stage failures mark every block missed',()=>{
  const evidence=blockEvidence(html,[],sourceBlock,geometry,url)
  const options={evidence:[evidence]}
  expect(JSON.stringify(scoreSheet(sourceSheet,[{type:'card-grid',content}],url,options))).toBe(JSON.stringify(scoreSheet(sourceSheet,[{type:'card-grid',content}],url,options)))
  expect(scoreSheet(sourceSheet,[{type:'card-grid',content}],url,{...options,allMissed:true}).counts.missed).toBe(1)
})

test('text moved from another block is reported and alt text is exempt',()=>{
  const first=block({id:'first',text:'Neighbourhood family advice is available through several community centres where patient staff explain every option and provide useful information about activities opening hours locations and practical support.'})
  const second=block({id:'second',order:2,text:'The second area provides detailed local support and clear steps for families seeking practical help throughout the week.'})
  const answer=sheet([entry({block:first}),entry({block:second})])
  const base={headings:[],links:[],images:[],wordCount:0}
  const evidence=[{...base,text:[{text:first.text,region:'main' as const}],sourceText:first.text},{...base,text:[{text:second.text,region:'main' as const}],sourceText:second.text}]
  const output={type:'hero',content:{text:second.text,note:'Neighbourhood family advice is available through',alt:'An unrelated invented description'}}
  const row=scoreSheet(answer,[output],url,{evidence,pageSource:first.text+' '+second.text}).rows.find(r=>r.id==='second')!
  expect(row.failedChecks).toContain('C7')
  expect((row.checks.C7.produced as {moved:string[];altExemptCharacters:number}).moved).toContain('content.note')
  expect((row.checks.C7.produced as {moved:string[];altExemptCharacters:number}).altExemptCharacters).toBeGreaterThan(0)
})

test('one source run can be retained across separate components',()=>{
  const run='one two three four five six seven eight nine ten eleven twelve'
  const b=block({text:run})
  const e={text:[{text:run,region:'main' as const}],headings:[],links:[],images:[],wordCount:12,sourceText:run}
  const checks=scoreSheet(sheet([entry({block:b})]),[{type:'hero',content:{text:'one two three four five six'}},{type:'hero',content:{text:'seven eight nine ten eleven twelve'}}],url,{evidence:[e]}).rows[0].checks
  expect(checks.C2.passed).toBe(true)
})

test('heading case and mailto and tel output links compare after normalisation',()=>{
  const b=block({text:'',headings:[],links:['mailto:info@example.test','tel:+12345']})
  const evidence={text:[],headings:['our services for families'],links:[{url:'mailto:info@example.test',label:'Email us'},{url:'tel:+12345',label:'Call us'}],images:[],wordCount:0,sourceText:'Our services for families Email us Call us'}
  const output={type:'hero',content:{heading:'OUR SERVICES FOR FAMILIES',email:{href:'mailto:INFO@EXAMPLE.TEST?subject=hello',label:'Email us'},phone:{href:'tel:+12345?ext=2',label:'Call us'}}}
  const checks=scoreSheet(sheet([entry({block:b})]),[output],url,{evidence:[evidence]}).rows[0].checks
  expect(checks.C3.passed).toBe(true)
  expect(checks.C4.passed).toBe(true)
})

