'use client';

/**
 * {{Org_name}} Experience Platform — Member Orientation Video Modal
 *
 * Non-obstructive orientation video viewing dialog allowing new members
 * to watch platform guidelines, academy overview, and mark orientation complete.
 *
 * ARCHITECTURAL RATIONALE:
 * Completing orientation triggers `recordOrientationWatchedAction`, which advances
 * the `welcome_video` step and updates the member's onboarding progress.
 *
 * MOBILE-FIRST & ACCESSIBILITY (Rule 7 & Emil Kowalski Animations):
 * - Responsive 16:9 iframe video player with fallback to platform welcome video.
 * - Interactive buttons with >= 44px touch targets (`min-h-[44px]`).
 * - Clear, concise, everyday UI English without excessive text.
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
import { useToast } from '@/hooks/use-toast';
import { recordOrientationWatchedAction } from '@/app/actions/engagement-actions';
import { Video, CheckCircle2, Loader2, Play } from 'lucide-react';

interface OrientationVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  portalId: string;
  portalSlug: string;
  userId: string;
  videoUrl?: string;
  isAlreadyCompleted?: boolean;
  onSuccess?: () => void;
}

export function OrientationVideoModal({
  isOpen,
  onClose,
  portalId,
  portalSlug,
  userId,
  videoUrl,
  isAlreadyCompleted = false,
  onSuccess,
}: OrientationVideoModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Reliable educational/overview fallback video if none configured in backoffice
  const resolvedUrl =
    videoUrl && videoUrl.trim() !== ''
      ? videoUrl
      : 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0';

  const handleMarkComplete = async () => {
    setIsSubmitting(true);
    try {
      const res = await recordOrientationWatchedAction(portalId, userId, portalSlug);
      if (!res.success) throw new Error(res.error);

      toast({
        title: 'Orientation Completed! 🎉',
        description: 'Welcome step has been checked off your onboarding checklist.',
      });

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not update step progress.';
      toast({
        title: 'Update Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-y-auto rounded-3xl p-5 sm:p-6 border-border bg-card shadow-2xl transition-all duration-200">
        <DialogHeader className="space-y-1.5 text-left">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-extrabold text-foreground">
                Academy Orientation & Welcome
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Watch this short orientation to understand your curriculum, toolkits, and member perks.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* 16:9 Responsive Video Canvas */}
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black/90 border border-border/40 shadow-inner my-2">
          {resolvedUrl.includes('youtube') || resolvedUrl.includes('vimeo') || resolvedUrl.includes('loom') ? (
            <iframe
              src={resolvedUrl}
              title="Academy Orientation Video"
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white/80 p-6 text-center space-y-3">
              <Play className="w-12 h-12 text-primary" />
              <div className="text-xs font-semibold">
                Welcome to your member academy. Review your courses and resources below.
              </div>
            </div>
          )}
        </div>

        {/* Key Takeaways */}
        <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/50 text-xs text-muted-foreground space-y-1">
          <div className="font-bold text-foreground">What to expect:</div>
          <div>• Access all masterclass modules and practical bursary recovery templates.</div>
          <div>• Direct discussion with instructors and peers in community spaces.</div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-11 rounded-2xl text-xs font-bold active:scale-[0.98] transition-all"
          >
            Close
          </Button>
          {!isAlreadyCompleted && (
            <Button
              type="button"
              onClick={handleMarkComplete}
              disabled={isSubmitting}
              className="h-11 rounded-2xl text-xs font-bold bg-primary text-white hover:bg-primary/90 active:scale-[0.98] transition-all gap-1.5 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Updating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Finish Orientation
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
