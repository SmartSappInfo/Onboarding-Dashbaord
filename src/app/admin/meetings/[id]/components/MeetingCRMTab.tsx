'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  UserCheck,
  Building2,
  TrendingUp,
  DollarSign,
  History,
  Tag,
  Plus,
  ExternalLink,
  Mail,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { TagSelector } from '@/components/tags/TagSelector';
import {
  getMeetingCRMContextAction,
  associateMeetingDealAction,
} from '@/app/actions/meeting-crm-actions';
import type { CRMContactContext } from '@/lib/meetings/types/crm-attribution';
import { format } from 'date-fns';

interface MeetingCRMTabProps {
  meetingId: string;
  contactEmail?: string;
  contactName?: string;
}

export function MeetingCRMTab({ meetingId, contactEmail, contactName }: MeetingCRMTabProps) {
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [context, setContext] = React.useState<CRMContactContext | null>(null);
  const [currentTags, setCurrentTags] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchContext = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const res = await getMeetingCRMContextAction(activeWorkspaceId, contactEmail);
      if (res.success && res.context) {
        setContext(res.context);
        setCurrentTags(res.context.tags || []);
      }
    } catch (err) {
      console.warn('[fetch CRM context]', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, contactEmail]);

  React.useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  if (isLoading) {
    return (
      <div className="space-y-4 pt-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    );
  }

  if (!context) {
    return (
      <Card className="rounded-2xl border-dashed p-8 text-center text-xs text-muted-foreground mt-4">
        No CRM contact record linked to this meeting.
      </Card>
    );
  }

  return (
    <div className="space-y-6 pt-4 text-xs">
      {/* Contact & Lead Score Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contact Info Card */}
        <Card className="rounded-2xl border shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground">Contact Details</span>
            <UserCheck className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h4 className="text-base font-bold text-foreground">{context.contactName}</h4>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Mail className="h-3 w-3" />
              {context.contactEmail || 'No email provided'}
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Badge variant="secondary" className="text-[10px] font-semibold">
              <Building2 className="h-3 w-3 mr-1" />
              {context.organizationName}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-semibold">
              {context.stageBadge}
            </Badge>
          </div>
        </Card>

        {/* Lead Score Card */}
        <Card className="rounded-2xl border shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground">Engagement Lead Score</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground flex items-center gap-1.5">
              {context.currentLeadScore}
              <span className="text-xs text-emerald-500 font-semibold">↑ High Intent</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Computed from bookings, attendance durations, and AI sentiment
            </p>
          </div>
        </Card>

        {/* Associated Pipeline Deals */}
        <Card className="rounded-2xl border shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground">Associated Deals</span>
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">
              {context.associatedDeals.reduce((sum, d) => sum + d.dealValue, 0).toLocaleString()} USD
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {context.associatedDeals.length} active CRM deals in pipeline
            </p>
          </div>
        </Card>
      </div>

      {/* CRM Tags (Using TagSelector SSOT) */}
      <Card className="rounded-2xl border shadow-sm p-4 space-y-2">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Tag className="h-4 w-4 text-primary" />
          Contact Tags & Segmentation
        </div>
        <TagSelector
          currentTagIds={currentTags}
          onTagsChange={newTags => {
            setCurrentTags(newTags);
            toast({ title: 'Contact tags updated' });
          }}
        />
      </Card>

      {/* Previous Interactions Timeline */}
      <Card className="rounded-2xl border shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <History className="h-4 w-4 text-primary" />
          Previous CRM Interactions & Activities
        </div>

        <div className="space-y-2">
          {context.previousInteractions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No previous CRM activity recorded for this contact.
            </p>
          ) : (
            context.previousInteractions.map((act, i) => (
              <div
                key={i}
                className="p-3 rounded-xl border bg-muted/20 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <span className="font-bold text-foreground block">{act.title}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(act.occurredAt), 'EEE, MMM d, p')}
                  </span>
                </div>
                <Badge variant="outline" className="text-[9px] uppercase">
                  {act.type}
                </Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
