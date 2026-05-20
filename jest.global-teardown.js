/**
 * Jest Global Teardown
 * Runs after all tests to clean up the test environment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = async () => {
  console.log('🧹 Cleaning up test environment...');
  
  try {
    // Clean up test files and artifacts using fs for cross-platform support
    const testDbPath = path.join(__dirname, 'test.db');
    const testDbJournalPath = path.join(__dirname, 'test.db-journal');
    
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    if (fs.existsSync(testDbJournalPath)) {
      fs.unlinkSync(testDbJournalPath);
    }
    
    // Alternative cleanup using execSync if needed
    try {
      execSync('rm -f test.db test.db-journal', { stdio: 'ignore' });
    } catch (error) {
      // Ignore errors - might be on Windows
    }
    
    console.log('✅ Test environment cleanup complete');
  } catch (error) {
    console.warn('⚠️ Warning during cleanup:', error.message);
    // Don't fail the test run for cleanup issues
  }
};