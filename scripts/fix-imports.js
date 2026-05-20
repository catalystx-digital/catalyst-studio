#!/usr/bin/env node

/**
 * Fix imports after reorganization
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Import mappings
const IMPORT_MAPPINGS = [
  // Sitemap components
  { from: '@/components/studio/sitemap/professional-nodes', to: '@/components/studio/sitemap/professional-nodes' },
  { from: '@/components/studio/sitemap/version-history', to: '@/components/studio/sitemap/version-history' },
  { from: '@/components/studio/sitemap/comments-system', to: '@/components/studio/sitemap/comments-system' },
  { from: '@/components/studio/sitemap/ai-suggestions-enhanced', to: '@/components/studio/sitemap/ai-suggestions-enhanced' },
  { from: '@/components/studio/sitemap/export-manager', to: '@/components/studio/sitemap/export-manager' },
  { from: '@/components/studio/sitemap/global-sections-library', to: '@/components/studio/sitemap/global-sections-library' },
  { from: '@/components/studio/sitemap/keyboard-shortcuts-help', to: '@/components/studio/sitemap/keyboard-shortcuts-help' },
  { from: '@/components/studio/sitemap/templates-modal', to: '@/components/studio/sitemap/templates-modal' },
  { from: '@/components/studio/sitemap/share-export-modal', to: '@/components/studio/sitemap/share-export-modal' },
  { from: '@/components/studio/sitemap/advanced-filters', to: '@/components/studio/sitemap/advanced-filters' },
  { from: '@/components/studio/sitemap/quick-actions-menu', to: '@/components/studio/sitemap/quick-actions-menu' },
  { from: '@/components/studio/sitemap/section-picker', to: '@/components/studio/sitemap/section-picker' },
  { from: '@/components/studio/sitemap/responsive-wrapper', to: '@/components/studio/sitemap/responsive-wrapper' },
  { from: '@/components/studio/sitemap/virtual-canvas', to: '@/components/studio/sitemap/virtual-canvas' },
  
  // Layouts
  { from: '@/components/studio/deployment/demo-layout-fullwidth', to: '@/components/studio/layouts/demo-layout-fullwidth' },
  
  // UI
  { from: '@/components/ui/avatar', to: '@/components/studio/ui/avatar' },
  
  // Utils
  { from: '@/lib/sitemap/export-utils', to: '@/lib/studio/export-utils' },
  { from: '@/hooks/use-sitemap-performance', to: '@/hooks/studio/use-sitemap-performance' },
  
  // Relative imports in moved files
  { from: '../ui/avatar', to: '../ui/avatar' },
  { from: '../../ui/', to: '@/components/ui/' },
];

function fixImportsInFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  IMPORT_MAPPINGS.forEach(({ from, to }) => {
    // Match various import patterns
    const patterns = [
      new RegExp(`from ['"]${from}['"]`, 'g'),
      new RegExp(`from "${from}"`, 'g'),
      new RegExp(`from '${from}'`, 'g'),
      new RegExp(`import\\(['"]${from}['"]\\)`, 'g'),
    ];
    
    patterns.forEach(pattern => {
      if (content.match(pattern)) {
        content = content.replace(pattern, (match) => {
          const quote = match.includes('"') ? '"' : "'";
          if (match.includes('import(')) {
            return `import(${quote}${to}${quote})`;
          }
          return `from ${quote}${to}${quote}`;
        });
        modified = true;
      }
    });
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  
  return false;
}

function fixAllImports() {
  console.log('🔧 Fixing imports...\n');
  
  // Files to check
  const filesToFix = [
    // Studio demo pages
    'app/studio-demo/**/*.tsx',
    'app/studio-demo/**/*.ts',
    
    // Studio components
    'components/studio/**/*.tsx',
    'components/studio/**/*.ts',
    
    // Studio libs
    'lib/studio/**/*.ts',
    'hooks/studio/**/*.ts',
  ];
  
  let fixedCount = 0;
  
  filesToFix.forEach(pattern => {
    const files = glob.sync(pattern, { cwd: process.cwd() });
    files.forEach(file => {
      if (fixImportsInFile(file)) {
        console.log(`✅ Fixed imports in: ${file}`);
        fixedCount++;
      }
    });
  });
  
  console.log(`\n✨ Fixed imports in ${fixedCount} files`);
}

// Simple glob implementation if glob is not available
if (!glob || !glob.sync) {
  glob = {
    sync: function(pattern) {
      // Simple implementation for our needs
      const base = pattern.replace(/\*\*\/\*\.\w+$/, '');
      const ext = pattern.match(/\.\w+$/)?.[0] || '.tsx';
      const results = [];
      
      function walk(dir) {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            walk(filePath);
          } else if (filePath.endsWith(ext)) {
            results.push(filePath);
          }
        });
      }
      
      walk(base);
      return results;
    }
  };
}

fixAllImports();