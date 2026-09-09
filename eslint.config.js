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
  {
    // Audit F2 — Server Actions are public endpoints, so they must never accept the
    // caller's identity as an argument; a caller can simply state someone else's id.
    //
    // Scoped to the batches migrated so far (Phase 4a: the destructive FER, migration,
    // backfill, purge and seed actions). Widen this list as each later batch lands —
    // that way the rule never blocks work in progress but permanently locks in what is
    // already done.
    files: [
      'src/app/actions/*fer-action*.ts',
      'src/app/actions/*-migration-*.ts',
      'src/app/actions/*migration-actions.ts',
      'src/app/actions/backfill-*.ts',
      'src/app/actions/purge-*.ts',
      'src/app/actions/seed-*.ts',
    ],
    rules: {
      'no-restricted-syntax': ['error', {
        selector:
          'ExportNamedDeclaration > FunctionDeclaration > Identifier.params[name=/^(userId|actorId|currentUserId|performedBy)$/]',
        message:
          'Server Actions are public endpoints. Derive identity with authorizeBackofficeSession()/requireAuth() — never accept it as a parameter. See docs/audit/app_audit_fix.md (F2).',
      }],
    },
  },
];

export default config;
