'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
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
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const openCallModal = useCallback((newParams: CallContextParams) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setParams(newParams);
    setIsOpen(true);
  }, []);

  const closeCallModal = useCallback(() => {
    setIsOpen(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // Delay clearing params to allow exit animation to run smoothly without unmounting abruptly
    timerRef.current = setTimeout(() => {
      setParams(null);
      timerRef.current = null;
    }, 300);
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
