/*
 * Validate CMS components against the "Healthy Component Checklist" (Epic 42).
 *
 * Philosophy: lean, fast, no artifacts. Clean colorful console output only.
 * - Focuses on CMS components under lib/studio/components/cms
 * - Checks files/structure, registration, initialize imports, adapters
 * - Warns on a few heuristics (content[] without allowedTypes, tests missing, etc.)
 * - Exits non-zero on any errors
 *
 * Usage:
 *   node scripts/validate-component-checklist.js [--verbose] [--category <name>] [--component <name>]
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const CMS_ROOT = path.join(ROOT, 'lib', 'studio', 'components', 'cms');
const INIT_FILE = path.join(CMS_ROOT, '_factory', 'initialize.ts');

// Simple color helpers (avoid ESM chalk complexity)
const c = {
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
}

function exists(file) {
  try { return fs.existsSync(file); } catch { return false; }
}

function listDirs(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
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

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { verbose: false, category: null, component: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--verbose' || a === '-v') out.verbose = true;
    else if (a === '--category' && args[i + 1]) { out.category = args[++i]; }
    else if (a === '--component' && args[i + 1]) { out.component = args[++i]; }
  }
  return out;
}

function getCategories() {
  return listDirs(CMS_ROOT).filter((d) => !d.startsWith('_'));
}

function getComponentsForCategory(category) {
  const catDir = path.join(CMS_ROOT, category);
  const entries = listDirs(catDir);
  const components = [];
  for (const name of entries) {
    // Many categories also have files at root (e.g., adapters.tsx, register.ts)
    // Only consider subdirectories as potential components
    const compDir = path.join(catDir, name);
    const hasIndex = exists(path.join(compDir, 'index.tsx'));
    const propsmeta = fs
      .readdirSync(compDir, { withFileTypes: true })
      .filter((d) => d.isFile() && /\.propsmeta\.ts$/.test(d.name))
      .map((d) => d.name);
    const aiFiles = fs
      .readdirSync(compDir, { withFileTypes: true })
      .filter((d) => d.isFile() && /\.ai\.ts$/.test(d.name))
      .map((d) => d.name);
    const typesFiles = fs
      .readdirSync(compDir, { withFileTypes: true })
      .filter((d) => d.isFile() && /\.types\.ts$/.test(d.name))
      .map((d) => d.name);
    const testFiles = fs
      .readdirSync(compDir, { withFileTypes: true })
      .filter((d) => d.isFile() && /\.test\.(t|j)sx?$/.test(d.name))
      .map((d) => d.name);
    const serverFile = exists(path.join(compDir, `${name}.server.tsx`)) ? path.join(compDir, `${name}.server.tsx`) : null;
    const clientFile = exists(path.join(compDir, `${name}.client.tsx`)) ? path.join(compDir, `${name}.client.tsx`) : null;

    // Heuristic: treat a directory as a component if it has index.tsx OR a propsmeta file
    const isCandidate = hasIndex || propsmeta.length > 0;
    if (!isCandidate) continue;

    components.push({
      category,
      name,
      dir: compDir,
      hasIndex,
      propsmeta,
      aiFiles,
      typesFiles,
      testFiles,
      serverFile,
      clientFile,
    });
  }
  return components;
}

function parseRegister(category) {
  const file = path.join(CMS_ROOT, category, 'register.ts');
  const src = read(file) || '';
  const imports = { propsmetaMainByFolder: new Map(), propsmetaByKey: new Map(), aiByFolder: new Map() };

  // Capture imports: import { xxxPropsMeta } from './<folder>/<file>.propsmeta'
  const importRegex = /import\s*{\s*([^}]+?)\s*}\s*from\s*['"]\.\/([^'"]+)\.propsmeta['"];?/g;
  let m;
  while ((m = importRegex.exec(src)) !== null) {
    const names = m[1].split(',').map((s) => s.trim());
    const rel = m[2]; // e.g., 'nav-bar/nav-bar' or 'accordion/accordion-item'
    const folder = path.posix.dirname(rel); // 'nav-bar' or 'accordion'
    const base = path.posix.basename(rel); // 'nav-bar' or 'accordion-item'
    const varName = names.find((n) => /PropsMeta$/i.test(n));
    if (!varName) continue;
    const key = base === folder ? folder : `${folder}/${base}`;
    imports.propsmetaByKey.set(key, varName);
    // Track main component var for folder (prefer base===folder)
    if (base === folder) imports.propsmetaMainByFolder.set(folder, varName);
  }

  // AI metadata imports: import { something } from './<folder>/<file>.ai'
  const aiImportRegex = /import\s*{\s*([^}]+?)\s*}\s*from\s*['"]\.\/([^'"]+)\.ai['"];?/g;
  while ((m = aiImportRegex.exec(src)) !== null) {
    const rel = m[2];
    const folder = path.posix.dirname(rel);
    imports.aiByFolder.set(folder, true);
  }

  // Extract registration arrays and objects for matching propsMeta use and subOnly
  const registerBlocks = [];

  // Pattern 1: cmsComponentFactory.registerComponent(ComponentType.X, ..., { ... })
  const regCompRegex = /registerComponent\s*\(\s*ComponentType\.[\w-]+\s*,[\s\S]*?\{([\s\S]*?)\}\s*\)/g;
  while ((m = regCompRegex.exec(src)) !== null) registerBlocks.push(m[1]);

  // Pattern 2: cmsComponentFactory.register({ ... })
  const registerObjRegex = /\.(?:register)\s*\(\s*\{([\s\S]*?)\}\s*\)/g;
  while ((m = registerObjRegex.exec(src)) !== null) registerBlocks.push(m[1]);

  // Pattern 3: registerComponents([ {...}, {...} ])
  const registerArrayRegex = /registerComponents\s*\(\s*\[([\s\S]*?)\]\s*\)/g;
  while ((m = registerArrayRegex.exec(src)) !== null) {
    const arrayBlock = m[1];
    const objs = arrayBlock.split(/\},\s*\{/).map((chunk, i, arr) => {
      let text = chunk.trim();
      if (i === 0 && !text.startsWith('{')) text = '{' + text;
      if (i === arr.length - 1 && !text.endsWith('}')) text = text + '}';
      return text;
    });
    registerBlocks.push(...objs);
  }

  return { file, src, imports, registerBlocks };
}

function parseInitializeImports() {
  const src = read(INIT_FILE) || '';
  const re = /import\(\s*['"]\.\.\/([^'"]+)\/register['"]\s*\)/g;
  const cats = new Set();
  let m;
  while ((m = re.exec(src)) !== null) cats.add(m[1]);
  return { file: INIT_FILE, categories: Array.from(cats) };
}

function lintServerForBrowserAPIs(file) {
  const src = read(file);
  if (!src) return [];
  const issues = [];
  if (/\bwindow\b/.test(src) || /\bdocument\b/.test(src)) {
    issues.push('uses window/document in server file');
  }
  return issues;
}

function checkPropsMetaContentRules(file) {
  const src = read(file);
  if (!src) return { warnings: [], errors: [] };
  const warnings = [];
  const errors = [];
  if (!/definePropsMeta\s*</.test(src)) warnings.push('propsmeta missing definePropsMeta<T>() generic');
  if (/type\s*:\s*['"]content\[\]['"]/i.test(src) && !/allowedTypes\s*:\s*\[/i.test(src)) {
    warnings.push("content[] without allowedTypes");
  }
  return { warnings, errors };
}

function checkPerformanceHints(files) {
  const content = files.map(read).filter(Boolean).join('\n');
  if (!content) return { warnings: [] };
  if (!/withPerformanceTracking\s*\(/.test(content)) {
    return { warnings: ['no withPerformanceTracking(...) detected'] };
  }
  return { warnings: [] };
}

function main() {
  const args = parseArgs();
  const categories = getCategories().filter((cname) => !args.category || args.category === cname);
  const init = parseInitializeImports();

  const errors = [];
  const warnings = [];
  const perComponentIssues = new Map(); // key: category/name -> { errors:[], warnings:[] }

  // Check initialize imports cover all categories
  for (const cat of categories) {
    if (!init.categories.includes(cat)) {
      errors.push(`initialize.ts missing dynamic import for category ${cat}`);
    }
  }

  // Check category adapters existence
  for (const cat of categories) {
    const adapters = path.join(CMS_ROOT, cat, 'adapters.tsx');
    if (!exists(adapters)) warnings.push(`${cat}: adapters.tsx not found`);
  }

  let total = 0;
  let passes = 0;

  for (const cat of categories) {
    const comps = getComponentsForCategory(cat).filter((c) => !args.component || args.component === c.name);
    const reg = parseRegister(cat);

    for (const comp of comps) {
      total++;
      const key = `${comp.category}/${comp.name}`;
      const issue = { errors: [], warnings: [] };

      // Files & structure
      if (comp.hasIndex === false) {
        // Likely a subcomponent
      } else {
        if (!comp.hasIndex) issue.errors.push('missing index.tsx');
      }
      if (comp.typesFiles.length === 0) issue.errors.push('missing *.types.ts');
      if (comp.propsmeta.length === 0) issue.errors.push('missing *.propsmeta.ts');
      if (comp.aiFiles.length === 0) issue.errors.push('missing *.ai.ts');

      // Content contract quick checks
      if (comp.propsmeta.length > 0) {
        const propsmetaPath = path.join(comp.dir, comp.propsmeta[0]);
        const { warnings: w1 } = checkPropsMetaContentRules(propsmetaPath);
        issue.warnings.push(...w1);
      }

      // Registration checks
      const folder = comp.name; // folder name inside category
      const importedVar = reg.imports.propsmetaMainByFolder.get(folder);
      if (!importedVar) {
        issue.errors.push('register.ts missing propsmeta import for this component');
      } else {
        // Optional deep check (kept lean): just ensure some registration blocks exist.
        // We avoid brittle per-var matching to keep output simple and robust.
        if (reg.registerBlocks.length === 0) {
          issue.errors.push('no registration blocks found in register.ts');
        }
        // Subcomponent heuristic: if there is no index.tsx, require at least one block with subOnly: true
        const isSub = !comp.hasIndex;
        if (isSub) {
          const hasSubOnly = reg.registerBlocks.some((blk) => /subOnly\s*:\s*true/.test(blk));
          if (!hasSubOnly) issue.errors.push('subcomponent not registered with subOnly: true');
        }
      }

      // AI import presence in register.ts is nice-to-have (warn if missing)
      if (!reg.imports.aiByFolder.get(folder)) {
        issue.warnings.push('register.ts missing AI metadata import for this component');
      }

      // Tests presence
      if (comp.testFiles.length === 0) issue.warnings.push('no tests found');

      // Server file browser API usage
      if (comp.serverFile) issue.warnings.push(...lintServerForBrowserAPIs(comp.serverFile));

      // Performance hint
      const perf = checkPerformanceHints([path.join(comp.dir, 'index.tsx'), comp.serverFile, comp.clientFile].filter(Boolean));
      issue.warnings.push(...perf.warnings);

      // Finalize per-component
      if (issue.errors.length === 0 && issue.warnings.length === 0) {
        passes++;
        if (args.verbose) console.log(`${c.green('✔')} ${key}`);
      } else {
        perComponentIssues.set(key, issue);
      }
    }
  }

  // Output summary
  const errCount = errors.length + Array.from(perComponentIssues.values()).reduce((a, b) => a + b.errors.length, 0);
  const warnCount = warnings.length + Array.from(perComponentIssues.values()).reduce((a, b) => a + b.warnings.length, 0);
  const summary = `${c.bold('OK')} ${passes}/${total} ${c.gray('•')} ${c.yellow('Warnings:')} ${warnCount} ${c.gray('•')} ${c.red('Errors:')} ${errCount}`;
  console.log(summary);

  // Top-level file/category issues
  if (errors.length > 0) {
    console.log(c.red('\nErrors'));
    for (const e of errors) console.log(`  ${c.red('•')} ${e}`);
  }
  if (warnings.length > 0) {
    console.log(c.yellow('\nWarnings'));
    for (const w of warnings) console.log(`  ${c.yellow('•')} ${w}`);
  }

  // Component issues (only non-passes)
  if (perComponentIssues.size > 0) {
    // Print errors first, then warnings
    let printedErrorsHeader = false;
    for (const [key, issue] of perComponentIssues) {
      if (issue.errors.length > 0) {
        if (!printedErrorsHeader) {
          console.log(c.red('\nComponent Errors'));
          printedErrorsHeader = true;
        }
        for (const e of issue.errors) console.log(`  ${c.red('•')} ${key}: ${e}`);
      }
    }
    let printedWarningsHeader = false;
    for (const [key, issue] of perComponentIssues) {
      if (issue.warnings.length > 0) {
        if (!printedWarningsHeader) {
          console.log(c.yellow('\nComponent Warnings'));
          printedWarningsHeader = true;
        }
        for (const w of issue.warnings) console.log(`  ${c.yellow('•')} ${key}: ${w}`);
      }
    }
  }

  if (errCount > 0) process.exit(1);
}

main();
