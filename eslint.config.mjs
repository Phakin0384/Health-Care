import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

// eslint-config-next 16 ships native flat configs, so they are spread directly
// rather than wrapped in FlatCompat.
const config = [
  {
    // Build output and dependencies are not ours to lint.
    ignores: ['.next/**', 'dist/**', 'node_modules/**', 'next-env.d.ts'],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // Unused values are usually a leftover; an underscore prefix marks the
      // ones that are deliberately discarded (destructured-and-dropped keys).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
];

export default config;
