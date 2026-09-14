'use client';

/**
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 
 * 1. Single Source of Truth for Tags:
 *    - Uses standardized `<TagSelector>` component in client/draft mode (`currentTagIds`, `onTagsChange`).
 *    - Direct text input for tags is strictly prohibited by workspace rules.
 * 2. Mobile & Accessibility First:
 *    - Touch targets >= 44px, keyboard accessible dialogs, and clear active press states (`active:scale-[0.97]`).
 * 3. Security:
 *    - Multi-tenant workspaceId validation on all mutations.
 */

import * as React from 'react';
import { TagSelector } from '@/components/tags/TagSelector';
import { Button } from '@/components/ui/button';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Tag as TagIcon, Loader2, GitPullRequest, User, Crown, Info } from 'lucide-react';
import { 
  bulkApplyTagsToSurveyEntitiesAction, 
  bulkMoveSurveyEntitiesStageAction 
} from '@/lib/survey-entity-actions';
import { getEntityContactsAction } from '@/app/actions/entity-contact-actions';
import type { EntityContact } from '@/lib/types';

interface PipelineStageDoc {
  id: string;
  name: string;
  order?: number;
}

interface PipelineDoc {
  id: string;
  name: string;
}

export interface ManagedEntityTarget {
  id: string;
  name: string;
  currentTagIds?: string[];
  // Contact-centric pipeline parameters (PRD Section 122 & Rules 5, 10)
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactRole?: string;
  responseId?: string;
}

interface SurveyEntityManageDialogsProps {
  taggingEntity: ManagedEntityTarget | null;
  onCloseTagging: () => void;
  movingEntity: ManagedEntityTarget | null;
  onCloseMoving: () => void;
  onComplete?: () => void;
}

export default function SurveyEntityManageDialogs({
  taggingEntity,
  onCloseTagging,
  movingEntity,
  onCloseMoving,
  onComplete,
}: SurveyEntityManageDialogsProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();

  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = React.useState<string>('');
  const [selectedStageId, setSelectedStageId] = React.useState<string>('');
  const [isExecuting, setIsExecuting] = React.useState(false);

  // Contact-Centric Deal Selection State
  const [entityContacts, setEntityContacts] = React.useState<EntityContact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = React.useState(false);
  const [selectedContactId, setSelectedContactId] = React.useState<string>('');

  // Sync initial tag IDs when tagging entity changes
  React.useEffect(() => {
    if (taggingEntity) {
      setSelectedTagIds(taggingEntity.currentTagIds || []);
    } else {
      setSelectedTagIds([]);
    }
  }, [taggingEntity]);

  // Reset and load contacts when moving entity changes
  React.useEffect(() => {
    let isMounted = true;
    if (movingEntity) {
      setSelectedPipelineId('');
      setSelectedStageId('');
      setIsLoadingContacts(true);

      getEntityContactsAction(movingEntity.id)
        .then((contacts) => {
          if (!isMounted) return;
          setEntityContacts(contacts);

          // 1. If explicit contactId provided and found in entityContacts:
          if (movingEntity.contactId && contacts.some((c) => c.id === movingEntity.contactId)) {
            setSelectedContactId(movingEntity.contactId);
          }
          // 2. Or match by email / phone against entityContacts:
          else if (movingEntity.contactEmail || movingEntity.contactPhone) {
            const emailLower = movingEntity.contactEmail?.trim().toLowerCase();
            const phoneDigits = movingEntity.contactPhone?.replace(/\D/g, '');
            const matched = contacts.find((c) => {
              if (emailLower && c.email && c.email.trim().toLowerCase() === emailLower) return true;
              if (phoneDigits && c.phone && c.phone.replace(/\D/g, '') === phoneDigits) return true;
              return false;
            });
            if (matched) {
              setSelectedContactId(matched.id);
            } else if (movingEntity.contactName) {
              setSelectedContactId('respondent');
            } else if (contacts.length > 0) {
              const primary = contacts.find((c) => c.isPrimary) || contacts[0];
              setSelectedContactId(primary.id);
            }
          }
          // 3. Or if respondent name provided without email match:
          else if (movingEntity.contactName) {
            const matchedByName = contacts.find(
              (c) => c.name.trim().toLowerCase() === movingEntity.contactName?.trim().toLowerCase()
            );
            if (matchedByName) {
              setSelectedContactId(matchedByName.id);
            } else {
              setSelectedContactId('respondent');
            }
          }
          // 4. Default to entity primary or first contact:
          else if (contacts.length > 0) {
            const primary = contacts.find((c) => c.isPrimary) || contacts[0];
            setSelectedContactId(primary.id);
          } else {
            setSelectedContactId('');
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          console.error('[SurveyEntityManageDialogs] Failed to load entity contacts:', err);
          if (movingEntity.contactName) {
            setSelectedContactId('respondent');
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsLoadingContacts(false);
          }
        });
    } else {
      setSelectedPipelineId('');
      setSelectedStageId('');
      setEntityContacts([]);
      setSelectedContactId('');
    }

    return () => {
      isMounted = false;
    };
  }, [movingEntity]);

  // Query workspace pipelines
  const pipelinesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'pipelines'),
      where('workspaceIds', 'array-contains', activeWorkspaceId),
      orderBy('name', 'asc')
    );
  }, [firestore, activeWorkspaceId]);

  const { data: pipelines } = useCollection<PipelineDoc>(pipelinesQuery);

  // Query pipeline stages
  const stagesQuery = useMemoFirebase(() => {
    if (!firestore || !selectedPipelineId) return null;
    return query(
      collection(firestore, 'onboardingStages'),
      where('pipelineId', '==', selectedPipelineId),
      orderBy('order', 'asc')
    );
  }, [firestore, selectedPipelineId]);

  const { data: stages } = useCollection<PipelineStageDoc>(stagesQuery);

  // Handle Apply Tags
  const handleApplyTags = async () => {
    if (!activeWorkspaceId || !taggingEntity) {
      toast({ variant: 'destructive', title: 'Error', description: 'Workspace or entity context missing.' });
      return;
    }
    if (selectedTagIds.length === 0) {
      toast({ variant: 'destructive', title: 'No Tags Selected', description: 'Please select at least one tag.' });
      return;
    }

    setIsExecuting(true);
    try {
      const res = await bulkApplyTagsToSurveyEntitiesAction({
        workspaceId: activeWorkspaceId,
        entityIds: [taggingEntity.id],
        tagIds: selectedTagIds,
      });

      if (res.success) {
        toast({
          title: 'Tags Updated',
          description: `Tags successfully updated for ${taggingEntity.name}.`,
        });
        onCloseTagging();
        if (onComplete) onComplete();
      } else {
        toast({
          variant: 'destructive',
          title: 'Tagging Failed',
          description: res.error || 'Could not update tags.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Handle Move Stage
  const handleMoveStage = async () => {
    if (!activeWorkspaceId || !movingEntity) {
      toast({ variant: 'destructive', title: 'Error', description: 'Workspace or entity context missing.' });
      return;
    }
    if (!selectedPipelineId || !selectedStageId) {
      toast({
        variant: 'destructive',
        title: 'Selection Required',
        description: 'Please select both a pipeline and a target stage.',
      });
      return;
    }

    setIsExecuting(true);
    try {
      let targetContactId: string | undefined = undefined;
      let targetContactName: string | undefined = movingEntity.contactName;
      let targetContactEmail: string | undefined = movingEntity.contactEmail;
      let targetContactPhone: string | undefined = movingEntity.contactPhone;
      let targetContactRole: string | undefined = movingEntity.contactRole;

      if (selectedContactId === 'respondent') {
        targetContactId = undefined;
      } else if (selectedContactId) {
        const found = entityContacts.find((c) => c.id === selectedContactId);
        if (found) {
          targetContactId = found.id;
          targetContactName = found.name;
          targetContactEmail = found.email;
          targetContactPhone = found.phone;
          targetContactRole = found.typeLabel || found.typeKey;
        }
      }

      const res = await bulkMoveSurveyEntitiesStageAction({
        workspaceId: activeWorkspaceId,
        entityIds: [movingEntity.id],
        pipelineId: selectedPipelineId,
        stageId: selectedStageId,
        targetContactId,
        targetContactName,
        targetContactEmail,
        targetContactPhone,
        targetContactRole,
        responseId: movingEntity.responseId,
      });

      if (res.success) {
        const contactDisplay = targetContactName ? ` (${targetContactName})` : '';
        toast({
          title: 'Pipeline Stage Updated',
          description: `${movingEntity.name}${contactDisplay} is now positioned in the selected pipeline stage.`,
          actionConfig: {
            path: '/admin/pipeline',
            label: 'View in Pipeline',
          },
          duration: 15000,
        });
        onCloseMoving();
        if (onComplete) onComplete();
      } else {
        toast({
          variant: 'destructive',
          title: 'Stage Move Failed',
          description: res.error || 'Could not move pipeline stage.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <>
      {/* Single Entity Tag Dialog */}
      <Dialog open={Boolean(taggingEntity)} onOpenChange={(open) => !open && onCloseTagging()}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <TagIcon className="h-5 w-5 text-primary" />
              Apply Tags to Entity
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Manage workspace tags applied to <strong>{taggingEntity?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <Label className="text-xs font-semibold">Select Tags</Label>
            <TagSelector
              currentTagIds={selectedTagIds}
              onTagsChange={setSelectedTagIds}
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={onCloseTagging}
              disabled={isExecuting}
              className="min-h-[44px] md:min-h-[36px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleApplyTags}
              disabled={isExecuting || selectedTagIds.length === 0}
              className="min-h-[44px] md:min-h-[36px] font-semibold px-6 rounded-xl active:scale-[0.97]"
            >
              {isExecuting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TagIcon className="mr-2 h-4 w-4" />}
              Save Tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Entity Move Pipeline Stage Dialog */}
      <Dialog open={Boolean(movingEntity)} onOpenChange={(open) => !open && onCloseMoving()}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <GitPullRequest className="h-5 w-5 text-emerald-500" />
              Move Contact & Entity in Pipeline
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select target contact, destination pipeline, and stage for <strong>{movingEntity?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Target Contact Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Deal Owner Contact</Label>
                {isLoadingContacts && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading contacts...
                  </span>
                )}
              </div>
              <Select
                value={selectedContactId}
                onValueChange={setSelectedContactId}
                disabled={isLoadingContacts}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Select target contact for deal..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {/* Respondent option if passed from survey */}
                  {movingEntity?.contactName && !entityContacts.some(c => 
                    c.name.trim().toLowerCase() === movingEntity.contactName?.trim().toLowerCase() ||
                    (movingEntity.contactEmail && c.email && c.email.trim().toLowerCase() === movingEntity.contactEmail.trim().toLowerCase()) ||
                    (movingEntity.contactPhone && c.phone && c.phone.replace(/\D/g, '') === movingEntity.contactPhone.replace(/\D/g, ''))
                  ) && (
                    <SelectItem value="respondent">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="font-semibold">{movingEntity.contactName}</span>
                        <span className="text-[11px] text-muted-foreground">
                          ({movingEntity.contactRole || 'Survey Respondent'})
                        </span>
                      </div>
                    </SelectItem>
                  )}
                  {entityContacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-semibold">{c.name}</span>
                        {c.isPrimary && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] bg-amber-500/10 text-amber-700 font-bold px-1.5 py-0.5 rounded">
                            <Crown className="h-3 w-3 text-amber-600 fill-amber-500 shrink-0" /> Primary
                          </span>
                        )}
                        {c.typeLabel && (
                          <span className="text-[11px] text-muted-foreground">({c.typeLabel})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                  {entityContacts.length === 0 && !movingEntity?.contactName && (
                    <SelectItem value="default_entity_contact">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{movingEntity?.name || 'Primary Contact'}</span>
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border/50">
                <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span>
                  Deals are contact-based. This operation creates or updates the specific deal attached to this contact under <strong>{movingEntity?.name}</strong>.
                </span>
              </div>
            </div>

            {/* Pipeline Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Select Pipeline</Label>
              <Select
                value={selectedPipelineId}
                onValueChange={(val) => {
                  setSelectedPipelineId(val);
                  setSelectedStageId('');
                }}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Choose a pipeline..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {pipelines && pipelines.length > 0 ? (
                    pipelines.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      No pipelines available in this workspace
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Stage Selector */}
            {selectedPipelineId && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                <Label className="text-xs font-semibold">Select Target Stage</Label>
                <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Choose target stage..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {stages && stages.length > 0 ? (
                      stages.map((st) => (
                        <SelectItem key={st.id} value={st.id}>
                          {st.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No stages found for this pipeline
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={onCloseMoving}
              disabled={isExecuting}
              className="min-h-[44px] md:min-h-[36px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleMoveStage}
              disabled={isExecuting || !selectedPipelineId || !selectedStageId}
              className="min-h-[44px] md:min-h-[36px] font-semibold px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97]"
            >
              {isExecuting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitPullRequest className="mr-2 h-4 w-4" />}
              Move to Stage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
