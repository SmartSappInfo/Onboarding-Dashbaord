'use client';

/**
 * {{Org_name}} Experience Platform — Create Community Space Modal
 *
 * Modal wizard for configuring community discussion channels, icons,
 * descriptions, and membership tier access gating.
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createSpaceAction, updateSpaceAction } from '@/app/actions/community-actions';
import type { CommunitySpace, SpaceVisibility } from '@/lib/types/community';
import { MessageSquare, Sparkles, Lock, Layers, Loader2 } from 'lucide-react';

interface CreateSpaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portalId: string;
  portalSlug: string;
  organizationId: string;
  workspaceIds?: string[];
  editingSpace?: CommunitySpace | null;
  existingOrder?: number;
}

export function CreateSpaceModal({
  open,
  onOpenChange,
  portalId,
  portalSlug,
  organizationId,
  workspaceIds = ['onboarding'],
  editingSpace,
  existingOrder = 1,
}: CreateSpaceModalProps) {
  const { toast } = useToast();

  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [icon, setIcon] = React.useState('💬');
  const [visibility, setVisibility] = React.useState<SpaceVisibility>('members_only');
  const [isDefault, setIsDefault] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (editingSpace) {
      setName(editingSpace.name);
      setSlug(editingSpace.slug);
      setDescription(editingSpace.description || '');
      setIcon(editingSpace.icon || '💬');
      setVisibility(editingSpace.visibility);
      setIsDefault(Boolean(editingSpace.isDefault));
    } else {
      setName('');
      setSlug('');
      setDescription('');
      setIcon('💬');
      setVisibility('members_only');
      setIsDefault(false);
    }
  }, [editingSpace, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: 'Name Required', description: 'Please provide a name for this space.' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingSpace) {
        const res = await updateSpaceAction(
          editingSpace.id,
          {
            name: name.trim(),
            slug: slug.trim() || undefined,
            description: description.trim(),
            icon: icon.trim(),
            visibility,
            isDefault,
          },
          portalId,
          portalSlug
        );
        if (!res.success) throw new Error(res.error);
        toast({ title: 'Space Updated! 💬', description: `Saved "${res.data?.name}".` });
      } else {
        const res = await createSpaceAction(
          {
            organizationId,
            portalId,
            workspaceIds,
            name: name.trim(),
            slug: slug.trim() || undefined,
            description: description.trim(),
            icon: icon.trim() || '💬',
            visibility,
            order: existingOrder,
            isDefault,
          },
          portalSlug
        );
        if (!res.success) throw new Error(res.error);
        toast({ title: 'Space Created! 💬', description: `Channel "${res.data?.name}" is now live.` });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Action Failed', description: err?.message || 'Could not save space.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-6 sm:p-8 space-y-4">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <MessageSquare className="w-4 h-4" /> Community Space Studio
          </div>
          <DialogTitle className="text-xl font-bold">
            {editingSpace ? 'Edit Space Settings' : 'Create Community Space'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Configure discussion topics, channels, and membership access tiers.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-1 space-y-1.5">
              <Label className="text-xs font-bold">Icon</Label>
              <Input
                value={icon}
                onChange={e => setIcon(e.target.value)}
                placeholder="💬"
                className="h-10 text-center text-base rounded-xl"
              />
            </div>
            <div className="col-span-3 space-y-1.5">
              <Label className="text-xs font-bold">Space Name</Label>
              <Input
                placeholder="e.g. Wins & Celebrations"
                value={name}
                onChange={e => setName(e.target.value)}
                className="h-10 text-xs rounded-xl"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Visibility & Access Policy</Label>
            <Select value={visibility} onValueChange={(val: SpaceVisibility) => setVisibility(val)}>
              <SelectTrigger className="h-10 text-xs rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="public">🌎 Public (Anyone can view)</SelectItem>
                <SelectItem value="members_only">👥 Members Only (Registered members)</SelectItem>
                <SelectItem value="plan_gated">⭐ Tier Gated (Paid plan subscribers)</SelectItem>
                <SelectItem value="private_cohort">🔒 Private Cohort (Explicit grants only)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Description & Purpose</Label>
            <Textarea
              placeholder="What should members share in this space?"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="text-xs rounded-xl resize-none"
            />
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-foreground">Default Channel</span>
              <p className="text-[11px] text-muted-foreground">Automatically open this space when visiting community</p>
            </div>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl font-bold text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : editingSpace ? (
                'Save Changes'
              ) : (
                'Create Space'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
