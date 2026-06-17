import * as React from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import type { UserProfile } from '@/lib/types';

export function useLiveAiModel() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [provider, setProvider] = React.useState('googleai');
  const [modelId, setModelId] = React.useState('gemini-3-flash-preview');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!firestore) return;

    let unsubUser = () => {};
    let globalDefaultProvider = 'googleai';
    let globalDefaultModelId = 'gemini-3-flash-preview';

    // 1. Subscribe to global default AI settings
    const configRef = doc(firestore, 'system_settings', 'ai_config');
    const unsubConfig = onSnapshot(configRef, (configSnap) => {
      if (configSnap.exists()) {
        const configData = configSnap.data();
        if (configData.defaultProvider) {
          globalDefaultProvider = configData.defaultProvider;
        }
        if (configData.defaultModelId) {
          globalDefaultModelId = configData.defaultModelId;
        }
      }

      // If user is not logged in or doesn't have custom preference yet, use global defaults
      if (!user) {
        setProvider(globalDefaultProvider);
        setModelId(globalDefaultModelId);
        setLoading(false);
      }
    }, (error) => {
      console.error('[LIVE-AI-MODEL] Global config subscription error:', error);
      if (!user) {
        setLoading(false);
      }
    });

    // 2. Subscribe to user profile custom preferences
    if (user) {
      const userRef = doc(firestore, 'users', user.uid);
      unsubUser = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          
          let preferredAiProvider = data.preferredAiProvider || globalDefaultProvider;
          let preferredAiModel = data.preferredAiModel || globalDefaultModelId;

          // Migrate legacy openai/gpt preferences to anthropic/claude-sonnet-4-6
          if (preferredAiProvider === 'openai') {
            preferredAiProvider = 'anthropic';
            preferredAiModel = 'claude-sonnet-4-6';
          }

          setProvider(preferredAiProvider);
          setModelId(preferredAiModel);
        } else {
          setProvider(globalDefaultProvider);
          setModelId(globalDefaultModelId);
        }
        setLoading(false);
      }, (error) => {
        console.error('[LIVE-AI-MODEL] User subscription error:', error);
        setLoading(false);
      });
    }

    return () => {
      unsubConfig();
      unsubUser();
    };
  }, [user, firestore]);

  return { provider, modelId, loading };
}
