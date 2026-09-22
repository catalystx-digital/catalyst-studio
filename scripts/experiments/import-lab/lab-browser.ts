import { chromium } from 'playwright'
export const browserExecutable=()=>process.env.CHROMIUM_EXECUTABLE_PATH
export function launchLabBrowser() {
  const executablePath=browserExecutable()
  if(executablePath)console.log('Explicit Chromium executable: '+executablePath)
  return chromium.launch({headless:true,...(executablePath?{executablePath}:{}),args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--disable-default-apps']})
}

// tsx preserves function names with a helper; keep that helper inside the evaluated closure.
export async function evaluateLocal<Arg,Result>(page:import('playwright').Page,fn:(arg:Arg)=>Result,arg:Arg):Promise<Awaited<Result>> {
  return page.evaluate<Awaited<Result>>('(()=>{const __name=(value)=>value;return ('+fn.toString()+')('+JSON.stringify(arg)+');})()')
}
