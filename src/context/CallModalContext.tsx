'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { CallNowModal } from '@/components/call-centre/CallNowModal';

export interface CallContextParams {
  entityId: string;
  dealId?: string;
  contactId?: string;
  contactName?: string;
  phone?: string;
  email?: string;
}

interface CallModalContextValue {
  openCallModal: (params: CallContextParams) => void;
  closeCallModal: () => void;
}

const CallModalContext = createContext<CallModalContextValue | undefined>(undefined);

export function CallModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [params, setParams] = useState<CallContextParams | null>(null);

  const openCallModal = useCallback((newParams: CallContextParams) => {
    setParams(newParams);
    setIsOpen(true);
  }, []);

  const closeCallModal = useCallback(() => {
    setIsOpen(false);
    // Delay clearing params to allow exit animation to run smoothly
    setTimeout(() => setParams(null), 300);
  }, []);

  const value = useMemo(() => ({ openCallModal, closeCallModal }), [openCallModal, closeCallModal]);

  return (
    <CallModalContext.Provider value={value}>
      {children}
      {params && (
        <CallNowModal
          isOpen={isOpen}
          onClose={closeCallModal}
          params={params}
        />
      )}
    </CallModalContext.Provider>
  );
}

export function useCallModal() {
  const context = useContext(CallModalContext);
  if (!context) {
    throw new Error('useCallModal must be used within a CallModalProvider');
  }
  return context;
}
