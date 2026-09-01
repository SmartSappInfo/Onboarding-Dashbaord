'use client';

/**
 * @fileOverview Just-In-Time (JIT) Temporary Access Grant Modal (Governance 2.0)
 *
 * Composer for provisioning ephemeral, self-expiring privilege grants.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix Dialog with Emil Kowalski spring easing (`cubic-bezier(0.32, 0.72, 0, 1)`).
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { Clock, ShieldAlert, Loader2 } from 'lucide-react';
import type { PersonDetailView, Role, Workspace } from '@/lib/types';
import { grantTemporaryAccessAction } from '@/app/actions/governance-actions';

interface TemporaryAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  people: PersonDetailView[];
  roles: Role[];
  workspaces: Workspace[];
  onGranted: () => void;
}

export function TemporaryAccessModal({
  isOpen,
  onClose,
  people,
  roles,
  workspaces,
  onGranted,
}: TemporaryAccessModalProps) {
  const { toast } = useToast();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [selectedPersonId, setSelectedPersonId] = React.useState('');
  const [selectedRoleId, setSelectedRoleId] = React.useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = React.useState('none');
  const [durationHours, setDurationHours] = React.useState(4);
  const [reason, setReason] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !activeOrganizationId) return;

    if (!selectedPersonId || !selectedRoleId || !reason.trim()) {
      toast({ title: 'Validation Error', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const idToken = await authUser.getIdToken();
      const role = roles.find((r) => r.id === selectedRoleId);

      const res = await grantTemporaryAccessAction({
        idToken,
        organizationId: activeOrganizationId,
        data: {
          personId: selectedPersonId,
          roleId: selectedRoleId,
          roleName: role?.name || selectedRoleId,
          workspaceId: selectedWorkspaceId !== 'none' ? selectedWorkspaceId : undefined,
          durationHours,
          reason: reason.trim(),
          granterName: authUser.displayName || 'Security Admin',
        },
      });

      if (res.success) {
        toast({
          title: 'JIT Access Granted',
          description: `Temporary ${durationHours}h access provisioned successfully.`,
        });
        onGranted();
        onClose();
      } else {
        throw new Error(res.error || 'Failed to grant temporary access');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error granting access';
      toast({ title: 'Grant Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-card border shadow-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-5 pb-4 border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <DialogTitle className="text-base font-bold">Grant Just-In-Time (JIT) Access</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Provision time-bounded privileges with automatic expiration
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Target Member</Label>
              <Select value={selectedPersonId} onValueChange={setSelectedPersonId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select team member..." />
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.person.id} value={p.person.id} className="text-xs">
                      {p.person.displayName} ({p.person.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Role to Grant</Label>
                <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Role..." />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id} className="text-xs">
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Duration Window</Label>
                <Select
                  value={String(durationHours)}
                  onValueChange={(v) => setDurationHours(Number(v))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1" className="text-xs">1 Hour (Quick Fix)</SelectItem>
                    <SelectItem value="4" className="text-xs">4 Hours (Half Day)</SelectItem>
                    <SelectItem value="8" className="text-xs">8 Hours (Full Day)</SelectItem>
                    <SelectItem value="24" className="text-xs">24 Hours (1 Day)</SelectItem>
                    <SelectItem value="168" className="text-xs">7 Days (Auditor)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Workspace Scope</Label>
              <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Workspace..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">-- Organization Global --</SelectItem>
                  {workspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id} className="text-xs">
                      {ws.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Business Justification</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Emergency database hotfix for Ghana admissions queue..."
                className="text-xs min-h-[70px]"
                required
              />
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-muted/20 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs h-9 px-4 active:scale-[0.97]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !selectedPersonId || !selectedRoleId || !reason.trim()}
              className="text-xs h-9 px-4 font-semibold active:scale-[0.97]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Provisioning...
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5 mr-1.5" /> Grant JIT Access
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default TemporaryAccessModal;
