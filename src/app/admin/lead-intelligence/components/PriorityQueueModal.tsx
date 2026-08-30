'use client';

/**
 * Focus Mode Priority Queue Studio (Lead Intelligence 2.0 - Phase 12)
 * UI Spec Section 54: "Priority Queue UX"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. 1-Prospect-at-a-time distraction-free sales cockpit.
 * 2. Highlights "Why Now?" actionable urgency.
 * 3. 1-Click Launchers (Call, WhatsApp, Email, CRM Task, Skip).
 * 4. Milestone celebration view on queue completion.
 * 5. Mobile-responsive layout with touch targets >= 44px.
 * 6. Emil Kowalski active physics (active:scale-[0.97]).
 * 7. Strict Zero-`any` typing.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Flame, 
  PhoneCall, 
  MessageSquare, 
  Mail, 
  CheckSquare, 
  ArrowRight, 
  Sparkles, 
  Trophy, 
  ExternalLink,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import type { 
  Prospect, 
  PriorityQueueItem, 
  AIOutreachDraft 
} from '@/lib/lead-intelligence/types';
import { AutonomousSDREngine } from '@/lib/lead-intelligence/sdr';
import { AIOutreachReviewModal } from './AIOutreachReviewModal';
import { executeProspectActivationAction } from '@/app/actions/lead-intelligence-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PriorityQueueModalProps {
  prospects: Prospect[];
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onProspectActivated?: (prospectId: string) => void;
}

export const PriorityQueueModal: React.FC<PriorityQueueModalProps> = ({
  prospects,
  workspaceId,
  isOpen,
  onClose,
  onProspectActivated
}) => {
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [activeDraft, setActiveDraft] = useState<AIOutreachDraft | null>(null);
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);

  const currentProspect = prospects[currentIndex];
  const isQueueFinished = currentIndex >= prospects.length;

  const currentItem: PriorityQueueItem | null = currentProspect 
    ? AutonomousSDREngine.buildPriorityQueueItem(currentProspect)
    : null;

  const handleNext = () => {
    if (currentIndex < prospects.length) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleAction = async (channel: 'whatsapp' | 'email' | 'phone_script') => {
    if (!currentProspect) return;
    const targetContact = currentProspect.contacts?.[0];
    const draft = AutonomousSDREngine.generatePersonalizedDraft(currentProspect, channel, targetContact);
    setActiveDraft(draft);
    setIsDraftModalOpen(true);
    setCompletedCount(prev => prev + 1);
    onProspectActivated?.(currentProspect.id);
  };

  const handleQuickTask = async () => {
    if (!currentProspect) return;
    try {
      const res = await executeProspectActivationAction(currentProspect.id, workspaceId, ['create_task']);
      if (res.success) {
        toast({ title: 'Task Created ✓', description: `Added follow-up task for ${currentProspect.name}.` });
        setCompletedCount(prev => prev + 1);
        onProspectActivated?.(currentProspect.id);
        handleNext();
      }
    } catch {
      toast({ variant: 'destructive', title: 'Task Failed', description: 'Could not create task.' });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl bg-card border-border/80 rounded-2xl p-6 shadow-2xl z-[10000]">
          {!isQueueFinished && currentItem ? (
            <div className="space-y-5">
              {/* Stepper Header */}
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/20 text-primary border-primary/40 text-[10px] font-mono font-bold">
                    Focus Mode
                  </Badge>
                  <span className="text-xs text-muted-foreground font-semibold">
                    Prospect {currentIndex + 1} of {prospects.length}
                  </span>
                </div>

                <div className="w-28">
                  <Progress value={((currentIndex + 1) / prospects.length) * 100} className="h-2" />
                </div>
              </div>

              {/* Prospect Hero & Score */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-muted/30 border border-border/70">
                <div className="space-y-1">
                  <h3 className="text-base font-black text-foreground">{currentProspect.name}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span>{currentProspect.domain}</span>
                    <span>•</span>
                    <span>{currentProspect.address || currentProspect.industry || 'Ghana'}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge className="bg-rose-500/20 text-rose-600 border-rose-500/40 text-xs font-bold flex items-center gap-1">
                    <Flame className="w-3 h-3" /> High Intent
                  </Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-black px-2.5 py-1">
                    {currentProspect.scoring?.overallScore ?? 50}/100 Score
                  </Badge>
                </div>
              </div>

              {/* "Why Now?" Actionable Card */}
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-primary uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Why Contact Now?</span>
                </div>
                <p className="text-xs font-medium text-foreground leading-relaxed">
                  {currentItem.whyNowReason}
                </p>
              </div>

              {/* Recommended Pitch Angle & Contacts */}
              <div className="p-4 rounded-2xl bg-card border border-border/70 space-y-2 text-xs">
                <div className="flex items-center justify-between text-muted-foreground font-semibold">
                  <span>Recommended Pitch Strategy</span>
                  <span>Decision Maker: <strong className="text-foreground">{currentProspect.contacts?.[0]?.name || 'School Principal'}</strong></span>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  &ldquo;{currentItem.recommendedPlaybook?.headline || currentItem.recommendedPlaybook?.scriptOrMessage || 'Modernizing parent fees & digital school records with SmartSapp'}&rdquo;
                </p>
              </div>

              {/* Multi-Channel Action Bar (UI Spec Section 54) */}
              <div className="pt-2 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                  {/* WhatsApp */}
                  <Button
                    size="sm"
                    onClick={() => handleAction('whatsapp')}
                    className="h-10 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 active:scale-[0.97] flex-1 sm:flex-initial"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </Button>

                  {/* Email */}
                  <Button
                    size="sm"
                    onClick={() => handleAction('email')}
                    className="h-10 px-3.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl flex items-center gap-1.5 active:scale-[0.97] flex-1 sm:flex-initial"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email</span>
                  </Button>

                  {/* Call */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction('phone_script')}
                    className="h-10 px-3.5 font-bold text-xs rounded-xl flex items-center gap-1.5 active:scale-[0.97] flex-1 sm:flex-initial"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-primary" />
                    <span>Call Script</span>
                  </Button>

                  {/* Task */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleQuickTask}
                    className="h-10 px-3.5 font-bold text-xs rounded-xl flex items-center gap-1.5 active:scale-[0.97] flex-1 sm:flex-initial"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-purple-500" />
                    <span>Create Task</span>
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleNext}
                  className="h-10 text-xs font-bold text-muted-foreground hover:text-foreground active:scale-[0.97] w-full sm:w-auto"
                >
                  <span>Skip Prospect</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          ) : (
            /* Queue Completed Milestone Screen */
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/40">
                <Trophy className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-black text-foreground">Priority Queue Completed! 🎉</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  You reviewed all prioritized leads for today and initiated {completedCount} multi-channel sales actions.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  size="sm"
                  onClick={onClose}
                  className="h-9 px-5 bg-primary text-primary-foreground font-bold text-xs rounded-xl active:scale-[0.97]"
                >
                  Return to Dashboard
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Human-in-the-loop review modal */}
      <AIOutreachReviewModal
        draft={activeDraft}
        isOpen={isDraftModalOpen}
        onClose={() => {
          setIsDraftModalOpen(false);
          handleNext();
        }}
      />
    </>
  );
};
