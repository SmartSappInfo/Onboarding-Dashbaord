'use client';

/**
 * @fileoverview Pre-Meeting Brief Studio & Execution Tab (Phase 6).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills PRD Section 4022 and UI Specification Section 26 & 3148:
 * 1. Pre-meeting briefing preparation studio for upcoming customer calls.
 * 2. Aggregates attendee profiles, previous call takeaways (Phase 5 objections), and strategic talk tracks.
 * 3. Interactive desired outcome checklist for in-meeting progress tracking.
 * 4. 1-Click Launch Meeting and Complete Meeting flow triggering PostMeetingReviewDrawer.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing (zero 'any' or 'any[]').
 * - Touch targets maintain >= 44px height (min-h-[44px]) for mobile accessibility.
 * - Tactile micro-interactions use active:scale-[0.97] (emilkowal-animations).
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Play,
  CheckSquare,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import type { MeetingBrief } from '@/lib/deal-intelligence/types';
import { PostMeetingReviewDrawer } from './PostMeetingReviewDrawer';

interface MeetingBriefTabProps {
  briefs: MeetingBrief[];
  workspaceId: string;
  organizationId: string;
  currentUserId: string;
  currentUserName: string;
  onRefreshData?: () => void;
}

export const MeetingBriefTab: React.FC<MeetingBriefTabProps> = ({
  briefs,
  workspaceId,
  organizationId,
  currentUserId,
  currentUserName,
  onRefreshData,
}) => {
  const [selectedMeetingId, setSelectedMeetingId] = React.useState<string>(
    briefs.length > 0 ? briefs[0].meetingId : ''
  );

  const [activeMeetingBrief, setActiveMeetingBrief] = React.useState<MeetingBrief | null>(
    briefs.length > 0 ? briefs[0] : null
  );

  // Sync selection
  React.useEffect(() => {
    if (selectedMeetingId) {
      const found = briefs.find((b) => b.meetingId === selectedMeetingId) || briefs[0] || null;
      setActiveMeetingBrief(found);
    }
  }, [selectedMeetingId, briefs]);

  // Review Drawer state
  const [isReviewOpen, setIsReviewOpen] = React.useState<boolean>(false);

  // Desired outcome checklist local state
  const [checklist, setChecklist] = React.useState<MeetingBrief['desiredOutcomeChecklist']>(
    activeMeetingBrief?.desiredOutcomeChecklist || []
  );

  React.useEffect(() => {
    if (activeMeetingBrief) {
      setChecklist(activeMeetingBrief.desiredOutcomeChecklist || []);
    }
  }, [activeMeetingBrief]);

  const toggleChecklistItem = (itemId: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, completed: !item.completed } : item))
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Meeting Intelligence Studio
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pre-meeting briefing dossiers with stakeholder context, past objections, and 1-click post-call CRM sync.
          </p>
        </div>
      </div>

      {briefs.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-muted-foreground mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">No upcoming meetings scheduled</h3>
            <p className="text-xs text-muted-foreground">
              Meetings booked through calendar or CRM will appear here automatically with AI pre-briefing dossiers.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Meeting Picker List (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
              Scheduled Briefs ({briefs.length})
            </h3>

            <div className="space-y-2">
              {briefs.map((brief) => {
                const isSelected = brief.meetingId === activeMeetingBrief?.meetingId;
                const scheduledDate = new Date(brief.scheduledAt);

                return (
                  <button
                    key={brief.meetingId}
                    type="button"
                    onClick={() => setSelectedMeetingId(brief.meetingId)}
                    className={`w-full text-left p-4 rounded-lg border transition-all min-h-[44px] ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'bg-card hover:border-border hover:bg-muted/30'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-foreground truncate">
                          {brief.title}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-mono flex-shrink-0">
                          {brief.durationMinutes}m
                        </Badge>
                      </div>

                      <p className="text-xs text-primary font-medium truncate">
                        {brief.accountName || brief.dealName || 'Enterprise Prospect'}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {brief.attendees.length} attendees
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Pre-Meeting Dossier Studio (8 cols) */}
          {activeMeetingBrief && (
            <Card className="lg:col-span-8 p-6 space-y-6">
              {/* Studio Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-foreground">
                      {activeMeetingBrief.title}
                    </h3>
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                      {activeMeetingBrief.durationMinutes} Minutes
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Opportunity: <span className="font-semibold text-foreground">{activeMeetingBrief.dealName}</span> • Account: <span className="font-semibold text-foreground">{activeMeetingBrief.accountName}</span>
                  </p>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] active:scale-[0.97] text-xs font-semibold"
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                    Start Meeting
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setIsReviewOpen(true)}
                    className="min-h-[44px] active:scale-[0.97] text-xs font-semibold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Complete & Review (+20 pts)
                  </Button>
                </div>
              </div>

              {/* Attendees Roster */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-primary" />
                  Key Attendees & Sentiment
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeMeetingBrief.attendees.map((att) => (
                    <div key={att.contactId} className="rounded-lg border p-3 bg-muted/20 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{att.name}</span>
                        {att.role && (
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {att.role.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{att.title}</p>
                      {att.recentNotes && (
                        <p className="text-[11px] text-muted-foreground/90 italic pt-1 border-t mt-1">
                          &ldquo;{att.recentNotes}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Previous Call Takeaways & Objections */}
              {activeMeetingBrief.previousCallTakeaways.length > 0 && (
                <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                  <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Open Objections & Insights from Previous Calls (Phase 5)
                  </h4>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    {activeMeetingBrief.previousCallTakeaways.map((takeaway, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-500 font-bold">•</span>
                        <span>{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Strategic Talk Track */}
              <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Strategic Talk Track Tailored to Decision-Maker
                </h4>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  {activeMeetingBrief.strategicTalkTrack.map((track, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <ArrowRight className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                      <span>{track}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommended Probing Questions */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-primary" />
                  Recommended Discovery Questions
                </h4>
                <div className="space-y-1.5">
                  {activeMeetingBrief.recommendedQuestions.map((q, idx) => (
                    <div key={idx} className="p-3 rounded-lg border bg-muted/20 text-xs font-medium text-foreground">
                      {q}
                    </div>
                  ))}
                </div>
              </div>

              {/* Desired Outcome Checklist */}
              <div className="space-y-3 pt-2 border-t">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-emerald-500" />
                  Desired Meeting Outcomes (Check off during call)
                </h4>
                <div className="space-y-2">
                  {checklist.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/20 cursor-pointer min-h-[44px]"
                    >
                      <Checkbox
                        checked={item.completed}
                        onCheckedChange={() => toggleChecklistItem(item.id)}
                      />
                      <span
                        className={`text-xs font-medium ${
                          item.completed ? 'line-through text-muted-foreground' : 'text-foreground'
                        }`}
                      >
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Post-Meeting Review Drawer Modal */}
      <PostMeetingReviewDrawer
        meeting={activeMeetingBrief}
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        workspaceId={workspaceId}
        organizationId={organizationId}
        repId={currentUserId}
        repName={currentUserName}
        onSuccess={onRefreshData}
      />
    </div>
  );
};
