#!/usr/bin/env node

/**
 * Backup Script: Save current state before migration
 * Creates a comprehensive backup including git state, files, and configuration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + Date.now();
const BACKUP_PATH = path.join(BACKUP_DIR, `backup_${TIMESTAMP}`);

// Files and directories to backup
const IMPORTANT_PATHS = [
  'app/demo/sitemap-builder',
  'components/studio/sitemap',
  'components/studio/deployment',
  'components/ui',
  'lib/sitemap',
  'hooks',
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  '.env.local',
  '.env.example',
  'CLAUDE.md',
  'README.md',
  '.gitignore',
];

function runCommand(command, silent = false) {
  try {
    const output = execSync(command, { encoding: 'utf8' });
    if (!silent) console.log(output);
    return output;
  } catch (error) {
    if (!silent) console.error(`Error running: ${command}`);
    return null;
  }
}

function createBackup() {
  console.log('🔒 CREATING COMPREHENSIVE BACKUP');
  console.log('=' .repeat(60));
  console.log(`📁 Backup location: ${BACKUP_PATH}\n`);

  // Create backup directory
  fs.mkdirSync(BACKUP_PATH, { recursive: true });
  fs.mkdirSync(path.join(BACKUP_PATH, 'files'), { recursive: true });
  fs.mkdirSync(path.join(BACKUP_PATH, 'git'), { recursive: true });

  // 1. Save Git State
  console.log('📊 Saving Git State...');
  const gitInfo = {
    timestamp: new Date().toISOString(),
    currentBranch: runCommand('git branch --show-current', true)?.trim(),
    remotes: runCommand('git remote -v', true),
    status: runCommand('git status --porcelain', true),
    lastCommit: runCommand('git log -1 --oneline', true)?.trim(),
    allBranches: runCommand('git branch -a', true),
    stashList: runCommand('git stash list', true),
    uncommittedFiles: runCommand('git diff --name-only', true),
    stagedFiles: runCommand('git diff --cached --name-only', true),
    untrackedFiles: runCommand('git ls-files --others --exclude-standard', true),
  };
  
  fs.writeFileSync(
    path.join(BACKUP_PATH, 'git', 'git-state.json'),
    JSON.stringify(gitInfo, null, 2)
  );
  console.log('✅ Git state saved');

  // 2. Save full git diff of uncommitted changes
  console.log('📝 Saving uncommitted changes...');
  const fullDiff = runCommand('git diff HEAD', true);
  if (fullDiff) {
    fs.writeFileSync(path.join(BACKUP_PATH, 'git', 'uncommitted-changes.diff'), fullDiff);
    console.log('✅ Uncommitted changes saved as diff');
  }

  // 3. Save staged changes separately
  const stagedDiff = runCommand('git diff --cached', true);
  if (stagedDiff) {
    fs.writeFileSync(path.join(BACKUP_PATH, 'git', 'staged-changes.diff'), stagedDiff);
    console.log('✅ Staged changes saved');
  }

  // 4. Create git bundle (contains all commits)
  console.log('💾 Creating git bundle...');
  runCommand(`git bundle create "${path.join(BACKUP_PATH, 'git', 'repository.bundle')}" --all`, true);
  console.log('✅ Git bundle created');

  // 5. Backup important files
  console.log('📂 Backing up files...');
  let backedUpCount = 0;
  let skippedCount = 0;

  function copyRecursive(src, dest) {
    if (!fs.existsSync(src)) {
      skippedCount++;
      return;
    }

    const stats = fs.statSync(src);
    
    if (stats.isDirectory()) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      
      fs.readdirSync(src).forEach(child => {
        copyRecursive(
          path.join(src, child),
          path.join(dest, child)
        );
      });
    } else {
      fs.copyFileSync(src, dest);
      backedUpCount++;
    }
  }

  IMPORTANT_PATHS.forEach(itemPath => {
    const srcPath = path.join(process.cwd(), itemPath);
    const destPath = path.join(BACKUP_PATH, 'files', itemPath);
    
    if (fs.existsSync(srcPath)) {
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      
      copyRecursive(srcPath, destPath);
      console.log(`  ✅ ${itemPath}`);
    } else {
      console.log(`  ⏭️  ${itemPath} (not found)`);
    }
  });

  console.log(`\n✅ Backed up ${backedUpCount} files`);
  if (skippedCount > 0) {
    console.log(`⏭️  Skipped ${skippedCount} missing items`);
  }

  // 6. Create restoration instructions
  const restoreScript = `#!/bin/bash
# Restoration Script for Backup ${TIMESTAMP}
# Run this script from the project root to restore this backup

echo "🔄 Restoring backup from ${TIMESTAMP}"

# 1. Restore files
echo "📂 Restoring files..."
cp -r "${BACKUP_PATH}/files/"* .

# 2. Restore git state
echo "📊 To restore git state:"
echo "  - Current branch was: ${gitInfo.currentBranch}"
echo "  - Last commit was: ${gitInfo.lastCommit}"
echo ""
echo "To apply uncommitted changes:"
echo "  git apply ${BACKUP_PATH}/git/uncommitted-changes.diff"
echo ""
echo "To restore from bundle:"
echo "  git clone ${BACKUP_PATH}/git/repository.bundle restored-repo"

echo "✅ File restoration complete!"
`;

  fs.writeFileSync(path.join(BACKUP_PATH, 'restore.sh'), restoreScript);
  fs.chmodSync(path.join(BACKUP_PATH, 'restore.sh'), '755');

  // 7. Create backup manifest
  const manifest = {
    timestamp: new Date().toISOString(),
    backupPath: BACKUP_PATH,
    gitState: gitInfo,
    filesBackedUp: backedUpCount,
    totalSize: getDirectorySize(BACKUP_PATH),
    important_notes: [
      'Git bundle contains all commits and branches',
      'Uncommitted changes saved as diff files',
      'Use restore.sh to restore files',
      'Git state saved in git-state.json'
    ]
  };

  fs.writeFileSync(
    path.join(BACKUP_PATH, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  // 8. Create a simple restore script for Windows
  const restoreScriptWindows = `@echo off
REM Restoration Script for Backup ${TIMESTAMP}
REM Run this script from the project root to restore this backup

echo Restoring backup from ${TIMESTAMP}

REM 1. Restore files
echo Restoring files...
xcopy /E /Y "${BACKUP_PATH}\\files\\*" .

echo.
echo To restore git state:
echo   - Current branch was: ${gitInfo.currentBranch}
echo   - Last commit was: ${gitInfo.lastCommit}
echo.
echo To apply uncommitted changes:
echo   git apply ${BACKUP_PATH}\\git\\uncommitted-changes.diff
echo.
echo File restoration complete!
pause
`;

  fs.writeFileSync(path.join(BACKUP_PATH, 'restore.bat'), restoreScriptWindows);

  console.log('\n' + '=' .repeat(60));
  console.log('✅ BACKUP COMPLETED SUCCESSFULLY!');
  console.log('=' .repeat(60));
  console.log(`📁 Backup saved to: ${BACKUP_PATH}`);
  console.log(`📊 Total size: ${manifest.totalSize}`);
  console.log('\n📝 Backup includes:');
  console.log('  • All project files');
  console.log('  • Git history (bundle)');
  console.log('  • Uncommitted changes (diff)');
  console.log('  • Git state information');
  console.log('  • Restoration scripts');
  console.log('\n🔄 To restore:');
  console.log(`  Windows: ${BACKUP_PATH}\\restore.bat`);
  console.log(`  Unix: bash ${BACKUP_PATH}/restore.sh`);
  
  return BACKUP_PATH;
}

function getDirectorySize(dirPath) {
  let size = 0;
  
  function calculateSize(itemPath) {
    const stats = fs.statSync(itemPath);
    
    if (stats.isDirectory()) {
      fs.readdirSync(itemPath).forEach(child => {
        calculateSize(path.join(itemPath, child));
      });
    } else {
      size += stats.size;
    }
  }
  
  calculateSize(dirPath);
  
  // Convert to human readable
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let readableSize = size;
  
  while (readableSize >= 1024 && unitIndex < units.length - 1) {
    readableSize /= 1024;
    unitIndex++;
  }
  
  return `${readableSize.toFixed(2)} ${units[unitIndex]}`;
}

function listBackups() {
  console.log('📋 EXISTING BACKUPS');
  console.log('=' .repeat(60));
  
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('No backups found.');
    return;
  }
  
  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(dir => dir.startsWith('backup_'))
    .sort()
    .reverse();
  
  if (backups.length === 0) {
    console.log('No backups found.');
    return;
  }
  
  backups.forEach(backup => {
    const manifestPath = path.join(BACKUP_DIR, backup, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      console.log(`\n📁 ${backup}`);
      console.log(`   Created: ${manifest.timestamp}`);
      console.log(`   Size: ${manifest.totalSize}`);
      console.log(`   Files: ${manifest.filesBackedUp}`);
      console.log(`   Branch: ${manifest.gitState.currentBranch}`);
    }
  });
}

// Main execution
const command = process.argv[2];

if (command === 'list') {
  listBackups();
} else if (command === 'create' || !command) {
  createBackup();
} else {
  console.log('Catalyst Studio - Backup Tool\n');
  console.log('Usage:');
  console.log('  node scripts/backup-state.js         - Create backup');
  console.log('  node scripts/backup-state.js create  - Create backup');
  console.log('  node scripts/backup-state.js list    - List existing backups');
}