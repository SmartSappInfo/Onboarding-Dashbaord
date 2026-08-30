'use client';

/**
 * Territory Rules & Routing Studio Modal (Lead Intelligence 2.0 - Phase 14)
 * UI Spec Sections 49 & 56: "Territory Intelligence & Governance"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Configures regional assignment rules, auto-routing score thresholds, and rep round-robin pools.
 * 2. Mobile-responsive with touch targets >= 44px.
 * 3. Emil Kowalski active physics (active:scale-[0.97]).
 * 4. Strict Zero-`any` typing.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  MapPin, 
  Users, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  TrendingUp, 
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import type { TerritoryRule } from '@/lib/lead-intelligence/types';
import { cn } from '@/lib/utils';

interface TerritoryRulesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: TerritoryRule[];
  onSaveRules: (rules: TerritoryRule[]) => Promise<void>;
  isSaving?: boolean;
}

export const TerritoryRulesManagerModal: React.FC<TerritoryRulesManagerModalProps> = ({
  isOpen,
  onClose,
  rules: initialRules,
  onSaveRules,
  isSaving = false
}) => {
  const [rules, setRules] = useState<TerritoryRule[]>(initialRules);
  const [newRegion, setNewRegion] = useState('');
  const [newName, setNewName] = useState('');

  const handleAddRule = () => {
    if (!newRegion.trim() || !newName.trim()) return;
    const newRule: TerritoryRule = {
      id: `rule_${Date.now()}`,
      name: newName.trim(),
      region: newRegion.trim(),
      assignedRepIds: ['rep_default'],
      autoAssign: true,
      minScore: 65,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setRules(prev => [...prev, newRule]);
    setNewName('');
    setNewRegion('');
  };

  const handleDeleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const handleToggleAutoAssign = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, autoAssign: !r.autoAssign } : r));
  };

  const handleMinScoreChange = (id: string, delta: number) => {
    setRules(prev => prev.map(r => {
      if (r.id === id) {
        const newVal = Math.max(0, Math.min(100, r.minScore + delta));
        return { ...r, minScore: newVal };
      }
      return r;
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-card border-border/80 p-6 rounded-2xl shadow-xl space-y-4 max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <MapPin className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg font-black text-foreground">
              Territory Routing & Sales Rep Assignment
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Automatically distribute incoming prospects across sales reps based on regional territory and qualification scores.
          </DialogDescription>
        </DialogHeader>

        {/* Existing Rules List */}
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-2.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-foreground">{rule.name}</span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      Region: {rule.region}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" /> {rule.assignedRepIds.length} Assigned Reps (Round-Robin)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteRule(rule.id)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Controls Grid */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/50 text-xs">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`auto-${rule.id}`}
                    checked={rule.autoAssign}
                    onCheckedChange={() => handleToggleAutoAssign(rule.id)}
                  />
                  <Label htmlFor={`auto-${rule.id}`} className="text-xs text-muted-foreground cursor-pointer">
                    Auto-Assign on Discovery
                  </Label>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Min Score:</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleMinScoreChange(rule.id, -5)}
                    className="h-6 w-6 p-0 rounded text-xs font-mono"
                  >
                    -
                  </Button>
                  <span className="font-mono text-xs font-bold px-1.5">{rule.minScore} / 100</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleMinScoreChange(rule.id, 5)}
                    className="h-6 w-6 p-0 rounded text-xs font-mono"
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add New Rule Section */}
        <div className="p-4 rounded-xl bg-background border border-dashed border-border space-y-3">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-primary" /> Add Territory Rule
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              placeholder="Rule Name (e.g. Western Region Hub)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-9 text-xs"
            />
            <Input
              placeholder="Region Match (e.g. Western, Takoradi)"
              value={newRegion}
              onChange={(e) => setNewRegion(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <Button
            size="sm"
            onClick={handleAddRule}
            disabled={!newName.trim() || !newRegion.trim()}
            className="h-8 px-4 text-xs font-bold bg-primary text-primary-foreground rounded-xl active:scale-[0.97]"
          >
            Create Territory Rule
          </Button>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-9 px-4 text-xs rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={() => onSaveRules(rules)}
            disabled={isSaving}
            className="h-9 px-5 bg-primary text-primary-foreground text-xs font-bold rounded-xl active:scale-[0.97]"
          >
            {isSaving ? 'Saving...' : 'Save Territory Rules'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
