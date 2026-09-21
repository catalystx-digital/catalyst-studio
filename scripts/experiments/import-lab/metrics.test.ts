/** @jest-environment node */
import { normalizeText, absoluteUrl, componentRegion, componentStrings, isHumanText, extractPageEvidence, componentResources, share, measureTextKept, measureTextNotFound, measureResources, measureShape, measureArm, diagnosticEvidence, extractSectionEvidence, wordShingles, TEXT_COVERAGE_THRESHOLD, type Field, type Component } from './metrics'
import { fixtureHtml, fixtureComponents } from './fixtures'
const base='https://example.com/garden/'
const field=(value:string,path='content.body'):Field=>({value,path,componentType:'text-block',componentIndex:0,region:'main'})

test('normalization decodes entities, joins inline text, separates blocks and excludes executable text',()=>{
  expect(normalizeText(' <p>Hello <b>WORLD</b> &amp; friends&nbsp; </p><p>Next</p><script>hidden</script>')).toBe('hello world & friends next')
})
test('absolute URLs resolve relative paths; only links drop fragments and trailing slashes',()=>{
  expect(absoluteUrl('../register/#form',base,'link')).toBe('https://example.com/register')
  expect(absoluteUrl('/garden.jpg#crop',base,'image')).toBe('https://example.com/garden.jpg#crop')
  expect(absoluteUrl('data:image/png;base64,abc',base,'image')).toBeNull()
  expect(absoluteUrl('javascript:alert(1)',base,'link')).toBeNull()
  expect(absoluteUrl('mailto:hello@example.com',base,'link')).toBe('mailto:hello@example.com')
})
test('component regions and nested fields preserve provenance without mutations',()=>{
  expect(componentRegion({type:'navbar'})).toBe('header')
  expect(componentRegion({type:'footer'})).toBe('footer')
  expect(componentRegion({type:'hero-simple',location:'hero'})).toBe('main')
  expect(componentRegion({type:'text-block',metadata:{region:'footer'}})).toBe('footer')
  const values=componentStrings([{type:'text-block',content:{items:[{title:'A nested human title'}]}}])
  expect(values.find(v=>v.path==='content.items[0].title')).toMatchObject({value:'A nested human title',componentIndex:0,region:'main'})
})
test('human text excludes technical fields and tokens but includes lowercase prose and long titles',()=>{
  expect(isHumanText(field('a lowercase sentence in an unfamiliar field','content.note'))).toBe(true)
  expect(isHumanText(field('Extraordinary','content.title'))).toBe(true)
  for(const [value,path] of [['https://example.com/path','content.body'],['a-long-enum-value','content.variant'],['display-block grid-cols-2','content.className'],['abcdefghijklmnop','content.mediaId'],['rgb(100, 100, 100)','content.color'],['too short','content.title']]) expect(isHumanText(field(value,path))).toBe(false)
})
test('source pieces join inline markup, retain repetitions, regions, and importer visibility rules',()=>{
  const e=extractPageEvidence('<style>.gone{display:none}.hidden-sm{display:none}#gone{visibility:hidden}</style><header><p>Header words are present</p></header><main><p>Hello <b>garden</b> visitors today</p><p>Hello garden visitors today</p><p hidden>Hidden sentence must not appear</p><p style="content-visibility: hidden !important">Hidden sentence must not appear</p><p class="gone">Hidden sentence must not appear</p><p id="gone">Hidden sentence must not appear</p><p class="hidden-sm">Responsive words remain included</p><p aria-hidden="true">Aria hidden alone stays included</p><template>Hidden template words</template><noscript>Hidden noscript words</noscript><p>Tiny</p></main><footer>Footer words are present</footer>',base)
  expect(e.text.filter(p=>p.text==='hello garden visitors today')).toHaveLength(2)
  expect(e.text.some(p=>p.text.includes('hidden sentence'))).toBe(false)
  expect(e.text.some(p=>p.text.includes('responsive words'))).toBe(true)
  expect(e.text.some(p=>p.text.includes('aria hidden'))).toBe(true)
  expect(e.text.some(p=>p.text==='tiny')).toBe(false)
  expect(e.visibleText).toContain('tiny')
  expect(e.text.find(p=>p.text.includes('header words'))?.region).toBe('header')
  expect(e.text.find(p=>p.text.includes('footer words'))?.region).toBe('footer')
})
test('source attributes, stylesheets, picture, srcset, backgrounds, tiny and data exclusions',()=>{
  const e=extractPageEvidence('<base href="https://example.com/assets/"><meta content="Metadata source phrase"><main><p class="external">Externally hidden text</p><input placeholder="A useful placeholder" value="A source value" hidden><img src="one.jpg" srcset="one.jpg 1x, two.jpg 2x" alt="A garden image"><picture><source srcset="three.webp 2x"><img src="four.jpg"></picture><div style="background-image:url(five.jpg)"></div><img src="pixel.gif" width="1" height="1"><img src="data:image/png;base64,abc"><a href="../register/#one">Register here today</a></main>',base,['.external{display:none}'])
  expect(e.images.map(i=>i.url)).toEqual(['one.jpg','two.jpg','three.webp','four.jpg','five.jpg'].map(name=>'https://example.com/assets/'+name))
  expect(e.links[0].url).toBe('https://example.com/register')
  expect(e.attributeText).toEqual(expect.arrayContaining(['metadata source phrase','a useful placeholder','a source value','a garden image']))
  expect(e.text.some(p=>p.text.includes('externally'))).toBe(false)
})
test('kept text retains all missing pieces for the appendix instead of truncating at twenty',()=>{
  const pieces=Array.from({length:25},(_,i)=>({text:'missing garden sentence '+String(i).padStart(i+2,'0'),region:'main' as const}))
  const kept=measureTextKept(pieces,[field(pieces[0].text)])
  expect(kept.count).toEqual(share(1,25));expect(kept.missing).toHaveLength(24)
  expect(kept.characters.numerator).toBe(pieces[0].text.length)
  expect(kept.missing[0].text.length).toBeGreaterThan(kept.missing[19].text.length)
  expect(share(0,0).share).toBeNull()
})
test('invented text uses attributes and all visible text and lists every unsupported field',()=>{
  const e=extractPageEvidence('<p>Short</p><p>words</p><p>together</p><img alt="Green leaves in a sunny garden">',base)
  const result=measureTextNotFound([field('Short words together'),field('Green leaves in a sunny garden','content.alt'),field('A completely invented sentence'),field('https://example.com/not-text')],e)
  expect(result.share).toEqual(share(1,3))
  expect(result.notFound[0]).toMatchObject({path:'content.body',componentType:'text-block',value:'A completely invented sentence'})
})
test('component resources cover nested media, links, plain image URLs and HTML fields',()=>{
  const evidence=extractPageEvidence('<img src="/garden.jpg">',base)
  const r=componentResources([field('https://example.com/garden.jpg','content.asset'),field('/new.webp','content.oddField'),field('/register/#x','content.button.href.path'),field('<p>A garden image here</p><img src="/embedded.png"><a href="/read/">Read this page</a>')],evidence)
  expect(r.images.map(v=>v.url)).toEqual(['https://example.com/garden.jpg','https://example.com/new.webp','https://example.com/embedded.png'])
  expect(r.links.map(v=>v.url)).toEqual(['https://example.com/register','https://example.com/read'])
})
test('resource comparison uses unique URLs, reports missing and invented, and handles empty sets',()=>{
  const r=(url:string)=>({url,region:'main' as const})
  const result=measureResources([r('a'),r('a'),r('b')],[r('b'),r('c'),r('c')])
  expect(result.kept).toEqual(share(1,2));expect(result.invented).toEqual(share(1,2))
  expect(result.missing).toEqual(['a']);expect(result.extra).toEqual(['c'])
  expect(measureResources([],[]).invented.share).toBeNull()
})
test('shape retains ordering, multiplicity, dropped sections and diagnostics',()=>{
  expect(measureShape([{type:'a'},{type:'b'},{type:'a'}],[{}],[{},{}])).toEqual({count:3,types:['a','b','a'],counts:{a:2,b:1},sectionsDropped:1,diagnosticsCount:2})
})
test('full measurements attribute kept text to its source region and invented text to component region',()=>{
  const evidence=extractPageEvidence(fixtureHtml,base),components=fixtureComponents as Component[]
  const before=JSON.stringify(components), m=measureArm(evidence,components,[{region:'footer'}],[{region:'main'}])
  expect(m.header.textKept.share).toBe(1)
  expect(m.main.textNotFound.numerator).toBeGreaterThan(0)
  expect(m.footer.shape.sectionsDropped).toBe(1)
  expect(m.main.shape.diagnosticsCount).toBe(1)
  expect(JSON.stringify(components)).toBe(before)
})

test('aggregated diagnostics count every dropped section and identify all affected regions',()=>{
  const outcomes=diagnosticEvidence([{code:'SECTION_EXTRACTION_DROPPED',context:{sections:[{sectionKey:'header'},{sectionKey:'footer'},{sectionKey:'main:0'}]}}],['main:1'])
  expect(outcomes.dropped).toHaveLength(4)
  expect(outcomes.diagnostics).toHaveLength(1)
  expect(outcomes.diagnostics[0].regions).toEqual(['header','footer','main'])
  const e=extractPageEvidence('',base), result=measureArm(e,[],outcomes.dropped,outcomes.diagnostics)
  expect(result.overall.shape.sectionsDropped).toBe(4)
  expect(result.overall.shape.diagnosticsCount).toBe(1)
  expect(result.footer.shape.diagnosticsCount).toBe(1)
})
test('multiple CSS background layers and tiny picture sources are handled',()=>{
  const e=extractPageEvidence('<div style="background-image:url(/a.png),url(/b.png)"></div><picture><source srcset="/pixel.webp 2x"><img src="/pixel.png" width="1" height="1"></picture>',base)
  expect(e.images.map(x=>x.url)).toEqual(['https://example.com/a.png','https://example.com/b.png'])
})

test('an anchor to an image is a link; video files are not counted as images',()=>{
  const evidence=extractPageEvidence('<img src="/garden.jpg"><a href="/garden.jpg">View the garden image</a>',base)
  const output=componentResources([field('/garden.jpg','content.href.url'),field('/movie.mp4','content.src'),field('internal','content.href.type'),field('garden','content.href.pageId')],evidence)
  expect(output.links).toEqual([{url:'https://example.com/garden.jpg',region:'main'}])
  expect(output.images).toEqual([])
})

test('header root selection gives a real header priority and limits fallback discovery',()=>{
  const e=extractPageEvidence('<style>.concealed{display:none}</style><div class="site-header concealed">Hidden preliminary navigation words</div><header class="concealed">Actual header navigation words</header><main><div class="site-header concealed">Hidden main navigation words</div></main>',base)
  expect(e.text).toEqual([{text:'actual header navigation words',region:'header'}])
  const fallback=extractPageEvidence('<style>.concealed{display:none}</style><div class="site-header concealed">Fallback header navigation words</div><main>Main content visible words</main>',base)
  expect(fallback.text[0]).toEqual({text:'fallback header navigation words',region:'header'})
})


test('A: only content and props supply measured text, images and links; catalogue fields never do', () => {
  const e = extractPageEvidence('<p>Catalogue boilerplate sentence</p><img src="/catalogue.png"><a href="/catalogue">Catalogue navigation</a>',base)
  const components: Component[] = [{type:'text-block', id:'bookkeeping identifier', location:'main', description:'Catalogue boilerplate sentence', metadata:{region:'main', keywords:['Catalogue boilerplate sentence'], image:'/catalogue.png', href:'/catalogue'} as any, content:{title:'An extracted heading', metadata:{title:'Nested catalogue text',href:'/catalogue'}}, props:{caption:'A props caption here', image:'/actual.png', href:'/actual'}}]
  const fields = componentStrings(components)
  expect(fields.map(f => f.path)).toEqual(['content.title','props.caption','props.image','props.href'])
  const m = measureArm(e,components).overall
  expect(m.textKept.numerator).toBe(0)
  expect(m.textNotFound).toEqual(share(2,2))
  expect(m.images.kept.numerator).toBe(0); expect(m.links.kept.numerator).toBe(0)
  expect(m.images.extra).toEqual(['https://example.com/actual.png'])
  expect(m.links.extra).toEqual(['https://example.com/actual'])
})
test('B: hidden carousel captions, title and every collected attribute remain source support', () => {
  const phrases = ['Caption from a hidden carousel','Words concealed by an inline style','Words concealed by a class selector','Words concealed by an id selector','A title supplied by the page','An alternative image description','An informative tooltip message','An accessible control label','An input placeholder message','A saved input value','A metadata content description','A hidden nested control title','Words in an inert template','Words in a noscript element']
  const e = extractPageEvidence('<head><title>'+phrases[4]+'</title><meta content="'+phrases[10]+'"><style>.item{display:none}#secret{visibility:hidden}</style></head><body><div class="item"><div>'+phrases[0]+'</div><input title="'+phrases[11]+'"></div><p style="display:none">'+phrases[1]+'</p><p class="item">'+phrases[2]+'</p><p id="secret">'+phrases[3]+'</p><img alt="'+phrases[5]+'" title="'+phrases[6]+'"><input aria-label="'+phrases[7]+'" placeholder="'+phrases[8]+'" value="'+phrases[9]+'"><template>'+phrases[12]+'</template><noscript>'+phrases[13]+'</noscript></body>',base)
  expect(e.text).toHaveLength(0)
  expect(measureTextNotFound(phrases.map(value => field(value)),e).share).toEqual(share(0,phrases.length))
})
test('C: visible and actually shown text have independent denominators, including input losses', () => {
  const e = extractPageEvidence('<p>Visible sentence shown to visitors</p><p>Visible sentence omitted before extraction</p><p hidden>Hidden caption supplied to extraction</p>',base)
  const sections = {
    'main:0': {key:'main:0',slice:[{tag:'p',text:'Visible sentence shown to visitors'},{tag:'p',text:'Hidden caption supplied to extraction'},{tag:'img',attrs:{alt:'An image description supplied separately'}}]},
    footer: {key:'footer',slice:[{tag:'p',text:'An omitted section never sent'}]}
  }
  const shown = extractSectionEvidence(sections,['main:0'])
  const m = measureArm(e,[{type:'text-block',content:{body:'Visible sentence shown to visitors',caption:'Hidden caption supplied to extraction'}}],[],[],shown).overall
  expect(m.textKept).toEqual(share(1,2)); expect(m.shownTextKept).toEqual(share(2,3))
  expect(m.visibleTextNotShown).toEqual(share(1,2)); expect(m.visibleShinglesNotShown).toEqual(share(1,2))
  expect(m.missingFromModel[0].text).toBe('visible sentence omitted before extraction')
  expect(shown.sectionKeys).toEqual(['main:0'])
  expect(() => extractSectionEvidence(sections,['missing'])).toThrow('absent')
})
test('D: adjacent short fields in one component preserve a correctly split page piece', () => {
  const e = extractPageEvidence('<div><span>Title</span><span>Description</span></div>',base)
  const fields = componentStrings([{type:'text-block',content:{title:'Title',description:'Description'}}])
  expect(measureTextKept(e.text,fields).count).toEqual(share(1,1))
  expect(measureTextKept(e.text,[fields[0],{...fields[1],componentIndex:1}]).count).toEqual(share(0,1))
})
test('D: five-word shingles match ordered adjacent fields, never reversed fields or word fragments', () => {
  const pieces = [{text:'one two three four five six seven',region:'main' as const}]
  const fields = componentStrings([{type:'text-block',content:{title:'one two three',description:'four five six seven'}}])
  expect(measureTextKept(pieces,fields).shingles).toEqual(share(3,3))
  expect(measureTextKept(pieces,[...fields].reverse()).count.numerator).toBe(0)
  expect(measureTextKept([{text:'garden',region:'main'}],[field('kindergarten')]).count.numerator).toBe(0)
  expect(wordShingles('one two three')).toEqual(['one two three'])
})
test('D: the shared ninety-percent threshold accepts exactly nine of ten shingles in both directions', () => {
  const source = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen'
  const near = source.replace('fourteen','changed'), below = source.replace('thirteen fourteen','changed words')
  const pieces = [{text:source,region:'main' as const}]
  expect(TEXT_COVERAGE_THRESHOLD).toBe(0.9)
  const kept = measureTextKept(pieces,[field(near)])
  expect(kept.count).toEqual(share(1,1)); expect(kept.shingles).toEqual(share(9,10))
  expect(measureTextKept(pieces,[field(below)]).count).toEqual(share(0,1))
  const e = extractPageEvidence('<p>'+source+'</p>',base)
  expect(measureTextNotFound([field(near),field(below)],e).notFound.map(f => f.value)).toEqual([below])
})
test('E: normalized duplicate pieces count once per region in both source yardsticks', () => {
  const pieces = [{text:'Repeated garden words here',region:'main' as const},{text:' REPEATED  garden words here ',region:'main' as const},{text:'Repeated garden words here',region:'footer' as const}]
  const result = measureTextKept(pieces,[field('Repeated garden words here')])
  expect(result.count).toEqual(share(2,2)); expect(result.duplicatesRemoved).toBe(1)
  expect(result.shingles).toEqual(share(2,2))
  const e = extractPageEvidence('<main><p>Repeated garden words here</p><p>Repeated garden words here</p></main>',base)
  const shown = extractSectionEvidence({main:{key:'main',slice:[{text:'Repeated garden words here'},{text:'Repeated garden words here'}]}})
  const m = measureArm(e,[],[],[],shown).overall
  expect(m.duplicatesRemoved).toBe(1); expect(m.shownDuplicatesRemoved).toBe(1)
  expect(m.textKept.denominator).toBe(1); expect(m.shownTextKept.denominator).toBe(1)
})
test('F: typographic quotes, apostrophes, dashes, spaces and ellipses compare consistently', () => {
  const fancy = '“Garden” isn’t empty — grow herbs–today… with sun​light﻿'
  const plain = `"Garden" isn't empty - grow herbs-today... with sunlight`
  expect(normalizeText(fancy)).toBe(normalizeText(plain))
  const e = extractPageEvidence('<p>'+fancy+'</p>',base)
  expect(measureArm(e,[{type:'text-block',content:{body:plain}}]).overall.textKept).toEqual(share(1,1))
  expect(measureTextNotFound([field(plain)],e).share).toEqual(share(0,1))
})


test('B: nested markup in hidden noscript and template contents is source text too', () => {
  const e = extractPageEvidence('<noscript><p>Nested fallback words are real</p></noscript><template><p>Nested template words are real</p><img alt="Nested template image description"></template>',base)
  expect(e.text).toEqual([])
  expect(measureTextNotFound(['Nested fallback words are real','Nested template words are real','Nested template image description'].map(value => field(value)),e).share).toEqual(share(0,3))
})
