import nextConfig from 'eslint-config-next/core-web-vitals';

/*
 * CAUTION (flat config): when two blocks match the same file, a later block's `no-restricted-syntax`
 * REPLACES the earlier one's array instead of merging. Every block that sets this rule must therefore
 * include every selector that applies to its files — use these shared constants, never inline copies.
 */

/** Audit F2: server actions are public endpoints and must never accept the caller's identity. */
const IDENTITY_PARAM_BAN = {
  selector:
    'ExportNamedDeclaration > FunctionDeclaration > Identifier.params[name=/^(userId|actorId|currentUserId|performedBy)$/]',
  message:
    'Server Actions are public endpoints. Derive identity with authorizeBackofficeSession()/requireAuth() — never accept it as a parameter. See docs/audit/app_audit_fix.md (F2).',
};

/** Rule 4: no unchecked double casts; validate with a schema at the boundary instead. */
const DOUBLE_CAST_BAN = {
  selector: "TSAsExpression[expression.type='TSAsExpression'][expression.typeAnnotation.type='TSUnknownKeyword']",
  message: 'Unchecked double cast (`as unknown as T`). Validate with a Zod schema at the boundary instead (Rule 4).',
};

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
      'src/app/actions/portal-*.ts',
      'src/app/actions/membership-actions.ts',
      'src/app/actions/learning-actions.ts',
      'src/app/actions/community-actions.ts',
      'src/lib/mcp/actions/*.ts',
    ],
    rules: {
      'no-restricted-syntax': ['error', IDENTITY_PARAM_BAN],
    },
  },
  {
    // agents_mcp build plan A2 / Rule 4: no `any`, no unsafe flows and no unchecked double casts in the
    // capability platform and the trusted cores. Type-aware (projectService), scoped to keep lint fast
    // (~20 s). Widen `files` as new core modules are added (src/lib/crm/** lands in PR-1).
    files: [
      'src/platform/**/*.ts',
      'src/lib/tasks/**/*.ts',
      'src/lib/auth/require-portal-access.ts',
      'src/lib/security/cloud-tasks-auth.ts',
      'src/lib/security/cloud-tasks-oidc.ts',
    ],
    ignores: ['**/__tests__/**'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      // Includes IDENTITY_PARAM_BAN so widening `files` over action modules can never drop audit F2.
      'no-restricted-syntax': ['error', IDENTITY_PARAM_BAN, DOUBLE_CAST_BAN],
    },
  },
];

export default config;
