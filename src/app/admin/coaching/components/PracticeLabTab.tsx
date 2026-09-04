'use client';

/**
 * @fileoverview Interactive AI Buyer Sales Practice Lab Simulator (Phase 5).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills PRD Section 41 & UI Specification Section 33:
 * 1. Scenario Catalog: 6 canonical objection scenarios (Pricing Pushback, Competitor Threat, etc.).
 * 2. Interactive Roleplay Simulator: Conversational turn-taking with AI Buyer persona.
 * 3. Deadlock & Loop Guard: Hard turn limit (<= 6 turns) prevents infinite dialogues.
 * 4. Multi-Pillar Competency Evaluation: Scores Discovery, Question Quality, Objection Handling,
 *    Active Listening, and Closing upon drill completion.
 * 5. Instant Effort Points: Awards +25 points via Phase 1 Engine and recommends weakest-skill next drill.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strictly typed (zero 'any' or 'any[]').
 * - Touch targets maintain >= 44px height (min-h-[44px]) for mobile accessibility.
 * - Tactile micro-interactions use active:scale-[0.97] (emilkowal-animations).
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles,
  Play,
  RotateCcw,
  Send,
  Loader2,
  CheckCircle2,
  ArrowRight,
  User,
  Bot,
  Zap,
} from 'lucide-react';
import type {
  PracticeLabScenario,
  RoleplaySession,
} from '@/lib/conversation-coaching/types';
import {
  startRoleplaySessionAction,
  submitRoleplayTurnAction,
} from '@/app/actions/conversation-coaching-actions';

interface PracticeLabTabProps {
  workspaceId: string;
  organizationId: string;
  scenarios: PracticeLabScenario[];
  activeScenarioId?: string;
  repId: string;
  repName: string;
  onDrillCompleted?: (scenarioId: string, score: number) => void;
}

export const PracticeLabTab: React.FC<PracticeLabTabProps> = ({
  workspaceId,
  organizationId,
  scenarios,
  activeScenarioId,
  repId,
  repName,
  onDrillCompleted,
}) => {
  const { toast } = useToast();
  const [selectedScenarioId, setSelectedScenarioId] = React.useState<string>(
    activeScenarioId || scenarios[0]?.id || ''
  );

  const [session, setSession] = React.useState<RoleplaySession | null>(null);
  const [repMessage, setRepMessage] = React.useState<string>('');
  const [isStarting, setIsStarting] = React.useState<boolean>(false);
  const [isSubmittingTurn, setIsSubmittingTurn] = React.useState<boolean>(false);
  const dialogueEndRef = React.useRef<HTMLDivElement>(null);

  const activeScenario = scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0];

  // Auto-scroll dialogue on new turn
  React.useEffect(() => {
    if (dialogueEndRef.current) {
      dialogueEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session?.dialogue]);

  // Update selectedScenarioId if activeScenarioId prop changes
  React.useEffect(() => {
    if (activeScenarioId) {
      setSelectedScenarioId(activeScenarioId);
    }
  }, [activeScenarioId]);

  const handleStartSession = async (scenarioToStart?: PracticeLabScenario) => {
    const target = scenarioToStart || activeScenario;
    if (!target) return;

    try {
      setIsStarting(true);
      const res = await startRoleplaySessionAction({
        workspaceId,
        organizationId,
        repId,
        repName,
        scenarioId: target.id,
      });

      if (!res.success || !res.session) {
        throw new Error(res.error || 'Failed to start practice session');
      }

      setSession(res.session);
      setSelectedScenarioId(target.id);
      setRepMessage('');
      toast({
        title: 'Practice Lab Started',
        description: `Now roleplaying with ${target.buyerPersona.name} (${target.buyerPersona.title}).`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: 'Error Starting Session',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleSendTurn = async () => {
    if (!session || !repMessage.trim() || isSubmittingTurn) return;

    try {
      setIsSubmittingTurn(true);
      const userText = repMessage.trim();
      setRepMessage('');

      const res = await submitRoleplayTurnAction({
        workspaceId,
        organizationId,
        sessionId: session.id,
        repMessage: userText,
      });

      if (!res.success || !res.session) {
        throw new Error(res.error || 'Failed to submit response turn');
      }

      setSession(res.session);

      if (res.isCompleted && res.evaluation) {
        toast({
          title: 'Drill Completed!',
          description: `Score: ${res.evaluation.overallScore}%. +${res.pointsAwarded || 25} effort points awarded.`,
        });
        if (onDrillCompleted) {
          onDrillCompleted(session.scenarioId, res.evaluation.overallScore);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: 'Error Processing Turn',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingTurn(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-foreground">Interactive Practice Lab</h3>
            <Badge className="bg-primary text-primary-foreground font-semibold text-xs">
              <Zap className="w-3.5 h-3.5 mr-1" />
              AI Buyer Simulator
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Hone your objection handling and value selling against realistic buyer personas. +25 effort points per drill.
          </p>
        </div>

        {session && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleStartSession()}
            className="min-h-[44px] active:scale-[0.97] text-xs font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Restart Drill
          </Button>
        )}
      </div>

      {!session ? (
        /* 2. Scenario Catalog View */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground">Select an Objection Scenario</h4>
            <span className="text-xs text-muted-foreground">{scenarios.length} Scenarios Available</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenarios.map((scen) => (
              <Card
                key={scen.id}
                className="p-5 flex flex-col justify-between hover:border-primary/50 transition-all duration-150 space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {scen.category}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] font-mono capitalize ${
                        scen.difficulty === 'advanced'
                          ? 'text-rose-600 bg-rose-500/10'
                          : scen.difficulty === 'intermediate'
                          ? 'text-amber-600 bg-amber-500/10'
                          : 'text-emerald-600 bg-emerald-500/10'
                      }`}
                    >
                      {scen.difficulty}
                    </Badge>
                  </div>

                  <div>
                    <h5 className="text-base font-bold text-foreground">{scen.title}</h5>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{scen.description}</p>
                  </div>

                  <div className="rounded-lg bg-muted/30 p-3 border text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                      {scen.buyerPersona.name} • {scen.buyerPersona.title}
                    </div>
                    <p className="text-[11px] text-muted-foreground italic">
                      Tone: {scen.buyerPersona.tone} • &quot;{scen.initialPrompt.slice(0, 75)}...&quot;
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => handleStartSession(scen)}
                  disabled={isStarting}
                  className="w-full min-h-[44px] active:scale-[0.97] transition-all duration-150 font-semibold"
                >
                  <Play className="w-4 h-4 mr-2 fill-current" />
                  Launch Simulator
                </Button>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        /* 3. Active Simulator Dialogue & Evaluation View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Conversational Dialogue Area (8 Cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Buyer Persona Bar */}
            <Card className="p-4 bg-muted/20 border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-foreground">{activeScenario.buyerPersona.name}</h4>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {activeScenario.buyerPersona.tone} Tone
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {activeScenario.buyerPersona.title} • {activeScenario.buyerPersona.companyType}
                  </p>
                </div>
              </div>

              <div className="text-right text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Turns:</span> {session.dialogue.length} / 6
              </div>
            </Card>

            {/* Scrollable Dialogue Flow */}
            <Card className="p-5 min-h-[420px] max-h-[520px] overflow-y-auto space-y-4">
              {session.dialogue.map((turn) => {
                const isBuyer = turn.speaker === 'ai_buyer' || turn.speaker === 'buyer';
                const tipText = turn.coachingTip || turn.turnFeedback?.quickTip;

                return (
                  <div
                    key={turn.id}
                    className={`flex flex-col ${isBuyer ? 'items-start' : 'items-end'} space-y-1`}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-1">
                      {isBuyer ? (
                        <>
                          <Bot className="w-3 h-3 text-primary" />
                          <span className="font-semibold">{activeScenario.buyerPersona.name}</span>
                        </>
                      ) : (
                        <>
                          <span className="font-semibold">{repName}</span>
                          <User className="w-3 h-3 text-foreground" />
                        </>
                      )}
                    </div>

                    <div
                      className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed shadow-sm ${
                        isBuyer
                          ? 'bg-muted/40 text-foreground border rounded-tl-sm'
                          : 'bg-primary text-primary-foreground rounded-tr-sm font-medium'
                      }`}
                    >
                      {turn.text || turn.message || ''}
                    </div>

                    {tipText && (
                      <div className="text-[11px] text-muted-foreground bg-amber-500/10 border border-amber-300/40 rounded-md p-2 max-w-[80%] flex items-start gap-1.5 mt-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>{tipText}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={dialogueEndRef} />
            </Card>

            {/* Seller Input Box (Active if in_progress) */}
            {session.status === 'in_progress' ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Textarea
                    value={repMessage}
                    onChange={(e) => setRepMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendTurn();
                      }
                    }}
                    placeholder="Type your response to the buyer (e.g. acknowledge, ask clarifying question, frame value)..."
                    rows={2}
                    className="text-xs resize-none min-h-[44px]"
                  />
                  <Button
                    disabled={isSubmittingTurn || !repMessage.trim()}
                    onClick={handleSendTurn}
                    className="min-h-[44px] min-w-[50px] px-4 active:scale-[0.97] transition-all"
                  >
                    {isSubmittingTurn ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <div className="flex justify-between items-center text-[11px] text-muted-foreground px-1">
                  <span>Press Enter to send, Shift + Enter for new line.</span>
                  <span className="font-mono">{session.dialogue.length >= 5 ? 'Final Turn' : `${6 - session.dialogue.length} turns remaining`}</span>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border bg-emerald-500/10 border-emerald-300 p-4 text-center space-y-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                <h5 className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Drill Completed</h5>
                <p className="text-xs text-muted-foreground">
                  The session has concluded. Check your competency scorecard on the right.
                </p>
                <Button
                  size="sm"
                  onClick={() => setSession(null)}
                  className="min-h-[44px] active:scale-[0.97] text-xs font-semibold"
                >
                  Choose Another Drill
                </Button>
              </div>
            )}
          </div>

          {/* Right Column: Real-Time Scorecard & Weakness Remediation (4 Cols) */}
          <div className="lg:col-span-4 space-y-4">
            {session.evaluation ? (
              <Card className="p-5 space-y-4 border-primary/30 shadow-md">
                <div className="border-b pb-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-primary text-primary-foreground font-bold text-xs">
                      Drill Scorecard
                    </Badge>
                    <span className="text-2xl font-black text-primary font-mono">
                      {session.evaluation.overallScore}%
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-foreground">Competency Evaluation</h4>
                </div>

                {/* 5-Pillar Score List */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discovery Probing</span>
                    <span className="font-mono font-bold text-foreground">{session.evaluation.discoveryScore}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Question Quality</span>
                    <span className="font-mono font-bold text-foreground">{session.evaluation.questionQualityScore}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Objection Handling</span>
                    <span className="font-mono font-bold text-foreground">{session.evaluation.objectionHandlingScore}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Active Listening</span>
                    <span className="font-mono font-bold text-foreground">{session.evaluation.listeningScore}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Closing & Commitment</span>
                    <span className="font-mono font-bold text-foreground">{session.evaluation.closingScore}%</span>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/40 p-3 border text-xs space-y-1.5">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-primary" /> AI Coaching Takeaway:
                  </span>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    {session.evaluation.coachingFeedback}
                  </p>
                </div>

                {session.evaluation.nextRecommendedScenarioId && (
                  <div className="pt-2 border-t space-y-2">
                    <span className="text-xs font-semibold text-foreground">Recommended Next Drill:</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const rec = scenarios.find((s) => s.id === session.evaluation?.nextRecommendedScenarioId);
                        if (rec) handleStartSession(rec);
                      }}
                      className="w-full min-h-[44px] active:scale-[0.97] text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      Launch Weak-Skill Drill
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="p-5 space-y-3 bg-muted/20 border">
                <h4 className="text-sm font-bold text-foreground border-b pb-2">Target Competencies</h4>
                <div className="space-y-2 text-xs text-muted-foreground">
                  {activeScenario.expectedCompetencies.map((comp, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <span>{comp}</span>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg bg-card p-3 border text-xs space-y-1 mt-4">
                  <span className="font-semibold text-foreground">Pro-Tip for this Persona:</span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Acknowledge the buyer&apos;s budget or timing constraints without conceding immediately. Ask open
                    clarification questions to isolate the root objection.
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
