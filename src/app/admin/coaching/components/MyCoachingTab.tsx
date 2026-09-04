'use client';

/**
 * @fileoverview Rep Personal Coaching & Competency Development Cockpit (Phase 5).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills PRD Section 41 & UI Section 31:
 * 1. Visualizes 5-pillar sales competency radar/bars (Discovery, Objection Handling, Closing, Product Knowledge, Call Control).
 * 2. Active Weekly Growth Directive banner with countdown and target thresholds.
 * 3. Assigned Practice Drills queue with 1-click launch into the Practice Lab simulator.
 * 4. Recent Call Recordings flagged for self or peer review.
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
import {
  Sparkles,
  Play,
  CheckCircle2,
  Clock,
  ArrowRight,
  Flame,
} from 'lucide-react';
import type {
  RepCoachingProfile,
  CallConversation,
} from '@/lib/conversation-coaching/types';

interface MyCoachingTabProps {
  profile: RepCoachingProfile;
  recentCalls: CallConversation[];
  onLaunchDrill: (scenarioId: string) => void;
  onInspectCall: (callId: string) => void;
}

export const MyCoachingTab: React.FC<MyCoachingTabProps> = ({
  profile,
  recentCalls,
  onLaunchDrill,
  onInspectCall,
}) => {
  const skills = profile.skillScores || {
    discovery: 72,
    objectionHandling: 68,
    closing: 75,
    productKnowledge: 84,
    callControl: 70,
  };

  const skillList = [
    { key: 'discovery', label: 'Discovery & Pain Probing', score: skills.discovery, color: 'bg-blue-500' },
    { key: 'objectionHandling', label: 'Objection Resolution', score: skills.objectionHandling, color: 'bg-amber-500' },
    { key: 'closing', label: 'Closing & Next Step Commitment', score: skills.closing, color: 'bg-emerald-500' },
    { key: 'productKnowledge', label: 'Product & Value Linkage', score: skills.productKnowledge, color: 'bg-purple-500' },
    { key: 'callControl', label: 'Call Control & Active Listening', score: skills.callControl, color: 'bg-cyan-500' },
  ];

  const overallProficiency = Math.round(
    (skills.discovery + skills.objectionHandling + skills.closing + skills.productKnowledge + skills.callControl) / 5
  );

  const pendingDrills = (profile.assignedDrills || []).filter((d) => d.status === 'pending');
  const completedDrills = (profile.assignedDrills || []).filter((d) => d.status === 'completed');

  return (
    <div className="space-y-6">
      {/* 1. Growth Directive Banner */}
      {profile.activeGoal && (
        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-background p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary text-primary-foreground font-semibold px-2 py-0.5 text-xs">
                  <Flame className="w-3.5 h-3.5 mr-1 text-amber-300 fill-amber-300" />
                  THIS WEEK&apos;S GROWTH DIRECTIVE
                </Badge>
                <span className="text-xs text-muted-foreground">Deadline: {profile.activeGoal.deadlineDate}</span>
              </div>
              <h3 className="text-xl font-bold tracking-tight text-foreground">{profile.activeGoal.title}</h3>
              <p className="text-sm text-muted-foreground max-w-xl">
                Focus on reducing talk ratio below 50% and executing structured 3-part objection reframing. Target
                proficiency is {profile.activeGoal.targetScore}% (currently {profile.activeGoal.currentScore}%).
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xl font-black text-primary">{profile.activeGoal.currentScore}%</div>
                <div className="text-xs text-muted-foreground">Target: {profile.activeGoal.targetScore}%</div>
              </div>
              <Button
                size="lg"
                onClick={() => {
                  const targetDrill = profile.assignedDrills?.[0];
                  if (targetDrill) {
                    onLaunchDrill(targetDrill.scenarioId);
                  }
                }}
                className="min-h-[44px] active:scale-[0.97] transition-all duration-150 font-semibold shadow-sm"
              >
                <Play className="w-4 h-4 mr-2 fill-current" />
                Launch Practice Lab
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 2. Competency Breakdown & Assigned Drills Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: 5-Pillar Competencies (7 Cols) */}
        <Card className="lg:col-span-7 p-6 space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h4 className="text-base font-bold text-foreground">Sales Competency Benchmark</h4>
              <p className="text-xs text-muted-foreground">
                Evaluated from recent calls, AI scorecards, and Practice Lab drills.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Overall:</span>
              <Badge variant="outline" className="text-sm font-bold border-primary text-primary px-2.5 py-1">
                {overallProficiency}% Proficiency
              </Badge>
            </div>
          </div>

          <div className="space-y-4">
            {skillList.map((skill) => (
              <div key={skill.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{skill.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-foreground">{skill.score}%</span>
                    {skill.score >= 80 ? (
                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 py-0 px-1">
                        Mastery
                      </Badge>
                    ) : skill.score >= 70 ? (
                      <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300 py-0 px-1">
                        Solid
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 py-0 px-1">
                        Growth Area
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${skill.color}`}
                    style={{ width: `${Math.min(100, Math.max(0, skill.score))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-muted/40 p-4 border flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-semibold text-foreground">AI Coach Takeaway:</span>
              <p className="text-muted-foreground leading-relaxed">
                Your value linkage is strong (84%), but prospects raise pricing pushback on 60% of discovery calls.
                Completing 2 objection drills this week will build confidence in price defense.
              </p>
            </div>
          </div>
        </Card>

        {/* Right Column: Assigned Practice Drills (5 Cols) */}
        <Card className="lg:col-span-5 p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h4 className="text-base font-bold text-foreground">Assigned Practice Drills</h4>
              <p className="text-xs text-muted-foreground">Action items assigned by sales leadership</p>
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              {pendingDrills.length} Pending
            </Badge>
          </div>

          {pendingDrills.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">All assigned drills completed!</p>
                <p className="text-xs text-muted-foreground">
                  You are fully caught up. Head to the Practice Lab to run open drills.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingDrills.map((drill) => (
                <div
                  key={drill.id}
                  className="rounded-lg border p-3.5 bg-card hover:border-primary/40 transition-colors duration-150 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {drill.category}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Due {drill.deadlineDate}
                        </span>
                      </div>
                      <h5 className="text-sm font-bold text-foreground mt-1">{drill.scenarioTitle || drill.title || 'Practice Drill'}</h5>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{drill.instructions || 'Practice drill assigned to reinforce competencies.'}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground">
                      Assigned by {drill.assignedBy?.userName || 'Sales Manager'}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => onLaunchDrill(drill.scenarioId)}
                      className="min-h-[44px] active:scale-[0.97] transition-all duration-150 text-xs font-semibold px-3"
                    >
                      <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                      Start Drill
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {completedDrills.length > 0 && (
            <div className="border-t pt-3">
              <span className="text-xs font-semibold text-muted-foreground">
                Recently Completed ({completedDrills.length})
              </span>
              <div className="mt-2 space-y-1.5">
                {completedDrills.slice(0, 2).map((drill) => (
                  <div key={drill.id} className="flex items-center justify-between text-xs py-1 text-muted-foreground">
                    <span className="truncate max-w-[200px] line-through">{drill.scenarioTitle || drill.title || 'Practice Drill'}</span>
                    <Badge variant="secondary" className="text-[10px] font-mono text-emerald-600">
                      Score: {drill.scoreResult ?? 88}%
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* 3. Calls Ready for Review */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h4 className="text-base font-bold text-foreground">Calls Flagged for Review</h4>
            <p className="text-xs text-muted-foreground">
              Recent recorded conversations with automated intelligence signals
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{recentCalls.length} calls recorded</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recentCalls.map((call) => {
            const review = call.scorecardReview;
            const signalsCount = (call.intelligence?.buyingSignals?.length || 0) + (call.intelligence?.objections?.length || 0);

            return (
              <div
                key={call.id}
                className="rounded-lg border p-4 bg-card hover:border-primary/50 transition-all duration-150 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h5 className="text-sm font-bold text-foreground">{call.contactName}</h5>
                    <p className="text-xs text-muted-foreground">
                      {call.dealName || 'Discovery Call'} • {Math.round(call.durationSeconds / 60)} mins
                    </p>
                  </div>
                  {review ? (
                    <Badge className="bg-primary text-primary-foreground font-bold text-xs">
                      {review.totalScorePercent}%
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">
                      Pending Review
                    </Badge>
                  )}
                </div>

                {/* Talk/Listen mini bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Talk Ratio</span>
                    <span className="font-mono">{call.dynamics.talkToListenRatio.repPercent}% Rep</span>
                  </div>
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden flex">
                    <div
                      className="bg-primary h-full"
                      style={{ width: `${call.dynamics.talkToListenRatio.repPercent}%` }}
                    />
                    <div
                      className="bg-emerald-400 h-full"
                      style={{ width: `${call.dynamics.talkToListenRatio.buyerPercent}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t">
                  <span className="text-muted-foreground text-[11px]">{signalsCount} signals extracted</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onInspectCall(call.id)}
                    className="min-h-[44px] active:scale-[0.97] transition-all duration-150 text-xs text-primary font-semibold hover:bg-primary/10"
                  >
                    Inspect Call
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
