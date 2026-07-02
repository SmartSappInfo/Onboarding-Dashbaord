'use client';

import * as React from 'react';
import { useTenant } from '@/context/TenantContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { 
  getEffortRulesAction, 
  saveEffortRuleAction, 
  resetEffortRulesToDefaultsAction,
  type EffortRuleDoc
} from '@/lib/scoring-performance-engine';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PageContainer } from '@/components/ui/page-container';
import { Sliders, RotateCcw, Search, Sparkles, Loader2, Save } from 'lucide-react';

export default function SalesPerformanceClient() {
  const { activeOrganizationId } = useTenant();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [rules, setRules] = React.useState<EffortRuleDoc[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isResetting, setIsResetting] = React.useState(false);
  const [savingRuleId, setSavingRuleId] = React.useState<string | null>(null);

  // Points input states to avoid constant backend writes
  const [localPoints, setLocalPoints] = React.useState<Record<string, string>>({});

  const fetchRules = React.useCallback(async () => {
    if (!activeOrganizationId || !activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const data = await getEffortRulesAction(activeOrganizationId, activeWorkspaceId);
      setRules(data);
      
      // Initialize local points
      const pointsMap: Record<string, string> = {};
      data.forEach(r => {
        pointsMap[r.id] = String(r.points);
      });
      setLocalPoints(pointsMap);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch rules';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeOrganizationId, activeWorkspaceId, toast]);

  React.useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    if (!activeWorkspaceId) return;
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    setSavingRuleId(ruleId);
    try {
      const res = await saveEffortRuleAction(activeWorkspaceId, ruleId, rule.points, enabled);
      if (res.success) {
        setRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled } : r));
        toast({
          title: 'Rule updated',
          description: `Successfully ${enabled ? 'enabled' : 'disabled'} rule: ${rule.eventType}`,
        });
      } else {
        throw new Error(res.error);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update rule';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMsg,
      });
    } finally {
      setSavingRuleId(null);
    }
  };

  const handleSavePoints = async (ruleId: string) => {
    if (!activeWorkspaceId) return;
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    const val = localPoints[ruleId];
    const parsed = Number(val);
    if (isNaN(parsed) || parsed < 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Point values must be non-negative integers.',
      });
      return;
    }

    // Skip if unchanged
    if (parsed === rule.points) return;

    setSavingRuleId(ruleId);
    try {
      const res = await saveEffortRuleAction(activeWorkspaceId, ruleId, parsed, rule.enabled);
      if (res.success) {
        setRules(prev => prev.map(r => r.id === ruleId ? { ...r, points: parsed } : r));
        toast({
          title: 'Points updated',
          description: `Set point value to ${parsed} for ${rule.eventType}`,
        });
      } else {
        throw new Error(res.error);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update points';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMsg,
      });
    } finally {
      setSavingRuleId(null);
    }
  };

  const handleResetToDefaults = async () => {
    if (!activeOrganizationId || !activeWorkspaceId) return;
    setIsResetting(true);
    try {
      const res = await resetEffortRulesToDefaultsAction(activeOrganizationId, activeWorkspaceId);
      if (res.success) {
        toast({
          title: 'Reset complete',
          description: 'Successfully reverted all effort rules to system defaults.',
        });
        await fetchRules();
      } else {
        throw new Error(res.error);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Reset failed';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMsg,
      });
    } finally {
      setIsResetting(false);
    }
  };

  const filteredRules = React.useMemo(() => {
    return rules.filter(r => {
      const search = searchTerm.toLowerCase();
      return (
        r.eventType.toLowerCase().includes(search) ||
        r.entityType.toLowerCase().includes(search) ||
        r.description.toLowerCase().includes(search)
      );
    });
  }, [rules, searchTerm]);

  return (
    <PageContainer>
      <div className="space-y-6 pb-24 w-full text-left">
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <Sliders className="h-6 w-6 text-primary animate-pulse" /> Sales Effort Rules Settings
            </h1>
            <p className="text-sm text-muted-foreground">
              Define the point values awarded to sales executives for operational tasks, activities, and communication events.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleResetToDefaults}
              disabled={isLoading || isResetting}
              className="rounded-xl active:scale-[0.97] transition-all duration-200 border-rose-500/20 text-rose-500 hover:bg-rose-500/5 hover:text-rose-600"
            >
              {isResetting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Reset Defaults
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 w-full max-w-md bg-card border rounded-xl px-3 h-10 shadow-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search rules by event, entity, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-full text-xs font-medium"
          />
        </div>

        {/* Rules Grid */}
        <Card className="rounded-2xl border-border/40 bg-card/35 backdrop-blur-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/15">
                <TableHead className="text-xs font-bold uppercase tracking-wider">Event</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">Entity</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider">Description</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider w-[120px] text-center">Points</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider w-[100px] text-center">Enabled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-xs font-semibold text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                    Fetching sales performance rules...
                  </TableCell>
                </TableRow>
              ) : filteredRules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-xs font-semibold text-muted-foreground">
                    No rules found matching your filter constraints.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRules.map((rule) => {
                  const isSaving = savingRuleId === rule.id;
                  return (
                    <TableRow key={rule.id} className="transition-all hover:bg-muted/20">
                      <TableCell className="font-semibold text-xs font-mono py-4">
                        {rule.eventType}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg bg-muted/40">
                          {rule.entityType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-muted-foreground py-4 max-w-sm">
                        {rule.description}
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 max-w-[100px] mx-auto">
                          <Input
                            type="number"
                            min="0"
                            value={localPoints[rule.id] !== undefined ? localPoints[rule.id] : ''}
                            onChange={(e) => setLocalPoints(prev => ({ ...prev, [rule.id]: e.target.value }))}
                            onBlur={() => handleSavePoints(rule.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSavePoints(rule.id);
                                e.currentTarget.blur();
                              }
                            }}
                            className="h-8 w-14 text-center text-xs font-bold rounded-lg focus-visible:ring-primary font-mono bg-background"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        <div className="flex justify-center">
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                            disabled={isSaving}
                            className="data-[state=checked]:bg-emerald-500"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </PageContainer>
  );
}
