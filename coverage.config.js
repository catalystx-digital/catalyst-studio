/**
 * Coverage Configuration for Catalyst Studio
 * Defines coverage thresholds and monitoring rules
 */

module.exports = {
  // Global thresholds that must be met
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  },

  // Directory-specific thresholds for stricter requirements
  directoryThresholds: {
    'components/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    'hooks/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    'lib/': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    },
    'app/api/': {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Files that are excluded from coverage requirements
  excludedFiles: [
    '**/*.d.ts',
    '**/node_modules/**',
    '**/.next/**',
    '**/coverage/**',
    '**/dist/**',
    '**/lib/generated/**',
    '**/app/layout.tsx',
    '**/app/page.tsx',
    '**/app/**/layout.tsx',
    '**/app/**/loading.tsx',
    '**/app/**/not-found.tsx',
    '**/app/**/error.tsx',
  ],

  // Coverage trend monitoring
  trends: {
    // Minimum acceptable trend (coverage should not decrease by more than this)
    minimumTrend: -2, // -2% max decrease
    
    // Target improvement per sprint
    targetImprovement: 1, // +1% per sprint
    
    // Files that should be prioritized for coverage improvement
    priority: [
      'components/ui/**',
      'hooks/**',
      'lib/services/**'
    ]
  },

  // Quality gates
  qualityGates: {
    // No new files with coverage below this threshold
    newFileMinimum: 70,
    
    // Modified files must maintain this minimum
    modifiedFileMinimum: 75,
    
    // Critical paths require higher coverage
    criticalPaths: {
      'lib/auth/**': 90,
      'lib/database/**': 85,
      'components/forms/**': 85
    }
  },

  // Reporting configuration
  reporting: {
    formats: ['text', 'lcov', 'html', 'json', 'clover'],
    outputDir: 'coverage',
    
    // Generate detailed reports for these directories
    detailedReports: [
      'components/',
      'hooks/',
      'lib/',
      'app/api/'
    ],
    
    // Include in CI summary
    ciSummary: true,
    
    // Fail CI if coverage drops below thresholds
    failOnThreshold: true
  }
};