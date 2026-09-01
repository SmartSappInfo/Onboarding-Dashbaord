'use client';

/**
 * @fileOverview Access Explainer Audit Dialog (Authorization 2.0)
 *
 * Visual audit inspector that answers: "Why does this team member have (or lack) access?"
 * Displays the resolution tree from Tenant Membership down through Scoped Role Assignments.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Dialog with responsive ergonomics and clear tree hierarchy nodes.
 * - Calls `explainUserAccessAction` for deterministic server-side audit logs.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  Shield,
  Building,
  Layers,
  Info,
} from 'lucide-react';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import type { AccessExplanation } from '@/lib/types';
import { explainUserAccessAction } from '@/app/actions/authorization-actions';

interface AccessExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  personId: string;
  personName: string;
  permissionId: string;
  workspaceId?: string;
}

export function AccessExplainerModal({
  isOpen,
  onClose,
  personId,
  personName,
  permissionId,
  workspaceId,
}: AccessExplainerModalProps) {
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [isLoading, setIsLoading] = React.useState(false);
  const [explanation, setExplanation] = React.useState<AccessExplanation | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    async function loadExplanation() {
      if (!isOpen || !authUser || !activeOrganizationId || !personId || !permissionId) return;

      setIsLoading(true);
      try {
        const idToken = await authUser.getIdToken();
        const res = await explainUserAccessAction({
          idToken,
          organizationId: activeOrganizationId,
          personId,
          permissionId,
          workspaceId,
        });

        if (isMounted && res.success && res.explanation) {
          setExplanation(res.explanation);
        }
      } catch (err: unknown) {
        console.error('[AccessExplainerModal] Failed to load explanation:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadExplanation();
    return () => {
      isMounted = false;
    };
  }, [isOpen, authUser, activeOrganizationId, personId, permissionId, workspaceId]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-card border shadow-2xl">
        <DialogHeader className="p-5 pb-4 border-b bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Access Decision Explainer</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Audit trace and grant hierarchy for <strong className="text-foreground">{personName}</strong>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* Target Permission Badge */}
          <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20 text-xs">
            <div>
              <span className="text-[10px] text-muted-foreground block uppercase font-mono">
                Target Action
              </span>
              <span className="font-mono font-semibold text-foreground">{permissionId}</span>
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-6 w-20 rounded-md" />
              ) : explanation?.hasAccess ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Granted
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 gap-1 text-xs">
                  <XCircle className="w-3.5 h-3.5" /> Denied
                </Badge>
              )}
            </div>
          </div>

          {/* Natural Language Explanation */}
          <Card className="border shadow-xs bg-card">
            <CardContent className="p-4 space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Audit Summary
              </span>
              {isLoading ? (
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                <p className="text-xs text-foreground leading-relaxed">
                  {explanation?.explanationText || 'Evaluating authorization graph...'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Grant Path Hierarchy Tree */}
          {explanation && explanation.grantHierarchy.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Grant Path Hierarchy
              </span>
              <div className="space-y-2">
                {explanation.grantHierarchy.map((node, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl border bg-muted/10 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <Shield className="w-4 h-4 text-primary shrink-0" />
                      <div>
                        <span className="font-semibold text-foreground block">{node.roleName}</span>
                        <span className="text-[10px] text-muted-foreground block">{node.scope}</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[9px] uppercase font-mono">
                      {node.action} on {node.feature}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-muted/20 flex justify-end">
          <Button type="button" size="sm" onClick={onClose} className="text-xs h-9 px-4 active:scale-[0.97]">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AccessExplainerModal;
