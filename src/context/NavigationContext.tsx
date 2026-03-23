'use client';

import * as React from 'react';

/**
 * @fileOverview Navigation Context Provider.
 * Stores dynamic labels for paths to allow breadcrumbs to show 
 * entity names (e.g. School Name) instead of technical IDs.
 */

interface NavigationContextType {
  customLabels: Record<string, string>;
  setCustomLabel: (path: string, label: string) => void;
}

const NavigationContext = React.createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [customLabels, setCustomLabels] = React.useState<Record<string, string>>({});

  const setCustomLabel = React.useCallback((path: string, label: string) => {
    setCustomLabels(prev => {
      // Avoid unnecessary state updates if label is already set
      if (prev[path] === label) return prev;
      return { ...prev, [path]: label };
    });
  }, []);

  const value = React.useMemo(() => ({ customLabels, setCustomLabel }), [customLabels, setCustomLabel]);

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = React.useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
