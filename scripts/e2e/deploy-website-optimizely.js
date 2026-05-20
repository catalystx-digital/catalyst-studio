/*
 * Deploy Website to Optimizely (no dev server)
 * Reuses existing EnhancedExportService and OptimizelyProvider.
 * Usage: node scripts/e2e/deploy-website-optimizely.js [--id=<websiteId>]
 */

try { require('dotenv').config(); } catch {}

// Minimal TS loader to import project TS sources
const fs = require('fs');
const path = require('path');
let ts;
try { ts = require('typescript'); } catch (e) {
  console.error('TypeScript dependency not found. Please install dev deps.');
  process.exit(1);
}
const Module = require('module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  if (typeof request === 'string' && request.startsWith('@/')) {
    const base = process.cwd();
    const rel = request.slice(2);
    let abs = path.resolve(base, rel);
    if (fs.existsSync(abs)) request = abs;
    else if (fs.existsSync(abs + '.ts')) request = abs + '.ts';
    else if (fs.existsSync(abs + '.tsx')) request = abs + '.tsx';
    else if (fs.existsSync(abs + '.js')) request = abs + '.js';
    else request = abs;
  }
  return originalResolve.call(this, request, parent, isMain, options);
};
function registerTs(ext) {
  require.extensions[ext] = function(module, filename) {
    const src = fs.readFileSync(filename, 'utf8');
    const transpiled = ts.transpileModule(src, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2019,
        esModuleInterop: true,
        skipLibCheck: true,
        allowJs: true
      },
      fileName: filename
    });
    module._compile(transpiled.outputText, filename);
  };
}
registerTs('.ts');
registerTs('.tsx');

const { OptimizelyProvider } = require('@/lib/providers/optimizely/provider');
const { EnhancedExportService } = require('@/lib/services/export/enhanced-export-service');

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.find(a => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function getOptimizelyConfig() {
  const apiUrl = process.env.OPTIMIZELY_API_URL;
  const clientId = process.env.OPTIMIZELY_CLIENT_ID;
  const clientSecret = process.env.OPTIMIZELY_CLIENT_SECRET;
  const projectId = process.env.OPTIMIZELY_PROJECT_ID;
  if (!apiUrl || !clientId || !clientSecret) {
    throw new Error('Missing Optimizely credentials in environment (.env.local)');
  }
  return { apiUrl, clientId, clientSecret, projectId };
}

async function main() {
  const websiteId = getArg('id', 'cmfazjrrd0000v8y8t510nfko');
  console.log('🚀 Deploying website to Optimizely:', websiteId);

  const provider = new OptimizelyProvider();
  provider.configure(getOptimizelyConfig());

  const exportService = new EnhancedExportService(provider);

  // Export + Sync using existing orchestrator and nested materialization logic in provider
  const { exportData, syncResults } = await exportService.exportAndSync(websiteId, {
    includeFolders: true,
    includeComponents: true,
  });

  console.log('\n=== Export Summary ===');
  console.log('Types:', exportData.metadata.statistics.contentTypes);
  console.log('Items:', exportData.metadata.statistics.contentItems);
  console.log('Folders:', exportData.metadata.statistics.folders);

  if (syncResults?.unifiedContent) {
    const uc = syncResults.unifiedContent;
    console.log('\n=== Sync Summary ===');
    console.log('Unified Content → successful:', uc.successCount, 'failed:', uc.failureCount);
  }

  // Verification: ensure all export content types and ensured nested types exist
  const { OptimizelyClient } = require('@/lib/providers/optimizely/client');
  const client = new OptimizelyClient();
  client.configure(getOptimizelyConfig());

  const sanitize = (s) => String(s||'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^([0-9])/, 't_$1') || 'type';
  const typeKeys = new Set();
  for (const t of (exportData.contentTypes || [])) {
    // Derive the expected Optimizely key from the name (more reliable than DB id)
    const key = sanitize(t.name || t.id);
    if (key) typeKeys.add(String(key));
  }
  // Add dynamically ensured nested child types
  try {
    const extra = provider.getEnsuredTypeKeys();
    for (const k of extra) typeKeys.add(k);
  } catch {}

  const missingTypes = [];
  for (const key of typeKeys) {
    try {
      const t = await client.getContentType(key);
      if (!t) missingTypes.push(key);
    } catch (e) {
      missingTypes.push(key);
    }
  }

  // Verification: ensure all created content items exist
  const missingItems = [];
  try {
    const details = (syncResults && syncResults.unifiedContent && syncResults.unifiedContent.details) || [];
    for (const d of details) {
      if (d.action !== 'created') continue;
      const id = d.id;
      if (!id) continue;
      try {
        const item = await client.getContentItem(String(id));
        if (!item) missingItems.push(id);
      } catch (e) {
        missingItems.push(id);
      }
    }
  } catch {}

  console.log('\n=== Verification ===');
  console.log('Content Types checked:', typeKeys.size, 'Missing:', missingTypes.length);
  if (missingTypes.length) console.log('Missing Types:', missingTypes.slice(0, 20));
  console.log('Content Items checked:', ((syncResults && syncResults.unifiedContent && syncResults.unifiedContent.details) || []).filter(d=>d.action==='created').length, 'Missing:', missingItems.length);
  if (missingItems.length) console.log('Missing Items:', missingItems.slice(0, 20));

  const verificationErrors = [];
  if (missingTypes.length) verificationErrors.push(`Missing type keys: ${missingTypes.slice(0,20).join(', ')}`);
  if (missingItems.length) verificationErrors.push(`Missing items: ${missingItems.slice(0,20).join(', ')}`);

  // 1) Determine expected Home title from export (page with shortest slug depth)
  const structuralErrors = [];
  const pagesExport = (exportData.contentItems || []).filter(ci => ci && ci.title);
  const depthOf = (slug) => (String(slug||'').split('/').filter(Boolean).length);
  const expectedHome = pagesExport.sort((a,b) => depthOf(a.slug)-depthOf(b.slug))[0];
  const expectedHomeTitle = expectedHome && expectedHome.title;
  const expectedHomeSlug = String((expectedHome && (expectedHome.slug || expectedHomeTitle)) || 'home')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  // Find Home among pages created or updated this run; else fallback to search
  let homeItem = null;
  try {
    const touchedPages = (syncResults && syncResults.unifiedContent && syncResults.unifiedContent.details) || [];
    homeItem =
      touchedPages.find(i => (i.title||i.name) === expectedHomeTitle)
      || touchedPages.find(i => String(i.urlSegment||'') === expectedHomeSlug)
      || null;
    // Fallback: search existing pages by title
    if (!homeItem && expectedHomeTitle) {
      try {
        const list = await client.getContentItems({ search: expectedHomeTitle }, { top: 50 });
        const items = (list && list.items) || [];
        homeItem =
          items.find(i => String(i.contentType||'').toLowerCase()==='page' && (i.displayName||i.name) === expectedHomeTitle)
          || items.find(i => String(i.contentType||'').toLowerCase()==='page' && String(i.urlSegment||'') === expectedHomeSlug)
          || null;
      } catch {}
    }
  } catch {}
  if (!homeItem) structuralErrors.push(`Home page not found (expected '${expectedHomeTitle||'Home'}')`);

  // 2) Ensure other pages are under Home, not root
  if (homeItem) {
    // List children under Home using parentLink filter
    const homeKey = String(homeItem.key || (homeItem.contentLink && homeItem.contentLink.id) || homeItem.guidValue);
    const underHome = (syncResults && syncResults.unifiedContent && syncResults.unifiedContent.details) || [];
    const homeChildNames = (underHome.items || []).map(i => i.title || i.name || '');
    // Determine expected page titles from export (excluding Home)
    const expectedPages = pagesExport.map(ci => ci.title).filter(t => t && t !== expectedHomeTitle);
    const missingUnderHome = expectedPages.filter(t => !homeChildNames.includes(t));
    if (missingUnderHome.length > 0) {
      structuralErrors.push(`Pages not found under Home: ${missingUnderHome.join(', ')}`);
    }
  }

  // 3) Blocks presence and data via references from pages (avoid disallowed queries)
  function collectRefs(obj, acc) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (const el of obj) collectRefs(el, acc);
      return;
    }
    const ref = obj.reference || obj.Reference;
    if (typeof ref === 'string' && ref.startsWith('cms://content/')) {
      const id = ref.replace('cms://content/', '');
      acc.add(id);
    }
    for (const v of Object.values(obj)) collectRefs(v, acc);
  }
  const expectedCompKeys = new Set();
  const sanitizeK = (s) => String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').replace(/^([0-9])/, 't_$1');
  try {
    const comps = exportData.components || [];
    for (const c of comps) {
      const k = sanitizeK(c.type || c.name || c.id);
      if (k) expectedCompKeys.add(k);
    }
  } catch {}
  const referencedIds = new Set();
  // Inspect Home and its children for references
  const pagesToScan = [];
  if (homeItem) pagesToScan.push(homeItem);
  try {
    const homeKey = homeItem && (homeItem.key || (homeItem.contentLink && homeItem.contentLink.id) || homeItem.guidValue);
    if (homeKey) {
      const underHome = await client.getContentItems({ parentLink: String(homeKey) }, { top: 100 });
      (underHome.items || []).forEach(p => pagesToScan.push(p));
    }
  } catch {}
  for (const p of pagesToScan) {
    try {
      const full = await client.getContentItem(String(p.key || p.guidValue || (p.contentLink && p.contentLink.id)));
      const props = (full && full.properties) || {};
      collectRefs(props, referencedIds);
    } catch {}
  }
  const presentTypes = new Set();
  const missingDataBlocks = [];
  for (const id of Array.from(referencedIds).slice(0, 100)) {
    try {
      const item = await client.getContentItem(String(id));
      if (item && item.contentType) presentTypes.add(item.contentType);
      const props = (item && item.properties) || {};
      const keys = Object.keys(props);
      const empty = keys.length === 0 || keys.every(k => {
        const v = props[k];
        if (v && typeof v === 'object') return Object.keys(v).length === 0;
        return v === null || v === '';
      });
      if (empty) missingDataBlocks.push(item && (item.displayName||item.name||id));
    } catch {}
  }
  const missingBlockTypes = Array.from(expectedCompKeys).filter(k => !presentTypes.has(k));
  if (missingBlockTypes.length > 0) structuralErrors.push(`Blocks missing via references: ${missingBlockTypes.slice(0,20).join(', ')}`);
  if (missingDataBlocks.length > 0) structuralErrors.push(`Blocks with empty properties (sample): ${missingDataBlocks.slice(0,10).join(', ')}`);

  // Report structural errors
  if (structuralErrors.length > 0) {
    console.error('\n❌ Structural verification failed:');
    structuralErrors.forEach(e => console.error(' -', e));
    verificationErrors.push(...structuralErrors);
  }

  if (verificationErrors.length > 0) {
    console.error('\n❌ Verification failed. Issues found:');
    verificationErrors.forEach(e => console.error(' -', e));
    process.exit(1);
  }

  console.log('\n✅ Deployment flow completed and verified (types, items, structure)');
}

main().catch(err => {
  console.error('\n💥 Deployment failed');
  console.error(err);
  process.exit(1);
});

