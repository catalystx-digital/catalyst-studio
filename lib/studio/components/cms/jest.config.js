const baseConfig = require('../../../../jest.config');

module.exports = {
  ...baseConfig,
  displayName: 'CMS Components',
  testMatch: [
    '<rootDir>/**/*.test.ts',
    '<rootDir>/**/*.test.tsx',
    '<rootDir>/**/*.spec.ts',
    '<rootDir>/**/*.spec.tsx',
  ],
  setupFilesAfterEnv: [
    '<rootDir>/_tests/setup.ts',
  ],
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/*.test.{ts,tsx}',
    '!**/*.spec.{ts,tsx}',
    '!**/*.stories.tsx',
    '!**/*.ai.ts',
    '!**/index.{ts,tsx}',
    '!**/_tests/**',
    '!**/_docs/**',
    '!**/jest.config.js',
    '!**/.eslintrc.js',
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './_core/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './_factory/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    '^@/lib/studio/components/cms/(.*)$': '<rootDir>/$1',
  },
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        moduleResolution: 'node',
      },
    }],
  },
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: '<rootDir>/coverage',
  verbose: true,
};