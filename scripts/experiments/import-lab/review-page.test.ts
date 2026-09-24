/** @jest-environment jsdom */
import fs from 'node:fs/promises'
import path from 'node:path'

const summary={queues:{disputes:{remaining:1,estimateMinutes:1},sample:{remaining:30,estimateMinutes:10},stick:{remaining:1,estimateMinutes:1}},sample:{wrong:0,rule:'2 or more wrong: fix labelling instructions and relabel'},stick:{agree:0,rule:'28 or more must agree'}}
const kinds=[{value:'site-header',label:'Top menu'},{value:'site-footer',label:'Bottom of page'}]
const base={page:'invented',blockId:'block-1',revision:'rev',cropUrl:'/crop?page=invented&block=block-1',region:'main'}
const dispute={...base,fields:[{key:'family',label:'section kind'},{key:'acceptableFamilies',label:'allowed section kinds'},{key:'familiesInOrder',label:'section kinds from top to bottom'},{key:'itemCount',label:'number of items'},{key:'itemKind',label:'type of item'},{key:'placement',label:'where it sits'},{key:'decorativeImages',label:'decoration images'},{key:'multiple',label:'more than one section'},{key:'ignore',label:'skip this section'}],choices:[{id:'option-0',label:'Top menu · number of items: 2 · where it sits: Top · decoration images: Image 1 · more than one section: No · skip this section: No',decorationNumbers:[1]},{id:'option-1',label:'Bottom of page · number of items: 3 · where it sits: Bottom · decoration images: Image 2 · more than one section: Yes · skip this section: Yes',decorationNumbers:[2]}],decorationGroups:[{number:1,thumbnail:'https://example.test/first.png',addresses:['https://example.test/first.png']},{number:2,thumbnail:'https://example.test/second.png',addresses:['https://example.test/second.png']}],familyNames:kinds,currentFamily:null,otherFields:{family:['site-header','site-footer'],acceptableFamilies:[['site-header'],['site-footer']],familiesInOrder:[['site-header'],['site-footer']],itemCount:[2,3],itemKind:['cards','feed'],placement:['header','footer'],decorativeImages:[['https://example.test/first.png'],['https://example.test/second.png']],multiple:[false,true],ignore:[false,true]}}
const sample={...base,family:'Top menu',currentFamily:'site-header',familyNames:kinds}
const stick={...base,imported:{headings:['Heading'],text:'Plain text',images:['https://example.test/picture.png'],links:[{label:'Visit',target:'https://example.test/visit'}]}}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0))

async function page(items:Record<string,any>,onAnswer?:(body:any)=>any){
  const html=await fs.readFile(path.join(__dirname,'review.html'),'utf8'),posts:any[]=[]
  const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
  document.open();document.write(html.replace(/<script>[\s\S]*?<\/script>/,''));document.close()
  ;(window as any).fetch=async(input:string,options?:any)=>{
      const url=String(input)
      let data:any
      if(url==='/api/summary')data=summary
      else if(url.startsWith('/api/queue'))data={item:items[new URL(url,'http://127.0.0.1').searchParams.get('queue')||''],progress:{position:1,batchSize:20,remaining:30}}
      else if(url==='/api/answer'){const body=JSON.parse(options.body);posts.push(body);data=onAnswer?.(body)||{item:items[body.queue],progress:{position:2,batchSize:20,remaining:29}}}
      else throw new Error('Unexpected URL '+url)
      return {ok:true,json:async()=>data}
    }
  window.eval('(function(){'+script+'})()')
  await tick()
  return {window,document,posts,close:()=>{(document.querySelector('#done') as HTMLButtonElement)?.click()}}
}
const clickQueue=async(document:Document,index:number)=>{(document.querySelectorAll('.queue-choice')[index] as HTMLButtonElement).click();await tick()}

test('all queue item types render plain English; decoration choices have distinct matching thumbnails',async()=>{
  const view=await page({disputes:dispute,sample,stick})
  try{
    const {document}=view
    for(const [index,heading] of [[0,'Which answer matches the source?'],[1,'Is this section kind right?'],[2,'Is this import right?']] as const){
      await clickQueue(document,index)
      expect(document.querySelector('#prompt')?.textContent).toBe(heading)
      if(index===0){
        expect([...document.querySelectorAll('#answers .answer')].slice(0,2).map(node=>[...node.querySelectorAll<HTMLImageElement>('img')].map(image=>image.alt))).toEqual([['Decoration image 1'],['Decoration image 2']])
        ;(document.querySelectorAll('#answers .answer')[2] as HTMLButtonElement).click()
        const labels=[...document.querySelectorAll('#editor label span')].map(node=>node.textContent)
        expect(labels).toContain('Section kind')
        expect(labels).toContain('Where it sits')
        expect([...document.querySelectorAll<HTMLImageElement>('#editor img')].map(image=>image.alt)).toEqual(['Decoration image 1','Decoration image 2'])
      }
      const text=document.querySelector('main')!.textContent||''
      expect(text).not.toMatch(/\b(?:family|acceptableFamilies|familiesInOrder|itemCount|itemKind|placement|decorativeImages|multiple|ignore|true|false|site-header|site-footer|cards|feed)\b/)
      ;(document.querySelector('#done') as HTMLButtonElement).click();await tick()
    }
  }finally{view.close()}
})

test('Enter on focused Save correction keeps native button activation',async()=>{
  const view=await page({sample})
  try{
    await clickQueue(view.document,1)
    const wrong=view.document.querySelectorAll('#answers button')[1] as HTMLButtonElement
    wrong.focus()
    const direct=new view.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})
    wrong.dispatchEvent(direct)
    expect(direct.defaultPrevented).toBe(false)
    wrong.click()
    const save=view.document.querySelector('#editor button') as HTMLButtonElement
    save.focus()
    const event=new view.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})
    save.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    save.click();await tick()
    expect(view.posts).toHaveLength(1)
    expect(view.posts[0]).toMatchObject({answer:'wrong',correction:'site-header'})
  }finally{view.close()}
})

test('twentieth save stops at Batch done until Continue, preserving next item',async()=>{
  let saved=0
  const view=await page({sample},()=>{saved++;return {item:{...sample,blockId:'block-'+(saved+1)},progress:{position:saved%20+1,batchSize:Math.min(20,30-Math.floor(saved/20)*20),remaining:30-saved}}})
  try{
    await clickQueue(view.document,1)
    for(let index=0;index<20;index++){(view.document.querySelector('#answers button') as HTMLButtonElement).click();await tick()}
    expect(view.document.querySelector('#count')?.textContent).toBe('20 of 20')
    expect(view.document.querySelector('#batch-done')?.hasAttribute('hidden')).toBe(false)
    expect(view.document.querySelector('#work')?.hasAttribute('hidden')).toBe(true)
    expect(saved).toBe(20)
    ;(view.document.querySelector('#continue') as HTMLButtonElement).click()
    expect(view.document.querySelector('#batch-done')?.hasAttribute('hidden')).toBe(true)
    expect(view.document.querySelector('#work')?.hasAttribute('hidden')).toBe(false)
  }finally{view.close()}
})
