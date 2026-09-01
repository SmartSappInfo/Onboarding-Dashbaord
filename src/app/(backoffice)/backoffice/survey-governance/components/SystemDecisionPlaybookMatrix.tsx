'use client';

/**
 * @fileOverview Backoffice Platform Control Plane — Global Survey Decision Playbooks Matrix
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Global Standard Playbook Catalog:
 *    - Governs reusable automation playbooks available for all tenant survey creators.
 * 2. Protection Invariant:
 *    - System protected standard playbooks cannot be deleted.
 * 3. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import type { SystemDecisionPlaybook, DecisionPlaybookCategory } from '@/lib/types';
import {
  getSystemDecisionPlaybooksAction,
  saveSystemDecisionPlaybooksAction,
} from '@/lib/surveys/survey-decision-engine';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Workflow,
  Plus,
  Trash2,
  Lock,
  Save,
  Loader2,
  Sparkles,
} from 'lucide-react';

export default function SystemDecisionPlaybookMatrix() {
  const { toast } = useToast();

  const [playbooks, setPlaybooks] = React.useState<SystemDecisionPlaybook[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  const fetchPlaybooks = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getSystemDecisionPlaybooksAction();
      if (res.success && res.playbooks) {
        setPlaybooks(res.playbooks);
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load system decision playbooks',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchPlaybooks();
  }, [fetchPlaybooks]);

  const addPlaybook = () => {
    const newPb: SystemDecisionPlaybook = {
      id: `pb_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: 'New Custom Decision Playbook',
      description: 'Executes automated actions on specific response triggers',
      category: 'lead_qualification',
      isProtected: false,
      rule: {
        name: 'New Custom Rule',
        enabled: true,
        conditionLogic: 'AND',
        conditions: [
          { id: `c_${Date.now()}`, type: 'score', operator: 'greater_than', value: 80 },
        ],
        actions: [
          { id: `a_${Date.now()}`, type: 'adjust_lead_score', scoreDelta: 10 },
        ],
      },
    };
    setPlaybooks((prev) => [...prev, newPb]);
  };

  const updatePlaybook = (id: string, patch: Partial<SystemDecisionPlaybook>) => {
    setPlaybooks((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const removePlaybook = (id: string) => {
    const target = playbooks.find((p) => p.id === id);
    if (target?.isProtected) {
      toast({
        variant: 'destructive',
        title: 'Protected Playbook',
        description: 'System standard playbooks are protected and cannot be deleted.',
      });
      return;
    }
    setPlaybooks((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await saveSystemDecisionPlaybooksAction(playbooks);
      if (res.success) {
        toast({
          title: 'Playbooks Saved',
          description: 'Global Survey Decisioning Playbook catalog updated.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: res.error || 'Failed to save playbooks',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred while saving playbooks.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Workflow className="h-5 w-5 text-purple-600" />
              Global Survey Decisioning & Automation Playbooks
            </CardTitle>
            <CardDescription className="text-xs">
              Govern reusable automation playbooks available for all tenant survey creators across the platform.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addPlaybook}
              className="h-9 px-3.5 gap-1.5 text-xs font-semibold active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" />
              Add Playbook
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="h-9 px-4 gap-1.5 text-xs font-semibold active:scale-[0.97]"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs font-bold w-[30%]">Playbook Name & Description</TableHead>
                  <TableHead className="text-xs font-bold w-[25%]">Category</TableHead>
                  <TableHead className="text-xs font-bold w-[25%]">Rule Condition Summary</TableHead>
                  <TableHead className="text-xs font-bold w-[10%]">Actions Count</TableHead>
                  <TableHead className="text-xs font-bold w-[10%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {playbooks.map((pb) => (
                  <TableRow key={pb.id} className="hover:bg-muted/20">
                    <TableCell className="space-y-1">
                      <Input
                        value={pb.name}
                        onChange={(e) => updatePlaybook(pb.id, { name: e.target.value })}
                        className="h-8 text-xs font-bold rounded-lg"
                      />
                      <Input
                        value={pb.description}
                        onChange={(e) => updatePlaybook(pb.id, { description: e.target.value })}
                        className="h-7 text-[11px] text-muted-foreground rounded-lg"
                      />
                    </TableCell>

                    <TableCell>
                      <Select
                        value={pb.category}
                        onValueChange={(val) => updatePlaybook(pb.id, { category: val as DecisionPlaybookCategory })}
                      >
                        <SelectTrigger className="h-8 text-xs rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="detractor_recovery" className="text-xs font-semibold text-rose-600">Detractor Recovery</SelectItem>
                          <SelectItem value="promoter_upsell" className="text-xs font-semibold text-emerald-600">Promoter Upsell</SelectItem>
                          <SelectItem value="lead_qualification" className="text-xs font-semibold text-blue-600">Lead Qualification</SelectItem>
                          <SelectItem value="retention_intervention" className="text-xs font-semibold text-amber-600">Retention Intervention</SelectItem>
                          <SelectItem value="sla_breach" className="text-xs font-semibold text-purple-600">SLA Breach</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-foreground">{pb.rule.name}</span>
                        <div className="flex items-center gap-1 flex-wrap">
                          {pb.rule.conditions.map((c, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono">
                              {c.type} {c.operator} {String(c.value)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="text-xs font-mono">
                        {pb.rule.actions.length} steps
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      {pb.isProtected ? (
                        <span className="p-2 text-muted-foreground inline-block" title="Protected System Playbook">
                          <Lock className="h-4 w-4" />
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removePlaybook(pb.id)}
                          className="h-8 w-8 text-rose-500 hover:text-rose-700 active:scale-[0.97]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
