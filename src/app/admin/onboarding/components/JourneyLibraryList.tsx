'use client';

/**
 * @fileOverview Journey Library Grid & Presets Manager (Onboarding 2.0)
 *
 * Card grid of published and draft onboarding journeys with audience filters,
 * step count summaries, and instant template seeding from canonical presets.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 * - Mobile ergonomics: card reflow on `<768px` with clear touch targets.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  Layers,
  Edit2,
  Trash2,
  Star,
  Sparkles,
  Users,
  CheckCircle2,
  Clock,
  Plus,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OnboardingJourney, OnboardingAudience } from '@/lib/types';
import {
  deleteJourneyAction,
  createOrUpdateJourneyAction,
  seedDefaultJourneysAction,
} from '@/app/actions/onboarding-actions';

interface JourneyLibraryListProps {
  journeys: OnboardingJourney[];
  onEditJourney: (journey: OnboardingJourney) => void;
  onRefresh: () => void;
  onOpenCreateModal: () => void;
}

export function JourneyLibraryList({
  journeys,
  onEditJourney,
  onRefresh,
  onOpenCreateModal,
}: JourneyLibraryListProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [isSeeding, setIsSeeding] = React.useState(false);

  // Handle Set Default
  const handleToggleDefault = async (journey: OnboardingJourney) => {
    if (!authUser || !activeOrganizationId) return;

    try {
      const idToken = await authUser.getIdToken();
      const res = await createOrUpdateJourneyAction({
        idToken,
        organizationId: activeOrganizationId,
        journeyId: journey.id,
        data: {
          name: journey.name,
          audience: journey.audience,
          trigger: journey.trigger,
          steps: journey.steps,
          isDefault: !journey.isDefault,
        },
      });

      if (res.success) {
        toast({
          title: 'Default Journey Updated',
          description: `'${journey.name}' is now ${!journey.isDefault ? 'the default' : 'standard'} path.`,
        });
        onRefresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  // Handle Delete Journey
  const handleDelete = async (journey: OnboardingJourney) => {
    if (!authUser || !activeOrganizationId) return;

    const ok = await confirm({
      title: `Delete Journey '${journey.name}'?`,
      description: 'This will remove the onboarding path definition. Active members must complete their current journey.',
      confirmText: 'Delete Journey',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const idToken = await authUser.getIdToken();
      const res = await deleteJourneyAction({
        idToken,
        organizationId: activeOrganizationId,
        journeyId: journey.id,
      });

      if (res.success) {
        toast({ title: 'Journey Removed' });
        onRefresh();
      } else {
        throw new Error(res.error || 'Deletion failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      toast({ title: 'Delete Failed', description: msg, variant: 'destructive' });
    }
  };

  // Seed Canonical Defaults
  const handleSeedDefaults = async () => {
    if (!authUser || !activeOrganizationId) return;

    setIsSeeding(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await seedDefaultJourneysAction({
        idToken,
        organizationId: activeOrganizationId,
      });

      if (res.success) {
        toast({
          title: 'Blueprints Seeded',
          description: `Seeded ${res.journeys.length} canonical onboarding journeys.`,
        });
        onRefresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Seeding failed';
      toast({ title: 'Seeding Error', description: msg, variant: 'destructive' });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-card p-3 rounded-xl border">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Journey Blueprint Library</h3>
            <p className="text-xs text-muted-foreground">
              Define audience-specific induction paths with adaptive rules and completion gates
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {journeys.length === 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={handleSeedDefaults}
              disabled={isSeeding}
              className="text-sm h-10 px-4 rounded-xl active:scale-[0.97] font-medium"
            >
              <Sparkles className="w-4 h-4 mr-2 text-amber-500" /> Seed Canonical Presets
            </Button>
          )}

          <Button
            type="button"
            onClick={onOpenCreateModal}
            className="text-sm h-10 px-4 rounded-xl font-semibold active:scale-[0.97] shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Create Journey
          </Button>
        </div>
      </div>

      {/* Grid of Journeys */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {journeys.length > 0 ? (
          journeys.map((j) => (
            <Card key={j.id} className="border bg-card shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-sm font-bold text-foreground">{j.name}</CardTitle>
                      {j.isDefault && (
                        <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30 gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" /> Default
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs line-clamp-2">
                      {j.description || 'No description provided'}
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onEditJourney(j)}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(j)}
                      className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 pt-2 space-y-3 text-xs border-t bg-muted/5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Audience Tier:</span>
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {j.audience}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Trigger Mode:</span>
                  <span className="font-semibold text-foreground capitalize">{j.trigger.replace('_', ' ')}</span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Step Stages:</span>
                  <span className="font-bold text-foreground">{j.steps?.length || 0} Steps</span>
                </div>

                <div className="pt-2 flex items-center justify-between border-t">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleDefault(j)}
                    className="text-[11px] h-7 px-2 text-muted-foreground hover:text-foreground"
                  >
                    <Star className={cn('w-3 h-3 mr-1', j.isDefault && 'fill-amber-500 text-amber-500')} />
                    {j.isDefault ? 'Default Path' : 'Make Default'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onEditJourney(j)}
                    className="text-[11px] h-7 px-2.5 font-semibold"
                  >
                    Edit Blueprint
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full p-12 text-center border rounded-xl bg-muted/10 text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
            <Layers className="w-10 h-10 text-muted-foreground/50" />
            <p className="font-semibold text-foreground">No Onboarding Journeys Found</p>
            <p className="text-muted-foreground max-w-sm">
              Click &quot;Seed Canonical Presets&quot; to initialize industry-standard onboarding templates.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default JourneyLibraryList;
