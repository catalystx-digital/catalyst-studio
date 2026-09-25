import { block, entry, label, sheet } from './phase2-fixtures'
import type { Component } from './metrics'

export const f1Url = 'https://example.test/page'
export const f1Paragraph = 'Families can discover welcoming activities nearby with practical guidance about access times locations and friendly people who help everyone participate throughout the year.'
export const f1Items = [1, 2, 3].map(n => ({title:`Item title ${n} here`, text:`This helpful item shares clear details about local options schedules support and ways families can take part together ${n}.`}))
export const f1Html = `<html><body><section id="fixture"><h2>Our services for families</h2><p>${f1Paragraph}</p><ul>${f1Items.map(i=>`<li><h3>${i.title}</h3><p>${i.text}</p></li>`).join('')}</ul><img width="300" height="200" src="/photo-small.jpg" srcset="/photo-small.jpg 300w, /photo-large.jpg 600w"><p><a href="/stories/one?utm_source=x">Read the full story</a></p></section></body></html>`
export const f1Block = block({id:'fixture', anchor:{path:[0],tag:'section',id:'fixture',classes:[]},text:`Our services for families ${f1Paragraph} ${f1Items.map(i=>`${i.title} ${i.text}`).join(' ')} Read the full story`,images:['https://example.test/photo-small.jpg'],links:['https://example.test/stories/one?utm_source=x']})
export const f1Sheet = sheet([entry({block:f1Block,label:label({bestType:'card-grid',acceptableTypes:['card-grid'],expected:{headings:[],itemCount:3,itemKind:'items',hasImage:false,ctaLabels:[]}})})])
export const f1Geometry = {tree:{anchorKey:'body',box:{width:800,height:800},children:[{anchorKey:'0',box:{width:600,height:600},children:[{anchorKey:'0.3',box:{width:300,height:200},children:[],evidence:{images:['https://example.test/photo-small.jpg']}}]}]}}
export const f1Content = {heading:'Our services for families',description:f1Paragraph,items:f1Items.map(i=>({title:i.title,text:i.text})),image:'/photo-large.jpg',label:'Read the full story',href:'/stories/one'}
export const f1Mutations: Array<[string,Component[]]> = [
  ['M1',[{type:'card-grid',content:f1Content}]],
  ['M2',[{type:'card-grid',content:{...f1Content,heading:''}}]],
  ['M3',[{type:'card-grid',content:{...f1Content,heading:'',body:'Our services for families'}}]],
  ['M4',[{type:'card-grid',content:{...f1Content,description:f1Paragraph.split(' ').slice(0,10).join(' ')}}]],
  ['M5',[{type:'card-grid',content:{...f1Content,href:undefined}}]],
  ['M6',[{type:'card-grid',content:{...f1Content,href:undefined,label:undefined}}]],
  ['M7',[{type:'card-grid',content:{...f1Content,image:undefined}}]],
  ['M8',[{type:'card-grid',content:{...f1Content,items:f1Content.items.slice(0,2)}}]],
  ['M9',[{type:'card-grid',content:{...f1Content,body:Array(30).fill('invented').join(' ')}}]],
  ['M10',[{type:'footer',content:f1Content}]],
  ['M11',[]]
]
