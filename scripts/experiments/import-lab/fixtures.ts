import type { DomNode } from '@/lib/studio/import/services/web-tools'
import type { Snapshot } from './storage'
import { digest } from './storage'

export const fixtureHtml = '<!doctype html><html><head><title>Garden learning example</title><meta name="description" content="Practical garden lessons for everyone."><style>.concealed {display:none}</style></head><body><header><a href="/lessons">Explore garden lessons</a></header><main><h1>Garden lessons for curious visitors.</h1><p>Learn to grow herbs in small spaces.</p><p hidden>This sentence should stay hidden.</p><p class="concealed">Another hidden garden sentence.</p><img src="/garden.jpg" alt="Green leaves in a sunny garden"><a href="/register/#form">Register for the next garden lesson</a></main><footer><p>Community learning throughout the year.</p></footer></body></html>'
export function fixtureSnapshot(): Snapshot {
  const handle = 'fixture-handle'
  const slices: Record<string, DomNode[]> = {
    header: [{tag:'header',pathId:'h1'},{tag:'a',pathId:'h2',text:'Explore garden lessons',attrs:{href:'/lessons'}}],
    'main:0-1023': [{tag:'main',pathId:'m1'},{tag:'h1',pathId:'m2',text:'Garden lessons for curious visitors.'},{tag:'p',pathId:'m3',text:'Learn to grow herbs in small spaces.'},{tag:'img',pathId:'m4',attrs:{src:'/garden.jpg',alt:'Green leaves in a sunny garden'}},{tag:'a',pathId:'m5',text:'Register for the next garden lesson',attrs:{href:'/register/#form'}}],
    footer: [{tag:'footer',pathId:'f1'},{tag:'p',pathId:'f2',text:'Community learning throughout the year.'}]
  }
  const sections = Object.fromEntries(Object.entries(slices).map(([key,slice])=>[key,{key,handle,slice,stats:{nodeCount:slice.length,approxBytes:Buffer.byteLength(JSON.stringify(slice))}}]))
  const outline = {handle,status:200,finalUrl:'https://example.com/garden',headMeta:{title:'Garden learning example'},sections:Object.entries(sections).map(([key,value])=>({key,nodeCount:value.stats.nodeCount,approxBytes:value.stats.approxBytes,hash:digest(JSON.stringify(value.slice))})),resourcesSummary:{anchors:[],images:[],videos:[],forms:[],links:[]}}
  return {html:fixtureHtml,outline,sections,stylesheets:[],models:{data:[{id:'offline/fixture-model',name:'Offline fixture model',context_length:131072,top_provider:{max_completion_tokens:65536},supported_parameters:['response_format','max_tokens','temperature'],pricing:{prompt:'0',completion:'0'}}]},manifest:{version:1,url:outline.finalUrl,finalUrl:outline.finalUrl,fetchedAt:'2026-01-01T00:00:00.000Z',sha256:digest(fixtureHtml),sectionKeys:Object.keys(sections),bytes:{html:Buffer.byteLength(fixtureHtml)}}}
}
export const fixtureComponents = [
  {component:'navbar',type:'navbar',confidence:0.8,location:'header',content:{links:[{label:'Explore garden lessons',href:{type:'internal',pageId:'lessons',path:'/lessons'}}]}},
  {component:'hero-simple',type:'hero-simple',confidence:0.8,content:{heading:'Garden lessons for curious visitors.',subheading:'Invented promise about free supplies.'}},
  {component:'text-block',type:'text-block',confidence:0.8,content:{body:'<p>Learn to grow herbs in small spaces.</p>',image:{src:{mediaId:'fixture-image',mediaType:'image',url:'https://example.com/invented.jpg'}}}},
  {component:'footer',type:'footer',confidence:0.8,location:'footer',content:{copyright:'Community learning throughout the year.'}}
]
