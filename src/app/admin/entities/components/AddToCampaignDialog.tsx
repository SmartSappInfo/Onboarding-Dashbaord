'use client';

import * as React from 'react';
import { useCallCampaigns } from '@/lib/call-centre-hooks';
import { addContactsToCallCampaignAction } from '@/lib/call-centre-actions';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, PhoneCall, HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface AddToCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityIds: string[];
  workspaceId: string;
  onComplete?: () => void;
}

export function AddToCampaignDialog({
  open,
  onOpenChange,
  entityIds,
  workspaceId,
  onComplete,
}: AddToCampaignDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const { campaigns, isLoading } = useCallCampaigns(workspaceId);
  const [selectedCampaignId, setSelectedCampaignId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Reset state when opening/closing
  React.useEffect(() => {
    if (open) {
      setSelectedCampaignId(null);
    }
  }, [open]);

  // Filter out archived campaigns
  const activeCampaigns = React.useMemo(() => {
    return campaigns.filter(c => c.status !== 'archived');
  }, [campaigns]);

  const handleConfirm = async () => {
    if (!selectedCampaignId || entityIds.length === 0) return;
    setIsSubmitting(true);
    try {
      const targetCampaign = campaigns.find(c => c.id === selectedCampaignId);
      const campaignName = targetCampaign?.name || 'Campaign';

      const result = await addContactsToCallCampaignAction(
        selectedCampaignId,
        entityIds,
        workspaceId,
        user?.uid || ''
      );

      if (result.success) {
        toast({
          title: 'Contacts Added',
          description: `Successfully added ${result.count} contact(s) to campaign "${campaignName}".`,
        });
        if (onComplete) onComplete();
        onOpenChange(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to Add',
          description: result.error || 'Could not add contacts to the campaign.',
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error occurred',
        description: err.message || 'An unexpected error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md flex flex-col h-[70vh]">
        <DialogHeader>
          <DialogTitle className="font-bold tracking-tight">Add to Call Campaign</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Select a campaign to assign the selected {entityIds.length} contact{entityIds.length === 1 ? '' : 's'}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 border border-border rounded-xl overflow-hidden bg-muted/10 flex flex-col">
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              </div>
            ) : activeCampaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center opacity-50 h-full">
                <PhoneCall className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-xs font-semibold text-muted-foreground">No active campaigns found</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {activeCampaigns.map((camp) => {
                  const isLaunched = camp.status !== 'draft';
                  const isFixed = camp.allowAddContactsAfterLaunch === false;
                  const isDisabled = isFixed && isLaunched;

                  return (
                    <div
                      key={camp.id}
                      onClick={() => {
                        if (!isDisabled) {
                          setSelectedCampaignId(camp.id);
                        }
                      }}
                      className={cn(
                        "flex items-center justify-between px-4 py-3 cursor-pointer transition-colors",
                        isDisabled 
                          ? "opacity-50 cursor-not-allowed bg-muted/20" 
                          : selectedCampaignId === camp.id
                            ? "bg-primary/5 hover:bg-primary/10"
                            : "hover:bg-muted/30"
                      )}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <input
                          type="radio"
                          name="selectedCampaign"
                          checked={selectedCampaignId === camp.id}
                          disabled={isDisabled}
                          onChange={() => setSelectedCampaignId(camp.id)}
                          className="mt-1 h-3.5 w-3.5 text-primary border-gray-300 focus:ring-primary cursor-pointer disabled:cursor-not-allowed"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-foreground truncate">{camp.name}</span>
                            {isFixed ? (
                              <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold uppercase tracking-wider">
                                Fixed
                              </span>
                            ) : (
                              <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold uppercase tracking-wider">
                                Dynamic
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                            Status: <span className="font-semibold capitalize">{camp.status}</span>
                            {camp.progress && ` • ${camp.progress.completed}/${camp.progress.total} completed`}
                          </p>
                        </div>
                      </div>

                      {isDisabled && (
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-muted-foreground hover:text-foreground p-1">
                                <HelpCircle className="h-4 w-4" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-[220px]">
                              <p className="text-[10px] font-medium leading-relaxed">
                                This campaign has a fixed audience and has already been launched. Adding contacts is blocked.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="pt-4 shrink-0 flex flex-row items-center justify-end gap-2 border-t border-border/50">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl font-bold h-11 text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedCampaignId || isSubmitting}
            className="rounded-xl font-bold h-11 text-xs gap-1.5 bg-[#4d69ff] hover:bg-[#3d59ef] text-white"
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Assign to Campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
