#!/usr/bin/env node

/**
 * Pre-commit Coverage Check
 * Ensures coverage thresholds are met before allowing commits
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const coverageFile = path.join(__dirname, '../coverage/coverage-summary.json');

function checkCoverage() {
  console.log('🧪 Running pre-commit coverage check...\n');
  
  try {
    // Run tests with coverage
    console.log('📊 Generating coverage report...');
    execSync('npm run test:coverage:ci', { stdio: 'pipe' });
    
    if (!fs.existsSync(coverageFile)) {
      console.error('❌ Coverage file not found');
      process.exit(1);
    }
    
    const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
    const { total } = coverage;
    
    const thresholds = {
      lines: 80,
      branches: 80,
      functions: 80,
      statements: 80
    };
    
    let passed = true;
    console.log('📈 Coverage Results:');
    
    Object.keys(thresholds).forEach(metric => {
      const actual = total[metric].pct;
      const threshold = thresholds[metric];
      const status = actual >= threshold ? '✅' : '❌';
      
      console.log(`   ${status} ${metric}: ${actual}% (required: ${threshold}%)`);
      
      if (actual < threshold) {
        passed = false;
      }
    });
    
    console.log('');
    
    if (passed) {
      console.log('🎉 Coverage check passed! Commit allowed.');
      process.exit(0);
    } else {
      console.log('⚠️  Coverage thresholds not met.');
      console.log('💡 Run "npm run test:coverage:analyze" for detailed analysis.');
      console.log('');
      console.log('To bypass this check (not recommended):');
      console.log('   git commit --no-verify');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Pre-commit coverage check failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  checkCoverage();
}

module.exports = { checkCoverage };