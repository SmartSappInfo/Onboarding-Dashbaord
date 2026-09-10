'use client';

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Network, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createFederatedSpaceAction } from '@/lib/quick-notes-federation-actions';
import type {
  KnowledgeFederationPolicy,
  KnowledgeSpaceAccessLevel,
  FederatedKnowledgeSpace,
} from '@/lib/quick-notes-types';

interface CreateFederatedSpaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  organizationId: string;
  userId: string;
  userName?: string;
  onSpaceCreated?: (space: FederatedKnowledgeSpace) => void;
}

export function CreateFederatedSpaceDialog({
  open,
  onOpenChange,
  workspaceId,
  organizationId,
  userId,
  userName,
  onSpaceCreated,
}: CreateFederatedSpaceDialogProps) {
  const { toast } = useToast();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [policy, setPolicy] = React.useState<KnowledgeFederationPolicy>('organization_shared');
  const [accessLevel, setAccessLevel] = React.useState<KnowledgeSpaceAccessLevel>('viewer');
  const [subscribersInput, setSubscribersInput] = React.useState('');
  const [tagsInput, setTagsInput] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: 'Validation Error', description: 'Space name is required', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const subscriberWorkspaceIds = subscribersInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const tags = tagsInput
        .split(',')
        .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''))
        .filter(Boolean);

      const res = await createFederatedSpaceAction({
        name: name.trim(),
        description: description.trim(),
        organizationId,
        ownerWorkspaceId: workspaceId,
        subscriberWorkspaceIds,
        accessLevel,
        federationPolicy: policy,
        tags,
        userId,
        userName,
      });

      if (res.success && res.data) {
        toast({
          title: 'Knowledge Space Published',
          description: `Successfully published "${res.data.name}" across authorized workspaces.`,
        });
        onSpaceCreated?.(res.data);
        onOpenChange(false);
        // Reset form
        setName('');
        setDescription('');
        setSubscribersInput('');
        setTagsInput('');
      } else {
        toast({
          title: 'Creation Failed',
          description: res.error || 'Failed to create knowledge space',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg rounded-2xl p-5 sm:p-6">
        <DialogHeader className="space-y-1 pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <Network className="h-4.5 w-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                Publish Shared Knowledge Space
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Create a cross-workspace knowledge container for campuses and regional teams.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Space Name */}
          <div className="space-y-1.5">
            <Label htmlFor="space-name" className="text-xs font-bold text-foreground">
              Space Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="space-name"
              placeholder="e.g. Central HQ Curriculum & Brand Playbook"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 text-xs rounded-xl"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="space-desc" className="text-xs font-bold text-foreground">
              Description & Purpose
            </Label>
            <Textarea
              id="space-desc"
              placeholder="Describe the knowledge, templates, and playbooks curated inside this space..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-xs min-h-[72px] rounded-xl resize-none"
            />
          </div>

          {/* Federation Policy & Default Permissions Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Federation Policy</Label>
              <Select
                value={policy}
                onValueChange={(val) => setPolicy(val as KnowledgeFederationPolicy)}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select policy" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="organization_shared">Organization-Wide (All Campuses)</SelectItem>
                  <SelectItem value="selective_peers">Selective Peers (Designated IDs)</SelectItem>
                  <SelectItem value="isolated">Isolated (Owner Only)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Subscriber Permission</Label>
              <Select
                value={accessLevel}
                onValueChange={(val) => setAccessLevel(val as KnowledgeSpaceAccessLevel)}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select access level" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="viewer">Viewer (Read Only - Recommended)</SelectItem>
                  <SelectItem value="contributor">Contributor (Read & Write)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Subscriber Workspace IDs (if selective) */}
          {policy === 'selective_peers' && (
            <div className="space-y-1.5">
              <Label htmlFor="space-subscribers" className="text-xs font-bold text-foreground">
                Subscriber Workspace IDs (Comma-separated)
              </Label>
              <Input
                id="space-subscribers"
                placeholder="ws_north_campus, ws_south_campus, ws_international"
                value={subscribersInput}
                onChange={(e) => setSubscribersInput(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground">
                Only the specified workspace IDs will have access to read notes published to this space.
              </p>
            </div>
          )}

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="space-tags" className="text-xs font-bold text-foreground">
              Tags (Comma-separated)
            </Label>
            <Input
              id="space-tags"
              placeholder="curriculum, brand, policy, compliance"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="h-9 text-xs rounded-xl"
            />
          </div>

          <DialogFooter className="pt-3 border-t border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-9 rounded-xl text-xs min-h-[44px] sm:min-h-[36px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-9 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white min-h-[44px] sm:min-h-[36px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Publishing Space...
                </>
              ) : (
                <>
                  <Network className="h-3.5 w-3.5 mr-1.5" />
                  Publish Knowledge Space
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
