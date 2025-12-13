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
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/.next/**',
      '**/out/**',
      '**/target/**',
      '**/*.min.js',
      '**/*.d.ts',
      'packages/core/tests/helpers/test-mcp-server.ts',
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
          allowDefaultProject: [
            'scripts/*.ts',
            '*.ts',
            '*.tsx',
            '*.mts',
            '*.cts',
            '*.config.ts',

            'packages/*/index.ts',
            'packages/*/vitest.config.ts',
          ],
          defaultProject: 'tsconfig.json',
        },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        // Node.js globals
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'readonly',
        module: 'readonly',
        require: 'readonly',
        global: 'readonly',
        // Web APIs available in Node.js
        performance: 'readonly',
        crypto: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        setImmediate: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        clearImmediate: 'readonly',
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
      'import/no-unresolved': 'warn',
      
      // Prevent self-imports
      'import/no-self-import': 'error',
      
      // Prevent useless path segments
      'import/no-useless-path-segments': ['error', { noUselessIndex: true }],
      
      // No mutable exports (prevents leaky abstractions)
      'import/no-mutable-exports': 'error',
      
      // Ensure consistent exports
      'import/no-named-as-default': 'warn',
      'import/no-named-as-default-member': 'error',
      
      // Prefer named exports for better refactoring
      'import/prefer-default-export': 'off',
      'import/no-default-export': 'warn',
      
      // Group and sort imports for clarity
      'import/order': [
        'warn',
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
      'unicorn/no-process-exit': 'warn',
      
      // No reassigning parameters (prevents side effects)
      'no-param-reassign': ['warn', { props: true }],

      // ============================================
      // ERROR HANDLING
      // Addresses: "Inconsistent patterns across modules"
      // ============================================
      
      // Must handle promise rejections
      'promise/catch-or-return': 'error',
      'promise/always-return': 'warn',
      'promise/no-return-wrap': 'error',
      
      // Prefer async/await over raw promises
      'promise/prefer-await-to-then': 'warn',
      'promise/prefer-await-to-callbacks': 'warn',
      
      // No floating promises (must be handled)
      '@typescript-eslint/no-floating-promises': 'warn',
      
      // Await must be used with promise-returning functions
      '@typescript-eslint/await-thenable': 'error',
      
      // No async functions without await
      'require-await': 'off',
      '@typescript-eslint/require-await': 'warn',
      
      // Promises in wrong places
      '@typescript-eslint/no-misused-promises': [
        'warn',
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
      'sonarjs/cognitive-complexity': ['warn', 15],
      
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
      'sonarjs/no-identical-functions': 'warn',
      'sonarjs/no-duplicated-branches': 'warn',
      'sonarjs/no-collapsible-if': 'warn',
      
      // Prevent dead code
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
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
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      
      // No debugger statements
      'no-debugger': 'error',
      
      // No alert/confirm/prompt
      'no-alert': 'error',
      
      // Prevent nested callbacks (callback hell)
      'max-nested-callbacks': ['warn', 3],
      
      // Prevent deeply nested code
      'max-depth': ['warn', 4],
      
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
      // Warn on unbound methods (potential `this` issues)
      '@typescript-eslint/unbound-method': 'warn',

      // ============================================
      // GENERAL TYPE SAFETY
      // Prevents common bugs and improves maintainability
      // ============================================
      
      // No any type (downgraded to warn for development)
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      
      // Consistent type assertions
      '@typescript-eslint/consistent-type-assertions': [
        'warn',
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
      '@typescript-eslint/no-non-null-assertion': 'warn',
      
      // Prevent confusing void expressions
      '@typescript-eslint/no-confusing-void-expression': 'error',
      
      // Require array type to be consistent
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],

      // ============================================
      // SECURITY
      // Prevents common security issues
      // ============================================
      // Prevent unsafe security patterns
      'security/detect-unsafe-regex': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-buffer-noassert': 'warn',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'warn',
      'security/detect-eval-with-expression': 'warn',
      'security/detect-no-csrf-before-method-override': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-require': 'warn',
      'security/detect-object-injection': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'warn',
      // ============================================
      // UNICORN: ADDITIONAL BEST PRACTICES
      // ============================================
      
      // Better error messages
      'unicorn/error-message': 'error',
      
      // Prevent abbreviations (better readability)
      'unicorn/prevent-abbreviations': [
        'warn',
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
            idx: true,
            temp: true,
            dir: true,
            Dir: true,
            util: true,
            utils: true,
            msg: true,
            img: true,
          },
        },
      ],
      
      // Use modern JS features
      'unicorn/prefer-modern-dom-apis': 'error',
      // Prefer regex exec over match for performance
      'unicorn/prefer-regexp-test': 'error',
      'unicorn/better-regex': 'error',
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

      // Allow numbers in template expressions
      '@typescript-eslint/restrict-template-expressions': [
        'warn',
        {
          allowNumber: true,
          allowBoolean: true,
          allowAny: true,
          allowNullish: true,
          allowRegExp: false,
        },
      ],
      
      // Prefer using nullish coalescing operator
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      
      // Ban @ts-comment except @ts-expect-error
      '@typescript-eslint/ban-ts-comment': 'warn',
      
      // No unnecessary conditions
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      
      // Restrict plus operands
      '@typescript-eslint/restrict-plus-operands': 'warn',
      
      // No empty functions
      '@typescript-eslint/no-empty-function': 'warn',
      
      // Use unknown in catch variables
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'warn',
      
      // No require imports
      '@typescript-eslint/no-require-imports': 'warn',
      
      // Additional rules to downgrade for commits
      'no-undef': 'warn',
      'no-fallthrough': 'warn',
      'no-empty': 'warn',
      'no-case-declarations': 'warn',
      '@typescript-eslint/no-unnecessary-type-parameters': 'warn',
      'no-useless-escape': 'warn',
      'no-unreachable': 'warn',
      'no-sparse-arrays': 'warn',
      'no-constant-binary-expression': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/prefer-for-of': 'warn',
      '@typescript-eslint/no-redundant-type-constituents': 'warn',
    },
  },

  // ============================================
  // TEST FILES - Relaxed Rules
  // ============================================
  {
    files: [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/__tests__/**/*.ts',
      '**/tests/**/*.ts',
      '**/test/**/*.ts',
      'packages/**/tests/**/*.ts',
      'packages/**/test/**/*.ts',
    ],
    rules: {
      // Allow any in tests for mocking
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      
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
      
      // Allow abbreviations in tests
      'unicorn/prevent-abbreviations': 'off',
      
      // Allow node protocol violations mostly in tests if needed (though fixes are better)
      'unicorn/prefer-node-protocol': 'warn',

      // Allow relative parent imports in tests (often needed for testing internals)
      'import/no-relative-parent-imports': 'off',
    },
  },

  // ============================================
  // JAVASCRIPT FILES - Node.js Globals
  // ============================================
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'readonly',
        module: 'readonly',
        require: 'readonly',
        global: 'readonly',
        performance: 'readonly',
        crypto: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        setImmediate: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        clearImmediate: 'readonly',
      },
    },
    rules: {
      'no-undef': 'warn',
      'no-console': 'warn',
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