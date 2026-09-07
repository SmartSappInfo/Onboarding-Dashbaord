'use client';

import * as React from 'react';
import {
  type Idea,
  type IdeaAssumption,
  type IdeaHypothesis,
  type IdeaExperiment,
  type IdeaDecision,
  type IdeaLifecycleStage,
  type IdeaValidationStatus,
  type IdeaPriority,
  type IdeaAssumptionRiskLevel,
} from '@/lib/quick-notes-types';
import {
  calculateIceScore,
  getLifecycleStageDisplayLabel,
  getValidationStatusDisplayLabel,
  getAssumptionRiskDisplay,
} from '@/lib/quick-notes-domain';
import {
  X,
  Sparkles,
  Save,
  Trash2,
  CheckSquare,
  TrendingUp,
  ShieldAlert,
  FlaskConical,
  FileText,
  CheckCircle2,
  Layers,
  Plus,
  ArrowRight,
  ExternalLink,
  Loader2,
  Sliders,
  Rocket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  updateIdeaAction,
  deleteIdeaAction,
  challengeIdeaAssumptionsAiAction,
  convertIdeaToTaskAction,
} from '@/lib/quick-notes-idea-actions';
import { generateCampaignConceptAction } from '@/lib/quick-notes-campaign-actions';

interface IdeaEditorDrawerProps {
  idea: Idea | null;
  workspaceId: string;
  userId: string;
  open: boolean;
  onClose: () => void;
  onIdeaUpdated: (updated: Idea) => void;
  onIdeaDeleted: (deletedId: string) => void;
}

export function IdeaEditorDrawer({
  idea,
  workspaceId,
  userId,
  open,
  onClose,
  onIdeaUpdated,
  onIdeaDeleted,
}: IdeaEditorDrawerProps) {
  const { toast } = useToast();

  const [title, setTitle] = React.useState('');
  const [summary, setSummary] = React.useState('');
  const [problem, setProblem] = React.useState('');
  const [proposedSolution, setProposedSolution] = React.useState('');
  const [lifecycleStage, setLifecycleStage] = React.useState<IdeaLifecycleStage>('captured');
  const [validationStatus, setValidationStatus] = React.useState<IdeaValidationStatus>('unvalidated');
  const [priority, setPriority] = React.useState<IdeaPriority>('medium');

  const [impact, setImpact] = React.useState(7);
  const [effort, setEffort] = React.useState(4);
  const [confidence, setConfidence] = React.useState(6);

  const [assumptions, setAssumptions] = React.useState<IdeaAssumption[]>([]);
  const [hypotheses, setHypotheses] = React.useState<IdeaHypothesis[]>([]);
  const [experiments, setExperiments] = React.useState<IdeaExperiment[]>([]);
  const [decisions, setDecisions] = React.useState<IdeaDecision[]>([]);

  const [newAssumptionText, setNewAssumptionText] = React.useState('');
  const [newAssumptionRisk, setNewAssumptionRisk] = React.useState<IdeaAssumptionRiskLevel>('medium');

  const [newHypoAction, setNewHypoAction] = React.useState('');
  const [newHypoOutcome, setNewHypoOutcome] = React.useState('');
  const [newHypoRationale, setNewHypoRationale] = React.useState('');

  const [newExpName, setNewExpName] = React.useState('');
  const [newExpDescription, setNewExpDescription] = React.useState('');

  const [newDecisionTitle, setNewDecisionTitle] = React.useState('');
  const [newDecisionRationale, setNewDecisionRationale] = React.useState('');

  const [isSaving, setIsSaving] = React.useState(false);
  const [isChallengingAi, setIsChallengingAi] = React.useState(false);
  const [isConvertingTask, setIsConvertingTask] = React.useState(false);
  const [isGeneratingCampaign, setIsGeneratingCampaign] = React.useState(false);

  React.useEffect(() => {
    if (idea) {
      setTitle(idea.title || '');
      setSummary(idea.summary || '');
      setProblem(idea.problem || '');
      setProposedSolution(idea.proposedSolution || '');
      setLifecycleStage(idea.lifecycleStage || 'captured');
      setValidationStatus(idea.validationStatus || 'unvalidated');
      setPriority(idea.priority || 'medium');
      setImpact(idea.impact || 7);
      setEffort(idea.effort || 4);
      setConfidence(idea.confidence || 6);
      setAssumptions(idea.assumptions || []);
      setHypotheses(idea.hypotheses || []);
      setExperiments(idea.experiments || []);
      setDecisions(idea.decisions || []);
    }
  }, [idea]);

  if (!open || !idea) return null;

  const currentIceScore = calculateIceScore(impact, effort, confidence);

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await updateIdeaAction(
        workspaceId,
        idea.id,
        {
          title,
          summary,
          problem,
          proposedSolution,
          lifecycleStage,
          validationStatus,
          priority,
          impact,
          effort,
          confidence,
          assumptions,
          hypotheses,
          experiments,
          decisions,
        },
        userId
      );

      if (res.success && res.data) {
        toast({ title: 'Idea updated successfully' });
        onIdeaUpdated(res.data);
      } else {
        toast({ title: 'Failed to update idea', description: res.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error updating idea', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Add Assumption
  const handleAddAssumption = () => {
    if (!newAssumptionText.trim()) return;
    const newAssump: IdeaAssumption = {
      id: `assump-${Date.now()}`,
      statement: newAssumptionText.trim(),
      riskLevel: newAssumptionRisk,
      status: 'untested',
      evidenceIds: [],
      createdAt: new Date().toISOString(),
    };
    setAssumptions((prev) => [...prev, newAssump]);
    setNewAssumptionText('');
  };

  // Toggle Assumption Status
  const handleToggleAssumptionStatus = (id: string) => {
    setAssumptions((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const nextStatus: IdeaAssumption['status'] =
          a.status === 'untested' ? 'validating' : a.status === 'validating' ? 'supported' : a.status === 'supported' ? 'invalidated' : 'untested';
        return { ...a, status: nextStatus };
      })
    );
  };

  // Add Hypothesis
  const handleAddHypothesis = () => {
    if (!newHypoAction.trim() || !newHypoOutcome.trim()) return;
    const statement = `If we ${newHypoAction.trim()}, then ${newHypoOutcome.trim()}${
      newHypoRationale.trim() ? `, because ${newHypoRationale.trim()}` : ''
    }.`;

    const newHypo: IdeaHypothesis = {
      id: `hypo-${Date.now()}`,
      statement,
      action: newHypoAction.trim(),
      expectedOutcome: newHypoOutcome.trim(),
      status: 'draft',
      evidenceIds: [],
      createdAt: new Date().toISOString(),
    };

    setHypotheses((prev) => [...prev, newHypo]);
    setNewHypoAction('');
    setNewHypoOutcome('');
    setNewHypoRationale('');
  };

  const handleAddExperiment = () => {
    if (!newExpName.trim()) return;
    const exp: IdeaExperiment = {
      id: `exp-${Date.now()}`,
      name: newExpName.trim(),
      description: newExpDescription.trim() || undefined,
      status: 'planned',
      createdAt: new Date().toISOString(),
    };
    setExperiments((prev) => [...prev, exp]);
    setNewExpName('');
    setNewExpDescription('');
  };

  const handleAddDecision = () => {
    if (!newDecisionTitle.trim()) return;
    const dec: IdeaDecision = {
      id: `dec-${Date.now()}`,
      title: newDecisionTitle.trim(),
      rationale: newDecisionRationale.trim() || undefined,
      decisionMakerId: userId,
      decidedAt: new Date().toISOString(),
      status: 'approved',
    };
    setDecisions((prev) => [...prev, dec]);
    setNewDecisionTitle('');
    setNewDecisionRationale('');
  };

  // Devil's Advocate AI Challenge
  const handleChallengeAssumptions = async () => {
    setIsChallengingAi(true);
    try {
      const res = await challengeIdeaAssumptionsAiAction(workspaceId, idea.id, userId);
      if (res.success && res.data) {
        if (res.data.unstatedAssumptions && res.data.unstatedAssumptions.length > 0) {
          const autoAdded: IdeaAssumption[] = res.data.unstatedAssumptions.map((u, i) => ({
            id: `assump-ai-${Date.now()}-${i}`,
            statement: u.statement,
            riskLevel: u.riskLevel,
            status: 'untested',
            evidenceIds: [],
            notes: `Potential Failure Mode: ${u.potentialFailureMode}`,
            createdAt: new Date().toISOString(),
          }));

          setAssumptions((prev) => [...prev, ...autoAdded]);
        }

        toast({
          title: 'Devil\'s Advocate Critique Complete',
          description: `Identified ${res.data.unstatedAssumptions.length} unstated assumptions. Risk: ${res.data.overallRiskRating.toUpperCase()}`,
        });
      } else {
        toast({ title: 'Critique Notice', description: res.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error running assumption challenge', variant: 'destructive' });
    } finally {
      setIsChallengingAi(false);
    }
  };

  // Convert to Task
  const handleConvertToTask = async () => {
    setIsConvertingTask(true);
    try {
      const res = await convertIdeaToTaskAction(workspaceId, idea.id, userId, {
        title: `Implement: ${title}`,
        priority,
      });

      if (res.success && res.data) {
        toast({
          title: 'Task Created Successfully',
          description: 'Idea has been linked to a new task.',
          actionConfig: {
            path: '/admin/tasks',
            label: 'View Tasks',
          },
        });
        setLifecycleStage('implemented');
      } else {
        toast({ title: 'Failed to convert idea', description: res.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error converting to task', variant: 'destructive' });
    } finally {
      setIsConvertingTask(false);
    }
  };

  // Generate Campaign Concept
  const handleGenerateCampaignConcept = async () => {
    setIsGeneratingCampaign(true);
    try {
      const res = await generateCampaignConceptAction(workspaceId, {
        ideaId: idea.id,
        userId,
      });

      if (res.success && res.concept) {
        toast({
          title: 'Campaign Concept Synthesized',
          description: `Created campaign strategy "${res.concept.title}".`,
          actionConfig: {
            path: '/admin/quick-notes/campaigns',
            label: 'Open Campaign Hub',
          },
        });
      } else {
        toast({
          title: 'Synthesis Failed',
          description: res.error || 'Failed to generate campaign concept.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error synthesizing campaign concept', variant: 'destructive' });
    } finally {
      setIsGeneratingCampaign(false);
    }
  };

  // Delete Idea
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this idea?')) return;
    try {
      const res = await deleteIdeaAction(workspaceId, idea.id, userId);
      if (res.success) {
        toast({ title: 'Idea deleted' });
        onIdeaDeleted(idea.id);
        onClose();
      }
    } catch {
      toast({ title: 'Error deleting idea', variant: 'destructive' });
    }
  };

  const { label: stageLabel, badgeBg: stageBadgeBg } = getLifecycleStageDisplayLabel(lifecycleStage);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="w-full max-w-2xl h-full bg-card border-l border-border/80 shadow-2xl flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-border/60 flex items-center justify-between gap-4 bg-muted/20">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary font-black text-sm">
              <TrendingUp className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stageBadgeBg}`}>
                  {stageLabel}
                </span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                  ICE {currentIceScore}
                </span>
              </div>
              <h2 className="text-sm font-bold text-foreground truncate mt-1">
                {title || 'Untitled Idea'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateCampaignConcept}
              disabled={isGeneratingCampaign}
              className="h-8 text-xs font-semibold gap-1 text-blue-600 border-blue-300 dark:border-blue-800 dark:text-blue-400"
            >
              {isGeneratingCampaign ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
              To Campaign
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleConvertToTask}
              disabled={isConvertingTask}
              className="h-8 text-xs font-semibold gap-1"
            >
              {isConvertingTask ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckSquare className="h-3.5 w-3.5" />}
              To Task
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-lg">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabbed Workbench Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid grid-cols-6 w-full bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="overview" className="text-[11px] font-semibold">Overview</TabsTrigger>
              <TabsTrigger value="assumptions" className="text-[11px] font-semibold">Assumptions ({assumptions.length})</TabsTrigger>
              <TabsTrigger value="hypotheses" className="text-[11px] font-semibold">Hypotheses ({hypotheses.length})</TabsTrigger>
              <TabsTrigger value="experiments" className="text-[11px] font-semibold">Experiments ({experiments.length})</TabsTrigger>
              <TabsTrigger value="decisions" className="text-[11px] font-semibold">Decisions ({decisions.length})</TabsTrigger>
              <TabsTrigger value="scoring" className="text-[11px] font-semibold">ICE Scoring</TabsTrigger>
            </TabsList>

            {/* TAB 1: OVERVIEW */}
            <TabsContent value="overview" className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Idea Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Automated WhatsApp Admissions Concierge"
                  className="font-bold text-sm h-10"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Lifecycle Stage</Label>
                  <Select value={lifecycleStage} onValueChange={(val) => setLifecycleStage(val as IdeaLifecycleStage)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="captured">Captured</SelectItem>
                      <SelectItem value="exploring">Exploring</SelectItem>
                      <SelectItem value="structured">Structured</SelectItem>
                      <SelectItem value="validating">Validating</SelectItem>
                      <SelectItem value="validated">Validated</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="implemented">Implemented</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Validation Status</Label>
                  <Select value={validationStatus} onValueChange={(val) => setValidationStatus(val as IdeaValidationStatus)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unvalidated">Unvalidated</SelectItem>
                      <SelectItem value="testing">Testing</SelectItem>
                      <SelectItem value="supported">Supported</SelectItem>
                      <SelectItem value="validated">Validated</SelectItem>
                      <SelectItem value="invalidated">Invalidated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Problem Statement</Label>
                <Textarea
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  placeholder="What specific friction, pain point, or operational challenge are we solving?"
                  rows={3}
                  className="text-xs leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Proposed Solution & Mechanism</Label>
                <Textarea
                  value={proposedSolution}
                  onChange={(e) => setProposedSolution(e.target.value)}
                  placeholder="How does the proposed concept address this problem?"
                  rows={3}
                  className="text-xs leading-relaxed"
                />
              </div>
            </TabsContent>

            {/* TAB 2: ASSUMPTIONS & DEVIL'S ADVOCATE */}
            <TabsContent value="assumptions" className="space-y-4 pt-2">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div>
                  <h3 className="text-xs font-bold text-foreground">Critical Assumptions</h3>
                  <p className="text-[11px] text-muted-foreground">Underlying premises required for this idea to succeed.</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleChallengeAssumptions}
                  disabled={isChallengingAi}
                  className="h-8 text-xs font-semibold text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/10 gap-1.5"
                >
                  {isChallengingAi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Devil's Advocate Challenge
                </Button>
              </div>

              {/* Add Assumption Form */}
              <div className="flex gap-2">
                <Input
                  value={newAssumptionText}
                  onChange={(e) => setNewAssumptionText(e.target.value)}
                  placeholder="Add an unverified assumption..."
                  className="text-xs h-9"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAssumption();
                    }
                  }}
                />
                <Select value={newAssumptionRisk} onValueChange={(val) => setNewAssumptionRisk(val as IdeaAssumptionRiskLevel)}>
                  <SelectTrigger className="w-32 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low Risk</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High Risk</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleAddAssumption} className="h-9 px-3 text-xs font-bold">
                  Add
                </Button>
              </div>

              {/* List of Assumptions */}
              <div className="space-y-2 pt-2">
                {assumptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-6">No assumptions identified yet.</p>
                ) : (
                  assumptions.map((assump) => {
                    const { badgeClass: riskBadgeClass } = getAssumptionRiskDisplay(assump.riskLevel);
                    return (
                      <div
                        key={assump.id}
                        className="flex items-start justify-between gap-3 p-3 rounded-xl border border-border/60 bg-muted/20"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${riskBadgeClass}`}>
                              {assump.riskLevel}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleAssumptionStatus(assump.id)}
                              className="text-[10px] font-semibold text-primary hover:underline"
                            >
                              Status: {assump.status} (Click to toggle)
                            </button>
                          </div>
                          <p className="text-xs font-medium text-foreground leading-relaxed">
                            {assump.statement}
                          </p>
                          {assump.notes && (
                            <p className="text-[10px] text-muted-foreground italic">
                              {assump.notes}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAssumptions((prev) => prev.filter((a) => a.id !== assump.id))}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>

            {/* TAB 3: HYPOTHESES & SPRINT TESTS */}
            <TabsContent value="hypotheses" className="space-y-4 pt-2">
              <div className="pb-2 border-b border-border/40">
                <h3 className="text-xs font-bold text-foreground">SMART Hypotheses Tracker</h3>
                <p className="text-[11px] text-muted-foreground">Testable predictions formulated as: If [Action] then [Outcome] because [Reason].</p>
              </div>

              {/* Add Hypothesis Form */}
              <div className="p-3 rounded-xl border border-border/60 bg-muted/30 space-y-2">
                <Input
                  value={newHypoAction}
                  onChange={(e) => setNewHypoAction(e.target.value)}
                  placeholder="If we [take this action]..."
                  className="text-xs h-8"
                />
                <Input
                  value={newHypoOutcome}
                  onChange={(e) => setNewHypoOutcome(e.target.value)}
                  placeholder="Then [this measurable outcome occurs]..."
                  className="text-xs h-8"
                />
                <Input
                  value={newHypoRationale}
                  onChange={(e) => setNewHypoRationale(e.target.value)}
                  placeholder="Because [rationale / mechanism]..."
                  className="text-xs h-8"
                />
                <Button size="sm" onClick={handleAddHypothesis} className="w-full h-8 text-xs font-bold">
                  + Add Hypothesis
                </Button>
              </div>

              {/* Hypotheses List */}
              <div className="space-y-2 pt-1">
                {hypotheses.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-6">No hypotheses formulated yet.</p>
                ) : (
                  hypotheses.map((hypo) => (
                    <div
                      key={hypo.id}
                      className="p-3 rounded-xl border border-border/60 bg-muted/20 flex items-start justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {hypo.status}
                        </Badge>
                        <p className="text-xs font-bold text-foreground leading-relaxed">
                          {hypo.statement}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setHypotheses((prev) => prev.filter((h) => h.id !== hypo.id))}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* TAB 4: EXPERIMENTS & SPRINTS */}
            <TabsContent value="experiments" className="space-y-4 pt-2">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div>
                  <h3 className="text-xs font-bold text-foreground">Validation Experiments</h3>
                  <p className="text-[11px] text-muted-foreground">Empirical tests, user interviews, and rapid sprints.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Input
                  value={newExpName}
                  onChange={(e) => setNewExpName(e.target.value)}
                  placeholder="Experiment name (e.g. 5 User Interviews with Bursars)..."
                  className="text-xs h-9"
                />
                <div className="flex gap-2">
                  <Input
                    value={newExpDescription}
                    onChange={(e) => setNewExpDescription(e.target.value)}
                    placeholder="Description / success criteria..."
                    className="text-xs h-9 flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddExperiment}
                    disabled={!newExpName.trim()}
                    className="h-9 text-xs font-bold gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                {experiments.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-border rounded-xl text-xs text-muted-foreground">
                    No experiments designed yet. Define low-cost tests to validate hypotheses.
                  </div>
                ) : (
                  experiments.map((exp) => (
                    <div
                      key={exp.id}
                      className="p-3 rounded-xl border border-border/70 bg-card/60 flex items-start justify-between gap-2"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">{exp.name}</span>
                          <Badge variant="outline" className="text-[9px] uppercase font-mono px-1.5 py-0">
                            {exp.status}
                          </Badge>
                        </div>
                        {exp.description && (
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{exp.description}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExperiments((prev) => prev.filter((e) => e.id !== exp.id))}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* TAB 5: GOVERNANCE DECISIONS */}
            <TabsContent value="decisions" className="space-y-4 pt-2">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div>
                  <h3 className="text-xs font-bold text-foreground">Governance Decisions Vault</h3>
                  <p className="text-[11px] text-muted-foreground">Authoritative stakeholder approvals and architectural decisions.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Input
                  value={newDecisionTitle}
                  onChange={(e) => setNewDecisionTitle(e.target.value)}
                  placeholder="Decision title (e.g. Approved for Phase 2 Sprints)..."
                  className="text-xs h-9"
                />
                <div className="flex gap-2">
                  <Input
                    value={newDecisionRationale}
                    onChange={(e) => setNewDecisionRationale(e.target.value)}
                    placeholder="Rationale & context..."
                    className="text-xs h-9 flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddDecision}
                    disabled={!newDecisionTitle.trim()}
                    className="h-9 text-xs font-bold gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Record
                  </Button>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                {decisions.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-border rounded-xl text-xs text-muted-foreground">
                    No governance decisions recorded yet.
                  </div>
                ) : (
                  decisions.map((dec) => (
                    <div
                      key={dec.id}
                      className="p-3 rounded-xl border border-border/70 bg-card/60 flex items-start justify-between gap-2"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">{dec.title}</span>
                          <Badge variant="outline" className="text-[9px] uppercase font-mono px-1.5 py-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                            {dec.status}
                          </Badge>
                        </div>
                        {dec.rationale && (
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{dec.rationale}</p>
                        )}
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(dec.decidedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDecisions((prev) => prev.filter((d) => d.id !== dec.id))}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* TAB 6: ICE PRIORITIZATION SCORING */}
            <TabsContent value="scoring" className="space-y-5 pt-2">
              <div className="flex items-center justify-between pb-3 border-b border-border/40">
                <div>
                  <h3 className="text-xs font-bold text-foreground">ICE Prioritization Framework</h3>
                  <p className="text-[11px] text-muted-foreground">Adjust sliders to calculate live prioritization score.</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-primary">{currentIceScore}</span>
                  <p className="text-[10px] text-muted-foreground">ICE Score</p>
                </div>
              </div>

              {/* Impact Slider (1-10) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Impact (Potential Value)</span>
                  <span className="text-primary">{impact} / 10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={impact}
                  onChange={(e) => setImpact(Number(e.target.value))}
                  className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer"
                />
                <p className="text-[10px] text-muted-foreground">How much will this move revenue, retention, or customer satisfaction?</p>
              </div>

              {/* Effort Slider (1-10) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Effort (Engineering & Operational Complexity)</span>
                  <span className="text-primary">{effort} / 10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={effort}
                  onChange={(e) => setEffort(Number(e.target.value))}
                  className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer"
                />
                <p className="text-[10px] text-muted-foreground">Lower effort yields higher ICE score (1 = 1 day, 10 = multi-month overhaul).</p>
              </div>

              {/* Confidence Slider (1-10) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Confidence (Empirical Certainty)</span>
                  <span className="text-primary">{confidence} / 10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={confidence}
                  onChange={(e) => setConfidence(Number(e.target.value))}
                  className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer"
                />
                <p className="text-[10px] text-muted-foreground">How certain are we that our hypotheses and impact assumptions are true?</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/60 bg-muted/30 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-destructive hover:bg-destructive/10 text-xs font-semibold"
          >
            Delete Idea
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-sm active:scale-[0.98]"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Idea
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
