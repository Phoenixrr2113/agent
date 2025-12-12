// eslint.config.ts
// Comprehensive ESLint configuration for TypeScript projects
// Addresses: Module Boundaries, Dependency Management, Error Handling,
// Testability, Separation of Concerns, and general code quality

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import promise from 'eslint-plugin-promise';
import security from 'eslint-plugin-security';
export default tseslint.config(
  // ============================================
  // IGNORE PATTERNS
  // ============================================
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.d.ts',
      '**/build/**',
    ],
  },

  // ============================================
  // BASE ESLINT RECOMMENDED
  // ============================================
  eslint.configs.recommended,



  // ============================================
  // MAIN CONFIGURATION
  // ============================================
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    extends: [
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['scripts/*.ts', '*.ts', '*.tsx', '*.mts', '*.cts', '*.config.ts'],
          defaultProject: 'tsconfig.json',
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      import: importPlugin,
      sonarjs,
      unicorn,
      promise,
      security,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: true,
      },
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx', '.mts', '.cts'],
      },
    },
    rules: {
      // ============================================
      // MODULE BOUNDARIES & CIRCULAR DEPENDENCIES
      // Addresses: "Leaky abstractions, circular dependencies"
      // ============================================
      
      // CRITICAL: Detect circular dependencies
      'import/no-cycle': ['error', { maxDepth: Infinity, ignoreExternal: true }],
      
      // Prevent importing from parent directories (enforces clean architecture)
      'import/no-relative-parent-imports': 'warn',
      
      // Ensure imports resolve to actual modules
      'import/no-unresolved': 'error',
      
      // Prevent self-imports
      'import/no-self-import': 'error',
      
      // Prevent useless path segments
      'import/no-useless-path-segments': ['error', { noUselessIndex: true }],
      
      // No mutable exports (prevents leaky abstractions)
      'import/no-mutable-exports': 'error',
      
      // Ensure consistent exports
      'import/no-named-as-default': 'error',
      'import/no-named-as-default-member': 'error',
      
      // Prefer named exports for better refactoring
      'import/prefer-default-export': 'off',
      'import/no-default-export': 'warn',
      
      // Group and sort imports for clarity
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling'],
            'index',
            'type',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      // ============================================
      // DEPENDENCY MANAGEMENT
      // Addresses: "Heavy reliance on singletons and globals"
      // ============================================
      
      // Prevent global variables (except for known safe ones)
      'no-restricted-globals': [
        'error',
        {
          name: 'event',
          message: 'Use local parameter instead.',
        },
        {
          name: 'fdescribe',
          message: 'Do not commit focused tests.',
        },
        {
          name: 'fit',
          message: 'Do not commit focused tests.',
        },
      ],
      
      // Discourage global state modifications
      'no-global-assign': 'error',
      
      // Warn on mutable let when const would work
      'prefer-const': 'error',
      
      // No var declarations (use const/let)
      'no-var': 'error',
      
      // Prevent accidental singleton patterns via module-level state
      'unicorn/no-static-only-class': 'error',
      
      // Prevent process.exit calls (use proper error handling)
      'unicorn/no-process-exit': 'error',
      
      // No reassigning parameters (prevents side effects)
      'no-param-reassign': ['error', { props: true }],

      // ============================================
      // ERROR HANDLING
      // Addresses: "Inconsistent patterns across modules"
      // ============================================
      
      // Must handle promise rejections
      'promise/catch-or-return': 'error',
      'promise/always-return': 'error',
      'promise/no-return-wrap': 'error',
      
      // Prefer async/await over raw promises
      'promise/prefer-await-to-then': 'warn',
      'promise/prefer-await-to-callbacks': 'warn',
      
      // No floating promises (must be handled)
      '@typescript-eslint/no-floating-promises': 'error',
      
      // Await must be used with promise-returning functions
      '@typescript-eslint/await-thenable': 'error',
      
      // No async functions without await
      'require-await': 'off',
      '@typescript-eslint/require-await': 'error',
      
      // Promises in wrong places
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      
      // Must use try-catch properly
      'no-throw-literal': 'off',
      '@typescript-eslint/only-throw-error': 'error',
      
      // Handle all switch cases
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      
      // Consistent error handling patterns
      'unicorn/catch-error-name': ['error', { name: 'error' }],
      'unicorn/prefer-type-error': 'error',

      // ============================================
      // TESTABILITY & CODE QUALITY
      // Addresses: "Good isolation in some areas, gaps in others"
      // ============================================
      
      // Cognitive complexity (prevents overly complex functions)
      'sonarjs/cognitive-complexity': ['error', 15],
      
      // Maximum function length
      'max-lines-per-function': [
        'warn',
        { max: 50, skipBlankLines: true, skipComments: true },
      ],
      
      // Maximum file length
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
      
      // Limit function parameters (easier to test)
      'max-params': ['warn', 4],
      
      // Prevent duplicate code
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-duplicated-branches': 'error',
      
      // Prevent dead code
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      
      // No side effects in expressions
      'no-sequences': 'error',
      
      // Explicit return types for public API (better testability)
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],
      
      // Explicit module boundary types
      '@typescript-eslint/explicit-module-boundary-types': 'warn',

      // ============================================
      // SEPARATION OF CONCERNS
      // Addresses: "Generally good, some mixing"
      // ============================================
      
      // No console statements (use proper logging)
      'no-console': ['error', { allow: ['warn', 'error'] }],
      
      // No debugger statements
      'no-debugger': 'error',
      
      // No alert/confirm/prompt
      'no-alert': 'error',
      
      // Prevent nested callbacks (callback hell)
      'max-nested-callbacks': ['error', 3],
      
      // Prevent deeply nested code
      'max-depth': ['error', 4],
      
      // Single responsibility: one class per file pattern
      'max-classes-per-file': ['error', 1],
      
      // Consistent member ordering in classes
      '@typescript-eslint/member-ordering': [
        'error',
        {
          default: [
            'static-field',
            'instance-field',
            'constructor',
            'static-method',
            'instance-method',
          ],
        },
      ],

      // ============================================
      // GENERAL TYPE SAFETY
      // Prevents common bugs and improves maintainability
      // ============================================
      
      // No any type
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      
      // Consistent type assertions
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {
          assertionStyle: 'as',
          objectLiteralTypeAssertions: 'never',
        },
      ],
      
      // Consistent type imports
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      
      // No non-null assertions (use proper null checks)
      '@typescript-eslint/no-non-null-assertion': 'error',
      
      // Prevent confusing void expressions
      '@typescript-eslint/no-confusing-void-expression': 'error',
      
      // Require array type to be consistent
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],

      // ============================================
      // SECURITY
      // Prevents common security issues
      // ============================================
      
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-possible-timing-attacks': 'warn',

      // ============================================
      // UNICORN: ADDITIONAL BEST PRACTICES
      // ============================================
      
      // Better error messages
      'unicorn/error-message': 'error',
      
      // Prevent abbreviations (better readability)
      'unicorn/prevent-abbreviations': [
        'error',
        {
          allowList: {
            props: true,
            Props: true,
            ref: true,
            Ref: true,
            args: true,
            params: true,
            Params: true,
            env: true,
            Env: true,
            req: true,
            Req: true,
            res: true,
            Res: true,
            err: true,
            ctx: true,
            Ctx: true,
            db: true,
            Db: true,
          },
        },
      ],
      
      // Use modern JS features
      'unicorn/prefer-modern-dom-apis': 'error',
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/prefer-string-replace-all': 'error',
      'unicorn/prefer-array-find': 'error',
      'unicorn/prefer-array-flat': 'error',
      'unicorn/prefer-array-flat-map': 'error',
      'unicorn/prefer-includes': 'error',
      'unicorn/prefer-at': 'error',
      
      // No array.reduce (often less readable)
      'unicorn/no-array-reduce': 'warn',
      
      // Explicit length checks
      'unicorn/explicit-length-check': 'error',
      
      // No nested ternary
      'unicorn/no-nested-ternary': 'error',
      
      // No useless undefined
      'unicorn/no-useless-undefined': 'error',
      
      // Require Array.isArray instead of instanceof
      'unicorn/no-instanceof-array': 'error',

      // ============================================
      // SONARJS: CODE SMELLS
      // ============================================
      
      // No identical conditions
      'sonarjs/no-identical-conditions': 'error',
      
      // No collapsible if statements
      'sonarjs/no-collapsible-if': 'error',
      
      // No redundant boolean
      'sonarjs/no-redundant-boolean': 'error',
      
      // No inverted boolean check
      'sonarjs/no-inverted-boolean-check': 'error',
      
      // No same line conditional
      'sonarjs/no-same-line-conditional': 'error',
      
      // No collection size mischeck
      'sonarjs/no-collection-size-mischeck': 'error',
      
      // No gratuitous expressions
      'sonarjs/no-gratuitous-expressions': 'error',
    },
  },

  // ============================================
  // TEST FILES - Relaxed Rules
  // ============================================
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**/*.ts'],
    rules: {
      // Allow any in tests for mocking
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      
      // Allow magic numbers in tests
      '@typescript-eslint/no-magic-numbers': 'off',
      
      // Allow longer functions in tests
      'max-lines-per-function': 'off',
      
      // Allow multiple classes for test organization
      'max-classes-per-file': 'off',
      
      // Allow non-null assertions in tests
      '@typescript-eslint/no-non-null-assertion': 'off',
      
      // Allow focusing tests during development
      'no-restricted-globals': 'off',
    },
  },

  // ============================================
  // CONFIG FILES - Relaxed Rules
  // ============================================
  {
    files: [
      '*.config.ts',
      '*.config.js',
      '*.config.mjs',
      'eslint.config.*',
      'vite.config.*',
      'jest.config.*',
    ],
    rules: {
      'import/no-default-export': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
);