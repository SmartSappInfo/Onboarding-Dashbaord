/**
 * @fileoverview Impersonation Sandbox Launch Modal
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Creates an audit-logged 30-minute sandbox support session into a tenant organization.
 * - Opens in a dedicated browser tab with sandbox mode flags.
 * - Minimum touch target >= 44px for mobile devices.
 */

'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Shield, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { useBackofficeToken } from '@/hooks/use-backoffice-token';
import { useToast } from '@/hooks/use-toast';
import { createImpersonationSessionAction } from '@/lib/backoffice/backoffice-health-actions';

interface ImpersonationLaunchModalProps {
  readonly organizationId: string | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export default function ImpersonationLaunchModal({
  organizationId,
  open,
  onOpenChange,
}: ImpersonationLaunchModalProps) {
  const getToken = useBackofficeToken();
  const { toast } = useToast();
  const [isLaunching, setIsLaunching] = React.useState(false);

  const handleLaunch = async () => {
    if (!organizationId) return;
    setIsLaunching(true);
    try {
      const idToken = await getToken();
      const res = await createImpersonationSessionAction(organizationId, undefined, idToken);

      if (res.success && res.redirectUrl) {
        toast({
          title: 'Sandbox Session Created',
          description: `Opening support workspace. Session expires in ${res.expiresInMinutes} minutes.`,
        });
        window.open(res.redirectUrl, '_blank', 'noopener,noreferrer');
        onOpenChange(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Impersonation Failed',
          description: res.error || 'Failed to create sandbox session.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to launch impersonation session.',
      });
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border shadow-2xl rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Launch Support Sandbox
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Audit-logged tenant impersonation mode.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300 space-y-2">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Compliance & Security Warning
          </div>
          <p className="text-[11px] leading-relaxed opacity-90">
            This session is strictly logged to the immutable Backoffice Audit Trail with your verified credentials. 
            All actions taken within the tenant workspace are recorded. The session will automatically expire after 30 minutes.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLaunching}
            className="h-11 rounded-xl text-xs font-semibold active:scale-[0.97]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleLaunch}
            disabled={isLaunching}
            className="h-11 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/20 active:scale-[0.97] transition-all gap-2"
          >
            {isLaunching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            {isLaunching ? 'Opening...' : 'Launch Sandbox Tab'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
