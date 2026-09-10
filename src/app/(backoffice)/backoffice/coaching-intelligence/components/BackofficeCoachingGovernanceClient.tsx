'use client';

/**
 * @fileoverview Backoffice Platform Control Plane for Conversation Intelligence & Coaching (Phase 5).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills PRD Section 42 & Backoffice Governance Specs:
 * 1. Scorecard Rubric Builder: Visual editor for scorecard templates, criteria, weights, and rubric guidance.
 *    Auto-balances weights to Σ = 1.0 using coaching-engine.ts.
 * 2. Practice Scenario Studio: Visual editor for AI Buyer roleplay scenarios, buyer persona tone, and initial objection prompts.
 * 3. Speech Dynamics Thresholds: Informational panel on monologue alarm thresholds and pacing targets.
 * 4. FER Migration Runner: 1-click execution of idempotent Fetch-Enrich-Restore provisioning and call seeder.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strictly typed (zero 'any' or 'any[]').
 * - Touch targets maintain >= 44px height (min-h-[44px]) for mobile accessibility.
 * - Tactile micro-interactions use active:scale-[0.97] (emilkowal-animations).
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  GraduationCap,
  FileCheck,
  Zap,
  Sliders,
  Loader2,
  Database,
  Bot,
  Save,
} from 'lucide-react';
import type {
  ScorecardTemplate,
  PracticeLabScenario,
} from '@/lib/conversation-coaching/types';
import {
  autoBalanceCriteriaWeights,
  validateScorecardTemplateIntegrity,
} from '@/lib/conversation-coaching/coaching-engine';
import {
  getCoachingWorkspaceAction,
  saveScorecardTemplateAction,
  savePracticeScenarioAction,
  runCoachingMigrationAction,
} from '@/app/actions/conversation-coaching-actions';

export default function BackofficeCoachingGovernanceClient() {
  const { toast } = useToast();
  const workspaceId = 'ws_default';
  const organizationId = 'org_default';

  const [activeTab, setActiveTab] = React.useState<string>('rubrics');
  const [templates, setTemplates] = React.useState<ScorecardTemplate[]>([]);
  const [scenarios, setScenarios] = React.useState<PracticeLabScenario[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isMigrating, setIsMigrating] = React.useState<boolean>(false);

  // Template Editing State
  const [selectedTemplate, setSelectedTemplate] = React.useState<ScorecardTemplate | null>(null);
  const [isSavingTemplate, setIsSavingTemplate] = React.useState<boolean>(false);

  // Scenario Editing State
  const [selectedScenario, setSelectedScenario] = React.useState<PracticeLabScenario | null>(null);
  const [isSavingScenario, setIsSavingScenario] = React.useState<boolean>(false);

  const loadData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await getCoachingWorkspaceAction({
        workspaceId,
        organizationId,
      });

      if (res.success) {
        setTemplates(res.templates);
        setScenarios(res.scenarios);
        if (res.templates.length > 0 && !selectedTemplate) {
          setSelectedTemplate(res.templates[0]);
        }
        if (res.scenarios.length > 0 && !selectedScenario) {
          setSelectedScenario(res.scenarios[0]);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: 'Error loading governance data',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, organizationId, toast]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Run FER Migration on-demand
  const handleRunMigration = async () => {
    try {
      setIsMigrating(true);
      const res = await runCoachingMigrationAction({
        workspaceId,
        organizationId,
        seedCalls: true,
      });

      if (res.success) {
        toast({
          title: 'FER Migration Successful',
          description: res.message,
        });
        await loadData();
      } else {
        throw new Error(res.error || 'Migration failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: 'Migration Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsMigrating(false);
    }
  };

  // Save Template handler
  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      setIsSavingTemplate(true);
      const validation = validateScorecardTemplateIntegrity(selectedTemplate);
      if (!validation.isValid) {
        toast({
          title: 'Weight Validation Failed',
          description: validation.errors.join(', '),
          variant: 'destructive',
        });
        return;
      }

      const res = await saveScorecardTemplateAction({
        workspaceId,
        organizationId,
        template: selectedTemplate,
      });

      if (res.success) {
        toast({
          title: 'Scorecard Template Saved',
          description: `Successfully updated "${selectedTemplate.name}".`,
        });
        await loadData();
      } else {
        throw new Error(res.error || 'Failed to save template');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: 'Save Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Auto-balance criteria weights
  const handleAutoBalance = () => {
    if (!selectedTemplate) return;
    const balanced = autoBalanceCriteriaWeights(selectedTemplate.criteria);
    setSelectedTemplate({
      ...selectedTemplate,
      criteria: balanced,
    });
    toast({
      title: 'Weights Auto-Balanced',
      description: 'Criteria weights have been evenly normalized to sum to 100%.',
    });
  };

  // Save Scenario handler
  const handleSaveScenario = async () => {
    if (!selectedScenario) return;

    try {
      setIsSavingScenario(true);
      const res = await savePracticeScenarioAction({
        workspaceId,
        scenario: selectedScenario,
      });

      if (res.success) {
        toast({
          title: 'Practice Scenario Saved',
          description: `Successfully updated "${selectedScenario.title}".`,
        });
        await loadData();
      } else {
        throw new Error(res.error || 'Failed to save scenario');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: 'Save Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSavingScenario(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Loading Coaching Governance Control Plane...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6 pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Coaching Intelligence Governance</h2>
            <Badge variant="outline" className="text-xs uppercase font-mono">
              Super-Admin
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Platform control plane for managing Gong-style scorecard rubrics, AI Buyer practice scenarios, and FER provisioning.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isMigrating}
            onClick={handleRunMigration}
            className="min-h-[44px] active:scale-[0.97] transition-all duration-150 text-xs font-semibold"
          >
            {isMigrating ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Database className="w-3.5 h-3.5 mr-1.5" />
            )}
            Run FER Migration / Seed
          </Button>
        </div>
      </div>

      {/* Tabs Cockpit */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 max-w-md p-1 bg-muted/60 min-h-[44px]">
          <TabsTrigger value="rubrics" className="text-xs font-semibold">
            <FileCheck className="w-3.5 h-3.5 mr-1.5" />
            Scorecard Rubrics
          </TabsTrigger>
          <TabsTrigger value="scenarios" className="text-xs font-semibold">
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            Practice Scenarios
          </TabsTrigger>
          <TabsTrigger value="thresholds" className="text-xs font-semibold">
            <Sliders className="w-3.5 h-3.5 mr-1.5" />
            Speech Dynamics
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Scorecard Rubrics Builder */}
        <TabsContent value="rubrics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Template List (4 Cols) */}
            <Card className="lg:col-span-4 p-4 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="text-sm font-bold text-foreground">Scorecard Templates</h4>
                <Badge variant="secondary" className="font-mono text-xs">
                  {templates.length} Active
                </Badge>
              </div>

              <div className="space-y-2">
                {templates.map((tpl) => {
                  const isSelected = selectedTemplate?.id === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => setSelectedTemplate(tpl)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border bg-card hover:border-border/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{tpl.name}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {tpl.category}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{tpl.description}</p>
                      <div className="text-[10px] text-muted-foreground mt-1.5 font-mono">
                        {tpl.criteria.length} criteria • Σ weight{' '}
                        {Math.round(tpl.criteria.reduce((s, c) => s + c.weight, 0) * 100)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Right: Rubric Criteria Editor (8 Cols) */}
            {selectedTemplate && (
              <Card className="lg:col-span-8 p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">{selectedTemplate.name}</h3>
                    <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAutoBalance}
                      className="min-h-[44px] active:scale-[0.97] text-xs font-semibold"
                    >
                      Auto-Balance (100%)
                    </Button>
                    <Button
                      size="sm"
                      disabled={isSavingTemplate}
                      onClick={handleSaveTemplate}
                      className="min-h-[44px] active:scale-[0.97] text-xs font-semibold"
                    >
                      {isSavingTemplate ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Save Rubric
                    </Button>
                  </div>
                </div>

                {/* Criteria List */}
                <div className="space-y-4">
                  {selectedTemplate.criteria.map((crit, idx) => {
                    const weightPct = Math.round(crit.weight * 100);

                    return (
                      <div key={crit.id} className="rounded-lg border p-4 bg-muted/20 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="font-mono text-xs font-bold text-primary">#{idx + 1}</span>
                            <Input
                              value={crit.name}
                              onChange={(e) => {
                                const newCriteria = [...selectedTemplate.criteria];
                                newCriteria[idx] = { ...crit, name: e.target.value };
                                setSelectedTemplate({ ...selectedTemplate, criteria: newCriteria });
                              }}
                              className="text-xs font-bold h-9 bg-background"
                            />
                          </div>

                          <div className="flex items-center gap-1.5 w-32">
                            <span className="text-xs text-muted-foreground">Weight:</span>
                            <Input
                              type="number"
                              min={1}
                              max={100}
                              value={weightPct}
                              onChange={(e) => {
                                const newPct = Number(e.target.value) || 0;
                                const newCriteria = [...selectedTemplate.criteria];
                                newCriteria[idx] = { ...crit, weight: newPct / 100 };
                                setSelectedTemplate({ ...selectedTemplate, criteria: newCriteria });
                              }}
                              className="text-xs font-mono h-9 bg-background text-right"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </div>

                        <Textarea
                          value={crit.description}
                          onChange={(e) => {
                            const newCriteria = [...selectedTemplate.criteria];
                            newCriteria[idx] = { ...crit, description: e.target.value };
                            setSelectedTemplate({ ...selectedTemplate, criteria: newCriteria });
                          }}
                          placeholder="Criterion description..."
                          rows={2}
                          className="text-xs bg-background resize-none"
                        />

                        {/* 1, 3, 5 Guidance */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-rose-600">Score 1 (Poor)</span>
                            <Input
                              value={crit.rubricGuidance[1] || ''}
                              onChange={(e) => {
                                const newCriteria = [...selectedTemplate.criteria];
                                newCriteria[idx] = {
                                  ...crit,
                                  rubricGuidance: { ...crit.rubricGuidance, 1: e.target.value },
                                };
                                setSelectedTemplate({ ...selectedTemplate, criteria: newCriteria });
                              }}
                              className="text-[11px] h-8 bg-background"
                            />
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-amber-600">Score 3 (Adequate)</span>
                            <Input
                              value={crit.rubricGuidance[3] || ''}
                              onChange={(e) => {
                                const newCriteria = [...selectedTemplate.criteria];
                                newCriteria[idx] = {
                                  ...crit,
                                  rubricGuidance: { ...crit.rubricGuidance, 3: e.target.value },
                                };
                                setSelectedTemplate({ ...selectedTemplate, criteria: newCriteria });
                              }}
                              className="text-[11px] h-8 bg-background"
                            />
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-emerald-600">Score 5 (Excellent)</span>
                            <Input
                              value={crit.rubricGuidance[5] || ''}
                              onChange={(e) => {
                                const newCriteria = [...selectedTemplate.criteria];
                                newCriteria[idx] = {
                                  ...crit,
                                  rubricGuidance: { ...crit.rubricGuidance, 5: e.target.value },
                                };
                                setSelectedTemplate({ ...selectedTemplate, criteria: newCriteria });
                              }}
                              className="text-[11px] h-8 bg-background"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Practice Scenarios Studio */}
        <TabsContent value="scenarios" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Scenario List (4 Cols) */}
            <Card className="lg:col-span-4 p-4 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="text-sm font-bold text-foreground">Practice Scenarios</h4>
                <Badge variant="secondary" className="font-mono text-xs">
                  {scenarios.length} Scenarios
                </Badge>
              </div>

              <div className="space-y-2">
                {scenarios.map((scen) => {
                  const isSelected = selectedScenario?.id === scen.id;
                  return (
                    <div
                      key={scen.id}
                      onClick={() => setSelectedScenario(scen)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border bg-card hover:border-border/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{scen.title}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {scen.difficulty}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{scen.description}</p>
                      <div className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                        <Bot className="w-3 h-3 text-primary" />
                        {scen.buyerPersona.name} ({scen.buyerPersona.tone} tone)
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Right: Scenario Studio (8 Cols) */}
            {selectedScenario && (
              <Card className="lg:col-span-8 p-6 space-y-5">
                <div className="flex items-center justify-between border-b pb-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Configure Scenario & Persona</h3>
                    <p className="text-xs text-muted-foreground">
                      Set AI Buyer tone, objection friction, and target competencies.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={isSavingScenario}
                    onClick={handleSaveScenario}
                    className="min-h-[44px] active:scale-[0.97] text-xs font-semibold"
                  >
                    {isSavingScenario ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Save Scenario
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Scenario Title</label>
                    <Input
                      value={selectedScenario.title}
                      onChange={(e) => setSelectedScenario({ ...selectedScenario, title: e.target.value })}
                      className="text-xs h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Difficulty Level</label>
                    <select
                      aria-label="Select difficulty level"
                      value={selectedScenario.difficulty}
                      onChange={(e) =>
                        setSelectedScenario({
                          ...selectedScenario,
                          difficulty: e.target.value as 'beginner' | 'intermediate' | 'advanced',
                        })
                      }
                      className="w-full rounded-md border bg-background px-3 py-2 text-xs min-h-[44px] text-foreground focus:ring-1 focus:ring-primary capitalize"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                </div>

                {/* Persona Details */}
                <div className="rounded-lg border p-4 bg-muted/20 space-y-3">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-primary" />
                    Buyer Persona Setup
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">Buyer Name</span>
                      <Input
                        value={selectedScenario.buyerPersona.name}
                        onChange={(e) =>
                          setSelectedScenario({
                            ...selectedScenario,
                            buyerPersona: { ...selectedScenario.buyerPersona, name: e.target.value },
                          })
                        }
                        className="text-xs h-9 bg-background"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">Buyer Title</span>
                      <Input
                        value={selectedScenario.buyerPersona.title}
                        onChange={(e) =>
                          setSelectedScenario({
                            ...selectedScenario,
                            buyerPersona: { ...selectedScenario.buyerPersona, title: e.target.value },
                          })
                        }
                        className="text-xs h-9 bg-background"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">Persona Tone</span>
                      <select
                        aria-label="Select persona tone"
                        value={selectedScenario.buyerPersona.tone}
                        onChange={(e) =>
                          setSelectedScenario({
                            ...selectedScenario,
                            buyerPersona: {
                              ...selectedScenario.buyerPersona,
                              tone: e.target.value as 'skeptical' | 'busy' | 'analytical' | 'friendly',
                            },
                          })
                        }
                        className="w-full rounded-md border bg-background px-3 py-2 text-xs h-9 text-foreground capitalize"
                      >
                        <option value="skeptical">Skeptical</option>
                        <option value="busy">Busy / Impatient</option>
                        <option value="analytical">Analytical</option>
                        <option value="friendly">Friendly but Cautious</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Initial Objection Prompt */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Initial Buyer Opening Statement / Objection
                  </label>
                  <Textarea
                    value={selectedScenario.initialPrompt}
                    onChange={(e) => setSelectedScenario({ ...selectedScenario, initialPrompt: e.target.value })}
                    rows={3}
                    className="text-xs resize-none"
                  />
                </div>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Speech Dynamics Thresholds */}
        <TabsContent value="thresholds" className="space-y-6">
          <Card className="p-6 space-y-4">
            <h4 className="text-base font-bold text-foreground border-b pb-3">
              Speech Dynamics & Conversation Intelligence Baseline
            </h4>
            <p className="text-xs text-muted-foreground">
              These deterministic thresholds govern automated call analysis, talk-to-listen ratios, and monologue alarms.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border p-4 bg-card space-y-2">
                <span className="text-xs font-semibold text-foreground">Monologue Alarm Limit</span>
                <div className="text-2xl font-black text-primary">120 seconds</div>
                <p className="text-[11px] text-muted-foreground">
                  Uninterrupted speaker turns exceeding 120s trigger a monologue warning flag on scorecards.
                </p>
              </div>

              <div className="rounded-lg border p-4 bg-card space-y-2">
                <span className="text-xs font-semibold text-foreground">Optimal Talk-to-Listen Ratio</span>
                <div className="text-2xl font-black text-emerald-600">45% – 55%</div>
                <p className="text-[11px] text-muted-foreground">
                  Optimal calls balance rep articulation with active buyer listening. Exceeding 65% triggers rep dominance.
                </p>
              </div>

              <div className="rounded-lg border p-4 bg-card space-y-2">
                <span className="text-xs font-semibold text-foreground">Target Pacing</span>
                <div className="text-2xl font-black text-blue-600">130 – 160 WPM</div>
                <p className="text-[11px] text-muted-foreground">
                  Standard conversational pacing. Below 120 WPM is flagged as slow; above 170 WPM as rushed.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
