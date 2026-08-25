'use client';

/**
 * {{Org_name}} Experience Platform — Access Grants & Entitlement Auditor
 *
 * Administrative matrix for inspecting, granting, and revoking granular
 * resource access grants for specific members.
 */

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ShieldCheck,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Sparkles,
  BookOpen,
  FolderArchive,
  Calendar,
  Loader2,
} from 'lucide-react';
import { grantAccessAction, revokeAccessAction } from '@/app/actions/membership-actions';
import type { AccessGrant, ResourceType, GrantType } from '@/lib/types/membership';

interface AccessGrantAuditorProps {
  portalId: string;
  organizationId: string;
}

export function AccessGrantAuditor({ portalId, organizationId }: AccessGrantAuditorProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isGrantModalOpen, setIsGrantModalOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Grant Modal form state
  const [userId, setUserId] = React.useState('');
  const [membershipId, setMembershipId] = React.useState('');
  const [resourceType, setResourceType] = React.useState<ResourceType>('course');
  const [resourceId, setResourceId] = React.useState('');
  const [grantType, setGrantType] = React.useState<GrantType>('manual_admin_grant');
  const [expirationDays, setExpirationDays] = React.useState<number>(365);
  const [notes, setNotes] = React.useState('');

  const grantsQuery = useMemoFirebase(
    () =>
      firestore && portalId
        ? query(
            collection(firestore, 'access_grants'),
            where('portalId', '==', portalId),
            orderBy('grantedAt', 'desc')
          )
        : null,
    [firestore, portalId]
  );

  const { data: grants, isLoading } = useCollection<AccessGrant>(grantsQuery);

  const handleCreateGrant = async () => {
    if (!userId.trim() || !resourceId.trim()) {
      toast({ title: 'User ID and Resource ID Required', description: 'Please provide both fields.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

      const res = await grantAccessAction({
        portalId,
        organizationId,
        membershipId: membershipId || 'manual',
        userId: userId.trim(),
        resourceType,
        resourceId: resourceId.trim(),
        grantType,
        expiresAt: expiresAt.toISOString(),
        notes: notes || undefined,
      });

      if (!res.success) throw new Error(res.error || 'Failed to grant access.');

      toast({ title: 'Access Granted! 🔓', description: `Granted access to ${resourceType}:${resourceId}.` });
      setIsGrantModalOpen(false);
      setUserId('');
      setResourceId('');
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Grant failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (grant: AccessGrant) => {
    if (!confirm(`Revoke access to ${grant.resourceType}:${grant.resourceId}?`)) return;
    try {
      const res = await revokeAccessAction(grant.id, portalId);
      if (!res.success) throw new Error(res.error || 'Failed to revoke access.');
      toast({ title: 'Access Revoked', description: 'Grant removed successfully.' });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Revoke failed.' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" /> Active Entitlement Grants
          </h4>
          <p className="text-xs text-muted-foreground">
            Explicit access overrides and one-time enrollment grants.
          </p>
        </div>

        <Button
          onClick={() => setIsGrantModalOpen(true)}
          size="sm"
          className="h-10 px-4 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Grant Direct Access
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      ) : !grants || grants.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed rounded-2xl space-y-2 bg-muted/20">
          <Unlock className="w-7 h-7 mx-auto text-muted-foreground" />
          <p className="text-xs text-muted-foreground">No direct access grants recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {grants.map(grant => (
            <div
              key={grant.id}
              className="flex items-center justify-between p-3.5 rounded-2xl border border-border bg-card shadow-2xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-mono text-xs font-bold">
                  {grant.resourceType.charAt(0).toUpperCase()}
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-foreground font-mono">{grant.resourceId}</span>
                    <Badge variant="outline" className="text-[9px] uppercase font-bold px-1.5 py-0">
                      {grant.resourceType}
                    </Badge>
                    <Badge variant="secondary" className="text-[9px] font-medium px-1.5 py-0">
                      {grant.grantType.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    User: <strong className="font-mono">{grant.userId}</strong> • Expires:{' '}
                    {grant.expiresAt ? new Date(grant.expiresAt).toLocaleDateString() : 'Never'}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRevoke(grant)}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-rose-500"
                title="Revoke Grant"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Grant Modal */}
      <Dialog open={isGrantModalOpen} onOpenChange={setIsGrantModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 space-y-4 border-2 border-border shadow-2xl">
          <DialogHeader className="pb-2 border-b border-border">
            <DialogTitle className="text-lg font-bold">Grant Direct Access</DialogTitle>
            <DialogDescription className="text-xs">
              Provision instant access to a specific course, module, or resource vault.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">User / Member ID</Label>
              <Input
                placeholder="Firebase UID or email"
                value={userId}
                onChange={e => setUserId(e.target.value)}
                className="h-10 rounded-xl text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Resource Type</Label>
                <Select value={resourceType} onValueChange={(r: ResourceType) => setResourceType(r)}>
                  <SelectTrigger className="h-10 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="course">Course</SelectItem>
                    <SelectItem value="lesson">Lesson</SelectItem>
                    <SelectItem value="content_item">Content Article</SelectItem>
                    <SelectItem value="community_space">Community Space</SelectItem>
                    <SelectItem value="resource_vault">Resource Vault</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Expires In (Days)</Label>
                <Input
                  type="number"
                  min={1}
                  value={expirationDays}
                  onChange={e => setExpirationDays(parseInt(e.target.value) || 365)}
                  className="h-10 rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Resource ID or Slug</Label>
              <Input
                placeholder="e.g. course-tuition-recovery-101"
                value={resourceId}
                onChange={e => setResourceId(e.target.value)}
                className="h-10 rounded-xl text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Admin Notes</Label>
              <Input
                placeholder="e.g. Scholarship recipient"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="h-10 rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              disabled={isSubmitting || !userId.trim() || !resourceId.trim()}
              onClick={handleCreateGrant}
              className="w-full h-11 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Grant Entitlement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
