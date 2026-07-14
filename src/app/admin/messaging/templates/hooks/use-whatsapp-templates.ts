'use client';

/**
 * @fileOverview Encapsulates loading/syncing the org's Meta-mirror WhatsApp
 * templates (SRP — extracted from the former WhatsAppTemplatePanel). No-ops
 * cleanly when there is no user or organization so callers never crash and can
 * render an inline notice instead of silently hiding the feature.
 */
import * as React from 'react';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { listWhatsAppTemplates, syncWhatsAppTemplates } from '@/lib/whatsapp-template-actions';
import { getWhatsAppConnection } from '@/lib/whatsapp-actions';
import type { WhatsAppTemplate } from '@/lib/whatsapp/whatsapp-types';

export interface UseWhatsAppTemplatesResult {
  templates: WhatsAppTemplate[];
  isLoading: boolean;
  /** Action error message (e.g. permission/connection), or null. */
  error: string | null;
  isSyncing: boolean;
  sync: () => Promise<void>;
  refetch: () => Promise<void>;
  connected: boolean;
}

export function useWhatsAppTemplates(organizationId: string): UseWhatsAppTemplatesResult {
  const { user } = useUser();
  const { toast } = useToast();
  const [templates, setTemplates] = React.useState<WhatsAppTemplate[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [connected, setConnected] = React.useState(false);

  const refetch = React.useCallback(async () => {
    if (!user || !organizationId) {
      setTemplates([]);
      setError(null);
      setIsLoading(false);
      setConnected(false);
      return;
    }
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken();
      const [connRes, res] = await Promise.all([
        getWhatsAppConnection(idToken, organizationId),
        listWhatsAppTemplates(idToken, organizationId)
      ]);

      if (connRes.success && connRes.data) {
        setConnected(true);
      } else {
        setConnected(false);
      }

      if (res.success) {
        setTemplates(res.data);
        setError(null);
      } else {
        setTemplates([]);
        setError(res.error);
      }
    } catch (e) {
      setTemplates([]);
      setConnected(false);
      setError(e instanceof Error ? e.message : 'Failed to load WhatsApp templates.');
    } finally {
      setIsLoading(false);
    }
  }, [user, organizationId]);

  React.useEffect(() => {
    refetch();
  }, [refetch]);

  const sync = React.useCallback(async () => {
    if (!user || !organizationId) return;
    setIsSyncing(true);
    try {
      const idToken = await user.getIdToken();
      const res = await syncWhatsAppTemplates(idToken, organizationId);
      if (res.success) {
        setTemplates(res.data.templates);
        setError(null);
        setConnected(true);
        toast({ title: 'Synced', description: `${res.data.count} template(s) pulled from Meta.` });
      } else {
        setError(res.error);
        toast({ variant: 'destructive', title: 'Sync failed', description: res.error });
      }
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: e instanceof Error ? e.message : 'Sync failed.',
      });
    } finally {
      setIsSyncing(false);
    }
  }, [user, organizationId, toast]);

  return { templates, isLoading, error, isSyncing, sync, refetch, connected };
}
