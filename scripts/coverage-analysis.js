#!/usr/bin/env node

/**
 * Coverage Analysis Script
 * Analyzes test coverage and identifies gaps for improvement
 */

const fs = require('fs');
const path = require('path');

function main() {
  const coverageFile = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
  
  if (!fs.existsSync(coverageFile)) {
    console.error('❌ Coverage file not found. Run "npm run test:coverage" first.');
    process.exit(1);
  }

  let coverage;
  try {
    coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
  } catch (error) {
    console.error('❌ Failed to parse coverage file:', error.message);
    console.error('   Please ensure the coverage file is valid JSON.');
    process.exit(1);
  }
  
  console.log('\n📊 Coverage Analysis Report');
  console.log('==========================\n');

  // Overall statistics
  const total = coverage.total;
  console.log('📈 Overall Coverage:');
  console.log(`   Lines:      ${total.lines.pct}% (${total.lines.covered}/${total.lines.total})`);
  console.log(`   Functions:  ${total.functions.pct}% (${total.functions.covered}/${total.functions.total})`);
  console.log(`   Branches:   ${total.branches.pct}% (${total.branches.covered}/${total.branches.total})`);
  console.log(`   Statements: ${total.statements.pct}% (${total.statements.covered}/${total.statements.total})\n`);

  // Threshold check
  const thresholds = { lines: 80, functions: 80, branches: 80, statements: 80 };
  const failed = [];
  
  Object.entries(thresholds).forEach(([metric, threshold]) => {
    if (total[metric].pct < threshold) {
      failed.push(`${metric}: ${total[metric].pct}% < ${threshold}%`);
    }
  });

  if (failed.length > 0) {
    console.log('❌ Coverage thresholds not met:');
    failed.forEach(fail => console.log(`   ${fail}`));
  } else {
    console.log('✅ All coverage thresholds met!');
  }

  // Find files with low coverage
  console.log('\n📋 Files needing attention (< 80% coverage):');
  const lowCoverageFiles = [];
  
  Object.entries(coverage).forEach(([filePath, data]) => {
    if (filePath === 'total') return;
    
    const hasLowCoverage = 
      data.lines.pct < 80 || 
      data.functions.pct < 80 || 
      data.branches.pct < 80 || 
      data.statements.pct < 80;
    
    if (hasLowCoverage) {
      lowCoverageFiles.push({
        file: filePath.replace(process.cwd(), '.'),
        lines: data.lines.pct,
        functions: data.functions.pct,
        branches: data.branches.pct,
        statements: data.statements.pct
      });
    }
  });

  if (lowCoverageFiles.length === 0) {
    console.log('   ✅ No files below 80% coverage!');
  } else {
    lowCoverageFiles
      .sort((a, b) => (a.lines + a.functions + a.branches + a.statements) - (b.lines + b.functions + b.branches + b.statements))
      .forEach(file => {
        console.log(`   📄 ${file.file}`);
        console.log(`      Lines: ${file.lines}%, Functions: ${file.functions}%, Branches: ${file.branches}%, Statements: ${file.statements}%`);
      });
  }

  // High coverage files
  console.log('\n🏆 Top performing files (> 95% coverage):');
  const highCoverageFiles = [];
  
  Object.entries(coverage).forEach(([filePath, data]) => {
    if (filePath === 'total') return;
    
    const avgCoverage = (data.lines.pct + data.functions.pct + data.branches.pct + data.statements.pct) / 4;
    
    if (avgCoverage > 95) {
      highCoverageFiles.push({
        file: filePath.replace(process.cwd(), '.'),
        avg: Math.round(avgCoverage * 10) / 10
      });
    }
  });

  if (highCoverageFiles.length === 0) {
    console.log('   📝 No files above 95% average coverage yet.');
  } else {
    highCoverageFiles
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 10)
      .forEach(file => {
        console.log(`   ✨ ${file.file} (${file.avg}% avg)`);
      });
  }

  console.log('\n💡 Recommendations:');
  if (lowCoverageFiles.length > 0) {
    console.log('   • Focus on adding tests for files with < 80% coverage');
    console.log('   • Pay special attention to branch coverage gaps');
    console.log('   • Consider integration tests for complex file interactions');
  }
  
  if (total.branches.pct < 80) {
    console.log('   • Add tests for edge cases and error conditions');
    console.log('   • Test both true and false paths in conditional statements');
  }
  
  if (total.functions.pct < 80) {
    console.log('   • Ensure all exported functions have test coverage');
    console.log('   • Add tests for private/helper functions through public APIs');
  }

  console.log('\n📊 Coverage report available at: coverage/lcov-report/index.html');
  
  // Exit with error code if thresholds not met
  if (failed.length > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };