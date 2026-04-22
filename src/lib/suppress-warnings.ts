/**
 * Suppress known harmless warnings in development
 * 
 * This filters out warnings that are expected behavior and don't indicate actual issues.
 */

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const originalError = console.error;
  
  console.error = (...args: any[]) => {
    // Suppress next-themes script tag warning (React 19)
    // This is expected behavior - next-themes injects a script to prevent FOUC
    if (
      typeof args[0] === 'string' &&
      args[0].includes('script tag while rendering React component')
    ) {
      return;
    }
    
    originalError.apply(console, args);
  };
}

export {};
