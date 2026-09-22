import { launchHeadlessChromium } from '../lib/studio/design-system/dom-probe/launch-headless-chromium'

const url = 'https://headless-check.invalid/'
const html = `<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head>
<body><header id="header">Header</header><section id="banner">Banner</section>
<section id="cards"><article>One</article><article>Two</article><article>Three</article></section>
<footer id="footer">Footer</footer></body></html>`
const css = `body { margin: 0; } body > * { box-sizing: border-box; padding: 20px; }
header { height: 80px; } #banner { height: 240px; }
#cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; height: 200px; }
footer { height: 60px; }`

async function main() {
  const started = Date.now()
  const browser = await launchHeadlessChromium()
  try {
    const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, serviceWorkers: 'block' })
    await context.route('**/*', async route => {
      const requested = route.request().url()
      if (requested === url) {
        await route.fulfill({ contentType: 'text/html', body: html })
      } else if (requested === url + 'style.css') {
        await route.fulfill({ contentType: 'text/css', body: css })
      } else {
        await route.abort()
      }
    })
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'load', timeout: 15000 })
    const display = await page.locator('#cards').evaluate(element => getComputedStyle(element).display)
    if (display !== 'grid') {
      throw new Error('Headless browser check failed: linked stylesheet did not apply; check HTML and stylesheet interception.')
    }
    const blocks = []
    for (const id of ['header', 'banner', 'cards', 'footer']) {
      const box = await page.locator('#' + id).boundingBox()
      if (!box || box.width <= 0 || box.height <= 0) {
        throw new Error(`Headless browser check failed: ${id} has no visible bounding box; check fixture rendering.`)
      }
      blocks.push({ id, ...box })
    }
    console.log(JSON.stringify({ blocks, elapsedMs: Date.now() - started }))
  } finally {
    await browser.close()
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
