'use client';

/**
 * {{Org_name}} Experience Platform — Create Portal Wizard Modal
 *
 * Guided multi-step dialog for configuring and scaffolding a new Portal
 * with preset mode selection and multi-workspace assignment.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PortalModePresetPicker } from './PortalModePresetPicker';
import { createPortalAction, verifyPortalSlugAvailabilityAction } from '@/app/actions/portal-actions';
import { PortalService } from '@/lib/services/portal-service';
import type { PortalMode } from '@/lib/types/portal';
import { Sparkles, ArrowRight, ArrowLeft, Loader2, Check } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';

interface CreatePortalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultWorkspaceId?: string;
}

export function CreatePortalModal({
  open,
  onOpenChange,
  defaultWorkspaceId,
}: CreatePortalModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { activeOrganizationId, activeOrganization, allAccessibleWorkspaces } = useTenant();

  const [step, setStep] = React.useState<'mode' | 'details'>('mode');
  const [selectedMode, setSelectedMode] = React.useState<PortalMode>('academy');
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [selectedWorkspaces, setSelectedWorkspaces] = React.useState<string[]>(
    defaultWorkspaceId ? [defaultWorkspaceId] : ['default']
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [slugStatus, setSlugStatus] = React.useState<{ isChecking: boolean; isAvailable?: boolean; suggestion?: string }>({
    isChecking: false,
  });

  // Reset state when opened
  React.useEffect(() => {
    if (open) {
      setStep('mode');
      setSelectedMode('academy');
      setName('');
      setSlug('');
      setDescription('');
      setSelectedWorkspaces(defaultWorkspaceId ? [defaultWorkspaceId] : ['default']);
    }
  }, [open, defaultWorkspaceId]);

  // Auto-generate slug as name changes
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    const sanitized = PortalService.sanitizeSlug(newName);
    setSlug(sanitized);
  };

  // Debounced check for slug uniqueness
  React.useEffect(() => {
    if (!slug || !activeOrganizationId) return;

    const timer = setTimeout(async () => {
      setSlugStatus(prev => ({ ...prev, isChecking: true }));
      const res = await verifyPortalSlugAvailabilityAction(slug, activeOrganizationId);
      if (res.success && res.data) {
        setSlugStatus({
          isChecking: false,
          isAvailable: res.data.isAvailable,
          suggestion: res.data.suggestedSlug,
        });
      } else {
        setSlugStatus({ isChecking: false });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [slug, activeOrganizationId]);

  const handleToggleWorkspace = (wsId: string) => {
    setSelectedWorkspaces(prev => {
      if (prev.includes(wsId)) {
        if (prev.length === 1) return prev; // keep at least one
        return prev.filter(id => id !== wsId);
      }
      return [...prev, wsId];
    });
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: 'Name Required', description: 'Please enter a name for your portal.' });
      return;
    }
    if (!activeOrganizationId) {
      toast({ title: 'Error', description: 'No active organization found.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createPortalAction({
        organizationId: activeOrganizationId,
        workspaceIds: selectedWorkspaces,
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim() || undefined,
        primaryMode: selectedMode,
      });

      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to create portal.');
      }

      toast({
        title: 'Portal Created! 🎉',
        description: `Your ${name} portal is ready in the studio.`,
      });

      onOpenChange(false);
      router.push(`/admin/portals/${res.data.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create portal.';
      toast({ title: 'Creation Failed', description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const orgName = activeOrganization?.name || 'Organization';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-3xl p-6 md:p-8">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1 text-primary">
            <Sparkles className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">
              {orgName} Experience Platform
            </span>
          </div>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {step === 'mode' ? 'Select Experience Mode' : 'Portal Configuration & Scoping'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {step === 'mode'
              ? 'Choose the primary experience blueprint. You can activate secondary modules later.'
              : 'Set up identity, custom URL slug, and workspace visibility.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'mode' ? (
          <div className="py-3">
            <PortalModePresetPicker
              selectedMode={selectedMode}
              onSelectMode={setSelectedMode}
            />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="portal-name" className="text-xs font-bold">
                Portal Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="portal-name"
                placeholder="e.g. SmartSapp Academy"
                value={name}
                onChange={handleNameChange}
                className="h-11 rounded-xl font-medium"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="portal-slug" className="text-xs font-bold flex items-center justify-between">
                <span>URL Slug <span className="text-rose-500">*</span></span>
                {slugStatus.isChecking ? (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking availability...
                  </span>
                ) : slugStatus.isAvailable === true ? (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> Available
                  </span>
                ) : slugStatus.isAvailable === false ? (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                    Taken — will use "{slugStatus.suggestion}"
                  </span>
                ) : null}
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono bg-muted/60 px-3 py-2.5 rounded-xl border border-border">
                  /portal/
                </span>
                <Input
                  id="portal-slug"
                  placeholder="academy"
                  value={slug}
                  onChange={e => setSlug(PortalService.sanitizeSlug(e.target.value))}
                  className="h-11 rounded-xl font-mono text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="portal-desc" className="text-xs font-bold">
                Tagline / Description
              </Label>
              <Textarea
                id="portal-desc"
                placeholder="Brief summary of what this portal offers to learners and visitors..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="rounded-xl text-sm min-h-[72px] resize-none"
              />
            </div>

            {/* Workspace Scoping Multi-Select */}
            <div className="space-y-2 pt-1">
              <Label className="text-xs font-bold">
                Workspace Scoping & Sharing
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Select which workspaces have access to view and manage this portal:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {(allAccessibleWorkspaces || []).map(ws => {
                  const isSelected = selectedWorkspaces.includes(ws.id);
                  return (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => handleToggleWorkspace(ws.id)}
                      className={`text-xs px-3 py-1.5 rounded-xl font-semibold border transition-all ${
                        isSelected
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                      }`}
                    >
                      {ws.name || ws.id}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-4 border-t border-border mt-2">
          {step === 'mode' ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="rounded-xl font-bold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => setStep('details')}
                className="rounded-xl font-bold gap-2 bg-primary text-white hover:bg-primary/90"
              >
                Next Step <ArrowRight className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('mode')}
                className="rounded-xl font-bold gap-1.5"
                disabled={isSubmitting}
              >
                <ArrowLeft className="w-4 h-4" /> Back to Presets
              </Button>
              <Button
                type="button"
                onClick={handleCreate}
                disabled={isSubmitting || !name.trim()}
                className="rounded-xl font-bold gap-2 bg-primary text-white hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Creating Portal...
                  </>
                ) : (
                  <>
                    Create Experience Portal <Sparkles className="w-4 h-4" />
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
