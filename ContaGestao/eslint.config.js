import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'data/**', 'coverage/**'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
    },
  },
  {
    files: ['scripts/**/*.js'],
    rules: { 'no-console': 'off' },
  },
];
