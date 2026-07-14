'use client';

import React from 'react';
import type { ResolvedSurveyIdentity, VariableValuesMap } from '@/lib/types/survey-variable-types';

interface SurveyVariableContextValue {
  identity: ResolvedSurveyIdentity;
  variableMap: VariableValuesMap;
  setIdentity: (identity: ResolvedSurveyIdentity) => void;
}

const DEFAULT_IDENTITY: ResolvedSurveyIdentity = {
  respondentEntityId: null,
  recipientContact: null,
  trackingRef: null,
  channel: 'direct',
  variableMap: {},
};

export const SurveyVariableContext = React.createContext<SurveyVariableContextValue>({
  identity: DEFAULT_IDENTITY,
  variableMap: {},
  setIdentity: () => {},
});

interface SurveyVariableProviderProps {
  children: React.ReactNode;
  surveySlug: string;
  initialIdentity: ResolvedSurveyIdentity;
}

export function SurveyVariableProvider({ children, surveySlug, initialIdentity }: SurveyVariableProviderProps) {
  const [identity, setIdentityState] = React.useState<ResolvedSurveyIdentity>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(`survey_identity_${surveySlug}`);
        if (stored) {
          const parsed = JSON.parse(stored) as ResolvedSurveyIdentity;
          // Only restore if initialIdentity has no resolved identity (avoids overriding fresh resolution)
          if (!initialIdentity.respondentEntityId && !initialIdentity.recipientContact) {
            return parsed;
          }
        }
      } catch {
        // sessionStorage unavailable in cross-origin iframes
      }
    }
    return initialIdentity;
  });

  const setIdentity = React.useCallback((newIdentity: ResolvedSurveyIdentity) => {
    setIdentityState(newIdentity);
    try {
      sessionStorage.setItem(`survey_identity_${surveySlug}`, JSON.stringify(newIdentity));
    } catch {
      // Silently fail in cross-origin iframe contexts
    }
  }, [surveySlug]);

  const value = React.useMemo<SurveyVariableContextValue>(() => ({
    identity,
    variableMap: identity.variableMap,
    setIdentity,
  }), [identity, setIdentity]);

  return (
    <SurveyVariableContext.Provider value={value}>
      {children}
    </SurveyVariableContext.Provider>
  );
}

export function useSurveyVariables() {
  return React.useContext(SurveyVariableContext);
}
