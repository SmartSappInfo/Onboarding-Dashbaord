'use client';

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export interface ConfirmOptions {
  /** Heading. Defaults to "Are you sure?". */
  title?: string;
  /** Body copy explaining the consequence. */
  description?: React.ReactNode;
  /** Confirm button label. Defaults to "Confirm". */
  confirmText?: string;
  /** Cancel button label. Defaults to "Cancel". */
  cancelText?: string;
  /** 'destructive' paints the confirm button with the destructive theme color. */
  variant?: 'default' | 'destructive';
}

type ConfirmFn = (options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

/**
 * Promise-based confirmation, themed with the app's AlertDialog.
 *
 * Drop-in replacement for the blocking `window.confirm()`:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Delete note?', variant: 'destructive' }))) return;
 *
 * Resolves `true` on confirm, `false` on cancel / dismiss.
 */
export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ConfirmState>({ open: false, options: {} });
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null);

  const confirm = React.useCallback<ConfirmFn>((options = {}) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ open: true, options });
    });
  }, []);

  const settle = React.useCallback((result: boolean) => {
    setState((prev) => ({ ...prev, open: false }));
    resolverRef.current?.(result);
    resolverRef.current = null;
  }, []);

  const { options } = state;
  const isDestructive = options.variant === 'destructive';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={state.open} onOpenChange={(open) => { if (!open) settle(false); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{options.title ?? 'Are you sure?'}</AlertDialogTitle>
            <AlertDialogDescription className={!options.description ? 'hidden' : undefined}>
              {options.description || ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)} className="rounded-xl">
              {options.cancelText ?? 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => settle(true)}
              className={cn(
                'rounded-xl',
                isDestructive && 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              )}
            >
              {options.confirmText ?? 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}
