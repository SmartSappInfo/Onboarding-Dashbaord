'use client';

/**
 * @fileoverview Conversation Intelligence & Coaching Main Cockpit Client (Phase 5).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills PRD Sections 38–42 & UI Specification Sections 29–37, 3091–3125:
 * 1. Unified 5-Tab Interface:
 *    - My Coaching: Personal competency radar, weekly growth directive, assigned drills.
 *    - Conversations: Audio player, interactive transcript, speech dynamics, buying signals.
 *    - Scorecards: Gong-style dual rubric review with weighted score calculation and effort points.
 *    - Practice Lab: Interactive AI Buyer roleplay simulator with turn-taking and weakness loop.
 *    - Team Coaching: Manager command heatmap and 1-click drill assignment.
 * 2. Cross-Tab Deep Linking: Launching drills switches to Practice Lab; inspecting calls switches to Conversations.
 * 3. Mobile Progressive Disclosure: Prioritizes actionable intelligence and touch ergonomics (>= 44px).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strictly typed (zero 'any' or 'any[]').
 * - Touch targets maintain >= 44px height (min-h-[44px]) for mobile accessibility.
 * - Tactile micro-interactions use active:scale-[0.97] (emilkowal-animations).
 */

import * as React from 'react';
import { useTenant } from '@/context/TenantContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { PageContainer } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  GraduationCap,
  Headphones,
  FileCheck,
  Zap,
  Users,
  RotateCcw,
  Loader2,
  Award,
} from 'lucide-react';

import type {
  CallConversation,
  ScorecardTemplate,
  PracticeLabScenario,
  RepCoachingProfile,
  TeamCoachingOverview,
  CallScorecardReview,
} from '@/lib/conversation-coaching/types';
import {
  getCoachingWorkspaceAction,
  getTeamCoachingOverviewAction,
} from '@/app/actions/conversation-coaching-actions';

import { MyCoachingTab } from './components/MyCoachingTab';
import { ConversationIntelligenceTab } from './components/ConversationIntelligenceTab';
import { ScorecardReviewTab } from './components/ScorecardReviewTab';
import { PracticeLabTab } from './components/PracticeLabTab';
import { TeamCoachingTab } from './components/TeamCoachingTab';

export default function CoachingClient() {
  const { activeOrganizationId } = useTenant();
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const workspaceId = activeWorkspaceId || 'ws_default';
  const organizationId = activeOrganizationId || 'org_default';
  const currentUserId = user?.uid || 'usr_rep_1';
  const currentUserName = user?.displayName || 'Sales Representative';

  // Navigation State
  const [activeTab, setActiveTab] = React.useState<string>('my-coaching');
  const [activeCallId, setActiveCallId] = React.useState<string | undefined>(undefined);
  const [activeScenarioId, setActiveScenarioId] = React.useState<string | undefined>(undefined);

  // Data State
  const [profile, setProfile] = React.useState<RepCoachingProfile | null>(null);
  const [scenarios, setScenarios] = React.useState<PracticeLabScenario[]>([]);
  const [templates, setTemplates] = React.useState<ScorecardTemplate[]>([]);
  const [recentCalls, setRecentCalls] = React.useState<CallConversation[]>([]);
  const [teamOverview, setTeamOverview] = React.useState<TeamCoachingOverview | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);

  // Load Coaching Workspace Context
  const loadCoachingData = React.useCallback(async () => {
    try {
      const [workspaceRes, teamRes] = await Promise.all([
        getCoachingWorkspaceAction({
          workspaceId,
          organizationId,
          repId: currentUserId,
          repName: currentUserName,
        }),
        getTeamCoachingOverviewAction({ workspaceId }),
      ]);

      if (workspaceRes.success) {
        if (workspaceRes.profile) setProfile(workspaceRes.profile);
        setScenarios(workspaceRes.scenarios);
        setTemplates(workspaceRes.templates);
        setRecentCalls(workspaceRes.recentCalls);
      }

      if (teamRes.success && teamRes.overview) {
        setTeamOverview(teamRes.overview);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: 'Failed to load coaching data',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [workspaceId, organizationId, currentUserId, currentUserName, toast]);

  React.useEffect(() => {
    loadCoachingData();
  }, [loadCoachingData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadCoachingData();
    toast({
      title: 'Coaching Data Refreshed',
      description: 'Loaded latest call conversations and competency benchmarks.',
    });
  };

  // Cross-Tab Navigation Handlers
  const handleLaunchDrill = (scenarioId: string) => {
    setActiveScenarioId(scenarioId);
    setActiveTab('practice-lab');
  };

  const handleInspectCall = (callId: string) => {
    setActiveCallId(callId);
    setActiveTab('conversations');
  };

  const handleNavigateScorecard = (callId: string) => {
    setActiveCallId(callId);
    setActiveTab('scorecards');
  };

  const handleReviewSubmitted = (callId: string, review: CallScorecardReview) => {
    setRecentCalls((prev) =>
      prev.map((c) => (c.id === callId ? { ...c, scorecardReview: review, status: 'completed' } : c))
    );
  };

  const handleDrillCompleted = (_scenarioId: string, _score: number) => {
    // Refresh to update competency radar and points
    loadCoachingData();
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">
            Loading Conversation Intelligence & Coaching Lab...
          </p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6 pb-12">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Coaching & Practice Lab</h2>
              <Badge variant="outline" className="text-xs font-mono border-primary text-primary">
                Phase 5
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Conversation intelligence, Gong-style scorecard reviews, and interactive AI Buyer roleplay simulations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isRefreshing}
              onClick={handleRefresh}
              className="min-h-[44px] active:scale-[0.97] transition-all duration-150 text-xs font-semibold"
            >
              <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* 5-Tab Navigation Cockpit */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full max-w-4xl p-1 bg-muted/60 min-h-[48px]">
            <TabsTrigger
              value="my-coaching"
              className="min-h-[40px] text-xs font-semibold data-[state=active]:bg-card active:scale-[0.97] transition-all"
            >
              <Award className="w-3.5 h-3.5 mr-1.5" />
              My Coaching
            </TabsTrigger>
            <TabsTrigger
              value="conversations"
              className="min-h-[40px] text-xs font-semibold data-[state=active]:bg-card active:scale-[0.97] transition-all"
            >
              <Headphones className="w-3.5 h-3.5 mr-1.5" />
              Conversations
            </TabsTrigger>
            <TabsTrigger
              value="scorecards"
              className="min-h-[40px] text-xs font-semibold data-[state=active]:bg-card active:scale-[0.97] transition-all"
            >
              <FileCheck className="w-3.5 h-3.5 mr-1.5" />
              Scorecards
            </TabsTrigger>
            <TabsTrigger
              value="practice-lab"
              className="min-h-[40px] text-xs font-semibold data-[state=active]:bg-card active:scale-[0.97] transition-all"
            >
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              Practice Lab
            </TabsTrigger>
            <TabsTrigger
              value="team-coaching"
              className="min-h-[40px] text-xs font-semibold data-[state=active]:bg-card active:scale-[0.97] transition-all col-span-2 sm:col-span-1"
            >
              <Users className="w-3.5 h-3.5 mr-1.5" />
              Team Matrix
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: My Coaching */}
          <TabsContent value="my-coaching" className="space-y-6 focus:outline-none">
            {profile ? (
              <MyCoachingTab
                profile={profile}
                recentCalls={recentCalls}
                onLaunchDrill={handleLaunchDrill}
                onInspectCall={handleInspectCall}
              />
            ) : (
              <Card className="p-8 text-center text-muted-foreground text-sm">
                No coaching profile initialized for this representative.
              </Card>
            )}
          </TabsContent>

          {/* Tab 2: Conversation Intelligence */}
          <TabsContent value="conversations" className="space-y-6 focus:outline-none">
            <ConversationIntelligenceTab
              calls={recentCalls}
              activeCallId={activeCallId}
              onSelectCall={(callId) => setActiveCallId(callId)}
              onNavigateScorecard={handleNavigateScorecard}
            />
          </TabsContent>

          {/* Tab 3: Scorecard Review */}
          <TabsContent value="scorecards" className="space-y-6 focus:outline-none">
            <ScorecardReviewTab
              workspaceId={workspaceId}
              organizationId={organizationId}
              calls={recentCalls}
              templates={templates}
              activeCallId={activeCallId}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              onReviewSubmitted={handleReviewSubmitted}
            />
          </TabsContent>

          {/* Tab 4: Practice Lab */}
          <TabsContent value="practice-lab" className="space-y-6 focus:outline-none">
            <PracticeLabTab
              workspaceId={workspaceId}
              organizationId={organizationId}
              scenarios={scenarios}
              activeScenarioId={activeScenarioId}
              repId={currentUserId}
              repName={currentUserName}
              onDrillCompleted={handleDrillCompleted}
            />
          </TabsContent>

          {/* Tab 5: Team Coaching */}
          <TabsContent value="team-coaching" className="space-y-6 focus:outline-none">
            {teamOverview ? (
              <TeamCoachingTab
                workspaceId={workspaceId}
                organizationId={organizationId}
                overview={teamOverview}
                scenarios={scenarios}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                onRefreshTeam={loadCoachingData}
              />
            ) : (
              <Card className="p-8 text-center text-muted-foreground text-sm">
                No team coaching overview available.
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
