/**
 * @fileOverview Suppress known harmless warnings in development.
 * 
 * DESIGN RATIONALE:
 * In React 19 (used by Next.js 16+), React introduces a development-only warning:
 * "Encountered a script tag while rendering React component. Scripts inside React components
 * are never executed when rendering on the client..."
 * 
 * `next-themes` injects an inline `<script>` (ThemeScript) into the component tree to prevent
 * Flash of Unstyled Content (FOUC) by resolving stored theme preferences before browser paint.
 * This script is executed by the browser during initial HTML parse, but React 19's client
 * reconciler flags it as an advisory warning.
 * 
 * This module filters out this specific false positive in development on both client and server,
 * preventing console clutter and Turbopack dev error modal popups without masking genuine errors.
 */

if (process.env.NODE_ENV === 'development') {
  const originalError = console.error;
  const isAlreadyPatched = (console.error as { __react19ScriptPatch?: boolean }).__react19ScriptPatch;

  if (!isAlreadyPatched) {
    const patchedError = (...args: unknown[]) => {
      // Suppress next-themes script tag warning in React 19
      const isScriptWarning = args.some(
        (arg) => typeof arg === 'string' && (
          arg.includes('script tag while rendering React component') ||
          arg.includes('Encountered a script tag')
        )
      );

      if (isScriptWarning) {
        return;
      }

      originalError.apply(console, args);
    };

    patchedError.__react19ScriptPatch = true;
    console.error = patchedError;
  }
}

export {};

