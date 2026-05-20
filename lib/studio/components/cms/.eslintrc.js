module.exports = {
  extends: ['../../../../.eslintrc.js'],
  rules: {
    // ============================================================================
    // Import Path Rules
    // ============================================================================
    
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['@/components/*', '!@/components/ui/*'],
          message: 'Studio components should not import from common components directory. Use @/lib/studio/components/cms/* instead.'
        },
        {
          group: ['@/app/*', '!@/app/studio/*'],
          message: 'Studio components should not import from common app directory.'
        },
        {
          group: ['../../../../components/*', '../../../components/*', '../../components/*'],
          message: 'Use absolute imports with @ alias instead of relative paths.'
        }
      ]
    }],

    // ============================================================================
    // Component Naming Conventions
    // ============================================================================
    
    'react/jsx-pascal-case': ['error', {
      allowAllCaps: false,
      ignore: []
    }],
    
    'react/function-component-definition': ['error', {
      namedComponents: 'arrow-function',
      unnamedComponents: 'arrow-function'
    }],

    // ============================================================================
    // TypeScript Strict Rules
    // ============================================================================
    
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': ['error', {
      allowExpressions: true,
      allowTypedFunctionExpressions: true,
      allowHigherOrderFunctions: true,
      allowDirectConstAssertionInArrowFunctions: true
    }],
    '@typescript-eslint/strict-boolean-expressions': ['error', {
      allowString: true,
      allowNumber: false,
      allowNullableObject: true,
      allowNullableBoolean: false,
      allowNullableString: false,
      allowNullableNumber: false,
      allowAny: false
    }],

    // ============================================================================
    // React Best Practices
    // ============================================================================
    
    'react/prop-types': 'off', // Using TypeScript
    'react/require-default-props': 'off', // Using TypeScript
    'react/no-unused-prop-types': 'error',
    'react/no-unused-state': 'error',
    'react/jsx-no-useless-fragment': 'error',
    'react/jsx-boolean-value': ['error', 'never'],
    'react/self-closing-comp': 'error',
    'react/jsx-sort-props': ['error', {
      callbacksLast: true,
      shorthandFirst: true,
      ignoreCase: true,
      reservedFirst: true
    }],

    // ============================================================================
    // Performance Rules
    // ============================================================================
    
    'react/jsx-no-bind': ['error', {
      allowArrowFunctions: true,
      allowFunctions: false,
      allowBind: false
    }],
    'react/no-unstable-nested-components': 'error',
    'react-hooks/exhaustive-deps': 'error',
    'react-hooks/rules-of-hooks': 'error',

    // ============================================================================
    // Accessibility Rules
    // ============================================================================
    
    'jsx-a11y/alt-text': 'error',
    'jsx-a11y/anchor-has-content': 'error',
    'jsx-a11y/anchor-is-valid': 'error',
    'jsx-a11y/aria-activedescendant-has-tabindex': 'error',
    'jsx-a11y/aria-props': 'error',
    'jsx-a11y/aria-proptypes': 'error',
    'jsx-a11y/aria-role': 'error',
    'jsx-a11y/aria-unsupported-elements': 'error',
    'jsx-a11y/click-events-have-key-events': 'error',
    'jsx-a11y/heading-has-content': 'error',
    'jsx-a11y/html-has-lang': 'error',
    'jsx-a11y/iframe-has-title': 'error',
    'jsx-a11y/img-redundant-alt': 'error',
    'jsx-a11y/interactive-supports-focus': 'error',
    'jsx-a11y/label-has-associated-control': 'error',
    'jsx-a11y/lang': 'error',
    'jsx-a11y/media-has-caption': 'warn',
    'jsx-a11y/mouse-events-have-key-events': 'error',
    'jsx-a11y/no-access-key': 'error',
    'jsx-a11y/no-autofocus': 'warn',
    'jsx-a11y/no-distracting-elements': 'error',
    'jsx-a11y/no-interactive-element-to-noninteractive-role': 'error',
    'jsx-a11y/no-noninteractive-element-interactions': 'error',
    'jsx-a11y/no-noninteractive-element-to-interactive-role': 'error',
    'jsx-a11y/no-onchange': 'error',
    'jsx-a11y/no-redundant-roles': 'error',
    'jsx-a11y/no-static-element-interactions': 'error',
    'jsx-a11y/role-has-required-aria-props': 'error',
    'jsx-a11y/role-supports-aria-props': 'error',
    'jsx-a11y/scope': 'error',
    'jsx-a11y/tabindex-no-positive': 'error',

    // ============================================================================
    // Security Rules
    // ============================================================================
    
    'react/no-danger': 'error',
    'react/no-danger-with-children': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',

    // ============================================================================
    // Custom Rules for AI Metadata
    // ============================================================================
    
    // These would typically be custom ESLint rules, but for now we'll use comments
    // TODO: Create custom ESLint plugin for AI metadata validation
  },
  
  overrides: [
    {
      files: ['*.test.ts', '*.test.tsx', '*.spec.ts', '*.spec.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'react/jsx-no-bind': 'off'
      }
    },
    {
      files: ['*.stories.tsx'],
      rules: {
        'react/jsx-no-bind': 'off',
        'react/function-component-definition': 'off'
      }
    }
  ],

  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json'
      }
    }
  }
};