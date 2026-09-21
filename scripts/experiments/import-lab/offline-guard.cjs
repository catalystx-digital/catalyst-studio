// Verification preload: no environment files and no outbound network.
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const blocked = value => typeof value === 'string' && /^\.env/.test(path.basename(value))
for (const name of ['readFileSync','readFile','openSync','open','createReadStream']) {
  const original=fs[name]
  fs[name]=function(file,...args) { if(blocked(String(file))) throw new Error('Environment-file access blocked by import-lab verification'); return original.call(this,file,...args) }
}
for (const name of ['readFile','open']) {
  const original=fs.promises[name]
  fs.promises[name]=async function(file,...args) { if(blocked(String(file))) throw new Error('Environment-file access blocked by import-lab verification'); return original.call(this,file,...args) }
}
const originalLoad=Module._load
Module._load=function(request,parent,isMain) {
  if (request.replace(/\\/g,'/').endsWith('/jest.global-teardown.js')) return async()=>console.log('Import-lab guard: skipped unrelated database-file cleanup')
  const value=originalLoad.call(this,request,parent,isMain)
  if(request==='dotenv') return {...value,config:()=>({parsed:{}}),configDotenv:()=>({parsed:{}})}
  if(request==='@next/env' || request.endsWith('/@next/env')) return {...value,loadEnvConfig:()=>({combinedEnv:process.env,parsedEnv:{},loadedEnvFiles:[]})}
  return value
}
const connect=require('node:net').Socket.prototype.connect, fetch=globalThis.fetch
require('node:net').Socket.prototype.connect=function(...args) {
  const first=args[0],options=Array.isArray(first)?first[0]:first
  const host=typeof options==='object'?options.host:typeof args[1]==='string'?args[1]:undefined
  if(host!=='127.0.0.1')throw new Error('Offline tests permit only explicit 127.0.0.1 sockets')
  return connect.apply(this,args)
}
globalThis.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url)
  if(url.hostname!=='127.0.0.1')throw new Error('Offline tests permit only 127.0.0.1 fetch')
  return fetch(input,init)
}
