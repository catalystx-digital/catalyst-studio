/*
 * Generate a machine-readable catalog of CMS and Global components.
 * - Scans filesystem for component entry files (index.tsx)
 * - Parses category register.ts files to extract registration info
 *
 * Output: docs/epics/artifacts/component-catalog.json
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const CMS_ROOT = path.join(ROOT, 'lib', 'studio', 'components', 'cms');
const GLOBALS_ROOT = path.join(ROOT, 'lib', 'studio', 'components', 'globals');
const OUT_DIR = path.join(ROOT, 'docs', 'epics', 'artifacts');
const OUT_FILE = path.join(OUT_DIR, 'component-catalog.json');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function scanCmsEntries() {
  const ignoreRe = /(\\|\/)_(core|factory|tests|ai|import|performance|docs|examples|hooks|utils|placeholder)(\\|\/)/i;
  const files = walk(CMS_ROOT)
    .filter(f => f.endsWith(`${path.sep}index.tsx`))
    .filter(f => !ignoreRe.test(f));
  return files.map(f => {
    const relFromCms = path.relative(CMS_ROOT, f);
    const parts = relFromCms.split(path.sep);
    const category = parts[0];
    const component = parts[1];
    return {
      category,
      component,
      relPath: relFromCms.replace(/\\/g, '/'),
      absPath: f
    };
  });
}

function scanGlobalEntries() {
  const files = walk(GLOBALS_ROOT).filter(f => f.endsWith(`${path.sep}index.tsx`));
  return files.map(f => path.relative(GLOBALS_ROOT, f).replace(/\\/g, '/'));
}

function parseRegistrationFile(filePath) {
  const src = read(filePath);
  const entries = [];

  // Helper to add entry
  const add = (e) => entries.push({
    type: e.type || null,
    category: e.category || null,
    subOnly: !!e.subOnly,
    hasPropsMeta: !!e.hasPropsMeta,
    componentSymbol: e.componentSymbol || null,
    registerFile: path.relative(ROOT, filePath).replace(/\\/g, '/'),
  });

  // Pattern A: cmsComponentFactory.register({ ... })
  const registerObjRegex = /cmsComponentFactory\.(?:register)\s*\(\s*\{([\s\S]*?)\}\s*\)/g;
  let m;
  while ((m = registerObjRegex.exec(src)) !== null) {
    const block = m[1];
    const typeMatch = block.match(/type\s*:\s*ComponentType\.(\w+)/);
    const categoryMatch = block.match(/category\s*:\s*ComponentCategory\.(\w+)/);
    const subOnly = /subOnly\s*:\s*true/.test(block);
    const hasPropsMeta = /propsMeta\s*:/.test(block);
    const componentSymbolMatch = block.match(/component\s*:\s*(\w+)/);
    add({
      type: typeMatch && typeMatch[1],
      category: categoryMatch && categoryMatch[1],
      subOnly,
      hasPropsMeta,
      componentSymbol: componentSymbolMatch && componentSymbolMatch[1]
    });
  }

  // Pattern B: factory.registerComponents([ {...}, {...} ])
  const registerArrayRegex = /registerComponents\s*\(\s*\[([\s\S]*?)\]\s*\)/g;
  while ((m = registerArrayRegex.exec(src)) !== null) {
    const arrayBlock = m[1];
    // Roughly split objects on '},' boundaries (not fully robust, but adequate for current files)
    const objects = arrayBlock.split(/\},\s*\{/).map((chunk, i, arr) => {
      let text = chunk.trim();
      if (i === 0 && !text.startsWith('{')) text = '{' + text;
      if (i === arr.length - 1 && !text.endsWith('}')) text = text + '}';
      return text;
    });
    for (const obj of objects) {
      const typeMatch = obj.match(/type\s*:\s*ComponentType\.(\w+)/);
      const categoryMatch = obj.match(/category\s*:\s*ComponentCategory\.(\w+)/);
      const subOnly = /subOnly\s*:\s*true/.test(obj);
      const hasPropsMeta = /propsMeta\s*:/.test(obj);
      const componentSymbolMatch = obj.match(/component\s*:\s*(\w+)/);
      if (typeMatch) {
        add({
          type: typeMatch[1],
          category: categoryMatch && categoryMatch[1],
          subOnly,
          hasPropsMeta,
          componentSymbol: componentSymbolMatch && componentSymbolMatch[1]
        });
      }
    }
  }

  // Pattern C: cmsComponentFactory.registerComponent(ComponentType.X, ..., { ... })
  const registerComponentRegex = /cmsComponentFactory\.(?:registerComponent)\s*\(\s*ComponentType\.(\w+)\s*,[\s\S]*?\{([\s\S]*?)\}\s*\)/g;
  while ((m = registerComponentRegex.exec(src)) !== null) {
    const type = m[1];
    const options = m[2];
    const subOnly = /subOnly\s*:\s*true/.test(options);
    const hasPropsMeta = /propsMeta\s*:/.test(options);
    add({ type, subOnly, hasPropsMeta });
  }

  return entries;
}

function scanRegistrations() {
  const files = walk(CMS_ROOT).filter(f => f.endsWith(`${path.sep}register.ts`));
  return files.flatMap(parseRegistrationFile);
}

function buildCatalog() {
  const cms = scanCmsEntries();
  const globals = scanGlobalEntries();
  const registrations = scanRegistrations();

  return {
    generatedAt: new Date().toISOString(),
    cmsByFiles: cms,
    cmsByRegistration: registrations,
    globals
  };
}

function main() {
  const catalog = buildCatalog();
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`Wrote component catalog: ${path.relative(ROOT, OUT_FILE).replace(/\\/g, '/')}`);
  console.log(`- CMS (by files): ${catalog.cmsByFiles.length}`);
  console.log(`- CMS (by registration entries): ${catalog.cmsByRegistration.length}`);
  console.log(`- Globals: ${catalog.globals.length}`);
}

main();
