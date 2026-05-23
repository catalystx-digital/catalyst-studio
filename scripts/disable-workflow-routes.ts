import fs from 'node:fs'
import path from 'node:path'

if (process.env.STUDIO_DISABLE_WORKFLOW_PLUGIN !== 'true') {
  console.log('[disable-workflow-routes] Workflow plugin is enabled; leaving generated routes in place.')
  process.exit(0)
}

const workflowRouteRoot = path.join(process.cwd(), 'app', '.well-known', 'workflow', 'v1')
const generatedEntries = ['flow', 'step', 'webhook', 'config.json', 'manifest.json']

for (const entry of generatedEntries) {
  const target = path.join(workflowRouteRoot, entry)
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true })
    console.log(`[disable-workflow-routes] Removed ${path.relative(process.cwd(), target)}`)
  }
}
