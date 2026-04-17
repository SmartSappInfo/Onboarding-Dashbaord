import nextConfig from 'eslint-config-next/core-web-vitals';

/** @type {import('eslint').Linter.Config[]} */
const config = [
  ...nextConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react-hooks/exhaustive-deps': 'warn',
      // Suppress noisy experimental rules from Next.js 16 react-hooks plugin
      'react-hooks/static-components': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/error-boundaries': 'off',
    },
  },
  {
    files: ['**/*.tsx'],
    rules: {
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
      'react/no-unescaped-entities': 'warn',
    },
  },
];

export default config;
