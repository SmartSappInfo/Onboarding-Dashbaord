'use client';

/**
 * 5-Action Prospect Activation Studio Modal (Lead Intelligence 2.0 - Phase 12)
 * UI Spec Section 50: "Phase 12 UX — Activation"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. 1-Click Multi-Action Activation with AI Rationale.
 * 2. Atomic multi-action batch writes into CRM Tasks & Deals.
 * 3. Mobile-responsive layout with touch targets >= 44px.
 * 4. Emil Kowalski active physics (active:scale-[0.97]).
 * 5. Strict Zero-`any` typing.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Zap, 
  CheckCircle2, 
  Briefcase, 
  Mail, 
  MessageSquare, 
  Calendar, 
  Loader2, 
  Sparkles,
  User
} from 'lucide-react';
import type { 
  Prospect, 
  ActivationActionType, 
  ActivationRecommendationItem 
} from '@/lib/lead-intelligence/types';
import { AutonomousSDREngine } from '@/lib/lead-intelligence/sdr';
import { executeProspectActivationAction } from '@/app/actions/lead-intelligence-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ProspectActivationModalProps {
  prospect: Prospect | null;
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onActivated?: () => void;
}

export const ProspectActivationModal: React.FC<ProspectActivationModalProps> = ({
  prospect,
  workspaceId,
  isOpen,
  onClose,
  onActivated
}) => {
  const { toast } = useToast();
  const [items, setItems] = useState<ActivationRecommendationItem[]>([]);
  const [selectedActionTypes, setSelectedActionTypes] = useState<Set<ActivationActionType>>(new Set());
  const [isExecuting, setIsExecuting] = useState(false);
  const [assignedRep, setAssignedRep] = useState('rep_kwame');

  useEffect(() => {
    if (prospect) {
      const recs = AutonomousSDREngine.generateActivationRecommendations(prospect, 'Kwame');
      setItems(recs);
      const initialSelected = new Set<ActivationActionType>();
      recs.forEach(r => {
        if (r.enabled && r.isRecommended) initialSelected.add(r.type);
      });
      setSelectedActionTypes(initialSelected);
    }
  }, [prospect]);

  if (!prospect) return null;

  const toggleAction = (type: ActivationActionType) => {
    setSelectedActionTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleExecute = async () => {
    if (selectedActionTypes.size === 0) {
      toast({ variant: 'destructive', title: 'No Actions Selected', description: 'Please select at least one activation action.' });
      return;
    }

    try {
      setIsExecuting(true);
      const actionArray = Array.from(selectedActionTypes);
      const res = await executeProspectActivationAction(prospect.id, workspaceId, actionArray, assignedRep);

      if (res.success) {
        toast({
          title: 'Prospect Activated ✓',
          description: `Successfully executed ${res.executedCount || 0} CRM actions for ${prospect.name}.`
        });
        onActivated?.();
        onClose();
      } else {
        toast({
          variant: 'destructive',
          title: 'Activation Failed',
          description: res.error || 'Failed to activate prospect.'
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Execution Error',
        description: 'Server error during activation.'
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const getActionIcon = (type: ActivationActionType) => {
    switch (type) {
      case 'create_task':
        return <User className="h-4 w-4 text-purple-500" />;
      case 'create_deal':
        return <Briefcase className="h-4 w-4 text-amber-500" />;
      case 'send_email':
        return <Mail className="h-4 w-4 text-sky-500" />;
      case 'enroll_whatsapp':
        return <MessageSquare className="h-4 w-4 text-emerald-500" />;
      case 'book_followup':
        return <Calendar className="h-4 w-4 text-rose-500" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl bg-card border-border/80 rounded-2xl p-6 shadow-2xl z-[10005]">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-black text-foreground flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
            <span>Activate Prospect: {prospect.name}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Select multi-channel CRM and outbound actions to transition this prospect into revenue pipeline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-3">
          {/* Institution Summary Pill */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/60 text-xs">
            <div>
              <span className="font-bold text-foreground block">{prospect.name}</span>
              <span className="text-[11px] text-muted-foreground">{prospect.domain} • {prospect.industry || 'Education'}</span>
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
              {prospect.scoring?.overallScore ?? 50}/100 Score
            </Badge>
          </div>

          {/* 5-Action Checklist */}
          <div className="space-y-2.5">
            {items.map((item) => {
              const isChecked = selectedActionTypes.has(item.type);
              return (
                <div
                  key={item.id}
                  onClick={() => item.enabled && toggleAction(item.type)}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none",
                    isChecked ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20" : "bg-card border-border/60 hover:border-border",
                    !item.enabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    disabled={!item.enabled}
                    className="mt-0.5"
                  />
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getActionIcon(item.type)}
                        <span className="text-xs font-bold text-foreground">{item.title}</span>
                      </div>
                      {item.isRecommended && (
                        <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/40 text-[9px] font-bold">
                          RECOMMENDED
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{item.description}</p>
                    <p className="text-[10px] text-primary/80 font-medium pt-0.5 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 shrink-0" />
                      <span>{item.rationale}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-border/60">
          <span className="text-xs text-muted-foreground font-semibold">
            {selectedActionTypes.size} action{selectedActionTypes.size !== 1 ? 's' : ''} selected
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
              className="h-9 text-xs font-medium"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isExecuting || selectedActionTypes.size === 0}
              onClick={handleExecute}
              className="h-9 px-4 bg-primary text-primary-foreground font-bold text-xs rounded-xl flex items-center gap-1.5 active:scale-[0.97]"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  Activating...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 mr-1" />
                  Execute Activation
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
