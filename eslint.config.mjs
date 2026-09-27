import js from '@eslint/js';
import globals from 'globals';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'out/**', 'node_modules/**', 'stitch_worktrack_productivity_suite/**'] },

  js.configs.recommended,
  ...tsPlugin.configs['flat/recommended'],

  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // TypeScript already reports unused locals/params (noUnusedLocals); keep
      // the lint rule for the `_`-prefixed escape hatch only.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },

  // Electron main process + preload (Node)
  {
    files: ['src/main/**/*.ts', 'src/shared/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Renderer (React, browser)
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off',
      // Apostrophes/quotes in JSX text render fine; escaping them hurts readability.
      'react/no-unescaped-entities': 'off',
    },
  },
];
