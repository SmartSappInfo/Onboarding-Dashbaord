'use client';

/**
 * SmartSapp Finance 2.0 - Financial Audit Log Modal
 * Displays point-in-time chronological audit trail for any financial document.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldAlert, User, Loader2 } from 'lucide-react';
import { FinancialAuditLog } from '@/lib/types';
import { getDocumentAuditHistoryAction } from '@/lib/audit-actions';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';

export interface FinancialAuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentNumber?: string;
  documentType: string;
}

export function FinancialAuditLogModal({
  isOpen,
  onClose,
  documentId,
  documentNumber,
  documentType,
}: FinancialAuditLogModalProps) {
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const [logs, setLogs] = React.useState<FinancialAuditLog[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    if (isOpen && activeWorkspaceId && user?.uid) {
      setIsLoading(true);
      getDocumentAuditHistoryAction(documentId, activeWorkspaceId, user.uid)
        .then((res) => {
          if (res.success && res.logs) setLogs(res.logs);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, documentId, activeWorkspaceId, user?.uid]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-2xl p-6 max-h-[85vh] flex flex-col">
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <ShieldAlert className="h-4 w-4" />
            Immutable Audit Trail
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            Audit History: {documentNumber || documentId}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Complete chronological record of all modifications, state changes, and authorizations for this {documentType}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 py-3 space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs font-semibold">Loading audit logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs font-medium">
              No audit logs recorded for this document.
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="p-3 rounded-xl border bg-card text-xs space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="font-mono text-[10px] text-primary border-primary/20">
                      {log.action}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {log.timestamp.replace('T', ' ').substring(0, 19)}
                    </span>
                  </div>

                  <p className="font-semibold text-foreground">
                    {log.changeSummary}
                  </p>

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-0.5">
                    <User className="h-3 w-3" />
                    <span>Actor: <strong className="text-foreground">{log.performedByName}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 border-t flex justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-xl h-10 min-h-[44px] text-xs font-semibold active:scale-[0.97]"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
