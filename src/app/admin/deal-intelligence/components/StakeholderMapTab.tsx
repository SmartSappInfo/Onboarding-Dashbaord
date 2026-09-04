'use client';

/**
 * @fileoverview Stakeholder Map & Power Matrix Tab (Phase 6).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills PRD Section 4019 and UI Specification Section 3146:
 * 1. Visual organizational power matrix (Economic Buyer, Champion, Evaluator, Blocker, Gatekeeper).
 * 2. Multi-threading score meter ($0–100$) and single-threaded risk alerts.
 * 3. Interactive "Add Stakeholder" modal allowing reps to assign roles, sentiment, and re-evaluate deal multi-threading.
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
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  ShieldAlert,
  Plus,
  Mail,
  Phone,
  Crown,
  HeartHandshake,
  Shield,
  HelpCircle,
  AlertOctagon,
  Loader2,
} from 'lucide-react';
import type {
  StakeholderMap,
  StakeholderPerson,
  StakeholderRole,
  StakeholderSentiment,
  DealHealthScorecard,
} from '@/lib/deal-intelligence/types';
import { saveStakeholderMapAction, getDealHealthDetailAction } from '@/app/actions/deal-intelligence-actions';
import { evaluateStakeholderMultiThreading } from '@/lib/deal-intelligence/deal-intelligence-engine';

interface StakeholderMapTabProps {
  scorecards: DealHealthScorecard[];
  selectedDealId?: string;
  workspaceId: string;
  organizationId: string;
  currentUserId: string;
  onRefreshData?: () => void;
}

export const StakeholderMapTab: React.FC<StakeholderMapTabProps> = ({
  scorecards,
  selectedDealId: initialDealId,
  workspaceId,
  organizationId,
  currentUserId,
  onRefreshData,
}) => {
  const { toast } = useToast();
  const [activeDealId, setActiveDealId] = React.useState<string>(
    initialDealId || (scorecards.length > 0 ? scorecards[0].dealId : '')
  );

  // Sync if prop changes
  React.useEffect(() => {
    if (initialDealId) setActiveDealId(initialDealId);
  }, [initialDealId]);

  const activeDeal = scorecards.find((c) => c.dealId === activeDealId) || scorecards[0];

  // Dynamic Stakeholder State loaded from workspace
  const [stakeholders, setStakeholders] = React.useState<StakeholderPerson[]>([]);
  const [isLoadingMap, setIsLoadingMap] = React.useState<boolean>(false);

  // Fetch real stakeholder map whenever active deal changes
  React.useEffect(() => {
    if (!activeDealId || !workspaceId) return;

    let isMounted = true;
    const fetchDealStakeholders = async () => {
      setIsLoadingMap(true);
      try {
        const res = await getDealHealthDetailAction({ dealId: activeDealId, workspaceId, userId: currentUserId });
        if (isMounted && res.success && res.stakeholderMap) {
          setStakeholders(res.stakeholderMap.stakeholders || []);
        } else if (isMounted) {
          setStakeholders([]);
        }
      } catch (err) {
        console.warn('Could not load stakeholder map:', err);
      } finally {
        if (isMounted) setIsLoadingMap(false);
      }
    };

    fetchDealStakeholders();
    return () => {
      isMounted = false;
    };
  }, [activeDealId, workspaceId, currentUserId]);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = React.useState<boolean>(false);
  const [isSaving, setIsSaving] = React.useState<boolean>(false);

  // Form State for Add Stakeholder
  const [newName, setNewName] = React.useState<string>('');
  const [newTitle, setNewTitle] = React.useState<string>('');
  const [newEmail, setNewEmail] = React.useState<string>('');
  const [newPhone, setNewPhone] = React.useState<string>('');
  const [newRole, setNewRole] = React.useState<StakeholderRole>('evaluator');
  const [newSentiment, setNewSentiment] = React.useState<StakeholderSentiment>('neutral');

  // Real MEDDPICC evaluation from pure engine
  const { multiThreadingScore, isSingleThreaded, missingCrucialRoles } = React.useMemo(() => {
    return evaluateStakeholderMultiThreading(stakeholders, activeDeal?.dealValue || 10000);
  }, [stakeholders, activeDeal?.dealValue]);

  const handleAddStakeholder = async () => {
    if (!newName.trim()) {
      toast({ title: 'Validation Error', description: 'Contact name is required.', variant: 'destructive' });
      return;
    }

    const newPerson: StakeholderPerson = {
      contactId: `cnt_${Date.now()}`,
      name: newName.trim(),
      title: newTitle.trim() || 'Stakeholder',
      email: newEmail.trim() || undefined,
      phone: newPhone.trim() || undefined,
      role: newRole,
      sentiment: newSentiment,
      engagement: 'active',
      isPrimaryContact: stakeholders.length === 0,
    };

    const updatedRoster = [...stakeholders, newPerson];
    setStakeholders(updatedRoster);

    if (activeDeal) {
      try {
        setIsSaving(true);
        const res = await saveStakeholderMapAction({
          dealId: activeDeal.dealId,
          dealName: activeDeal.dealName,
          workspaceId,
          organizationId,
          stakeholders: updatedRoster,
          dealValue: activeDeal.dealValue,
          userId: currentUserId,
        });

        if (res.success) {
          toast({
            title: 'Stakeholder Added',
            description: `${newPerson.name} added as ${newPerson.role.replace('_', ' ')}. Multi-threading score updated.`,
          });
          setIsAddModalOpen(false);
          setNewName('');
          setNewTitle('');
          setNewEmail('');
          setNewPhone('');
          if (onRefreshData) onRefreshData();
        } else {
          toast({ title: 'Save Failed', description: res.error || 'Failed to update roster.', variant: 'destructive' });
        }
      } catch {
        toast({ title: 'Network Error', description: 'Failed to communicate with server.', variant: 'destructive' });
      } finally {
        setIsSaving(false);
      }
    } else {
      setIsAddModalOpen(false);
    }
  };

  const getRoleIcon = (role: StakeholderRole) => {
    switch (role) {
      case 'economic_buyer':
        return <Crown className="w-4 h-4 text-amber-500" />;
      case 'champion':
        return <HeartHandshake className="w-4 h-4 text-emerald-500" />;
      case 'technical_gatekeeper':
        return <Shield className="w-4 h-4 text-blue-500" />;
      case 'blocker':
        return <AlertOctagon className="w-4 h-4 text-rose-500" />;
      default:
        return <HelpCircle className="w-4 h-4 text-primary" />;
    }
  };

  const getRoleBadge = (role: StakeholderRole) => {
    switch (role) {
      case 'economic_buyer':
        return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Economic Buyer</Badge>;
      case 'champion':
        return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Champion</Badge>;
      case 'technical_gatekeeper':
        return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30">Tech Gatekeeper</Badge>;
      case 'blocker':
        return <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/30">Blocker</Badge>;
      default:
        return <Badge variant="outline">Evaluator / Influencer</Badge>;
    }
  };

  const getSentimentBadge = (sentiment: StakeholderSentiment) => {
    switch (sentiment) {
      case 'champion':
        return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Advocate</Badge>;
      case 'supporter':
        return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30">Supporter</Badge>;
      case 'neutral':
        return <Badge variant="secondary">Neutral</Badge>;
      case 'skeptic':
        return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Skeptic</Badge>;
      case 'blocker':
        return <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/30">Hostile</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Deal Selector & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Stakeholder Map & Power Matrix
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Identify champions, track economic decision-makers, and prevent single-threaded deal failure.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Deal Picker */}
          {scorecards.length > 0 && (
            <select
              value={activeDeal?.dealId}
              onChange={(e) => setActiveDealId(e.target.value)}
              className="h-10 text-xs rounded-md border bg-background px-3 font-semibold focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
            >
              {scorecards.map((c) => (
                <option key={c.dealId} value={c.dealId}>
                  {c.dealName} (${c.dealValue.toLocaleString()})
                </option>
              ))}
            </select>
          )}

          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="min-h-[44px] active:scale-[0.97] text-xs font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Stakeholder
          </Button>
        </div>
      </div>

      {/* Multi-Threading Health Banner */}
      <Card className="p-5 bg-muted/20 border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Multi-Threading Health:
              </span>
              <span className="text-sm font-extrabold font-mono text-foreground">
                {multiThreadingScore}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {isSingleThreaded
                ? 'High deal value with only 1 contact engaged. Urgent need to multi-thread.'
                : `${stakeholders.length} stakeholders actively mapped across financial, executive, and technical roles.`}
            </p>
          </div>

          {isSingleThreaded && (
            <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/30 px-3 py-1.5 text-xs font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              Single-Threaded Risk
            </Badge>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full ${
              multiThreadingScore >= 80
                ? 'bg-emerald-500'
                : multiThreadingScore >= 50
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
            }`}
            style={{ width: `${multiThreadingScore}%` }}
          />
        </div>
      </Card>

      {/* Stakeholders Cards Grid with Loading & Empty States */}
      {isLoadingMap ? (
        <Card className="p-8 text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
          <p className="text-xs text-muted-foreground">Loading stakeholder power map...</p>
        </Card>
      ) : stakeholders.length === 0 ? (
        <Card className="p-8 text-center space-y-3 border-dashed">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold">No Stakeholders Mapped Yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Deals with unmapped decision makers have 3.4x higher slippage risk. Add the Economic Buyer, Champion, and Evaluators to establish multi-threading.
          </p>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            size="sm"
            className="min-h-[44px] active:scale-[0.97] transition-transform"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add First Stakeholder
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stakeholders.map((person) => (
          <Card
            key={person.contactId}
            className="p-5 transition-all hover:border-primary/40 space-y-4 relative"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-muted/70 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {getRoleIcon(person.role)}
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">{person.name}</h3>
                    {person.isPrimaryContact && (
                      <Badge variant="secondary" className="text-[10px]">
                        Primary
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{person.title}</p>
                </div>
              </div>
            </div>

            {/* Role & Sentiment Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
              {getRoleBadge(person.role)}
              {getSentimentBadge(person.sentiment)}
              <Badge variant="outline" className="text-[10px] uppercase font-mono">
                {person.engagement}
              </Badge>
            </div>

            {/* Contact Details */}
            <div className="space-y-1.5 text-xs text-muted-foreground pt-1">
              {person.email && (
                <div className="flex items-center gap-2 truncate">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="truncate">{person.email}</span>
                </div>
              )}
              {person.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{person.phone}</span>
                </div>
              )}
            </div>

            {/* Notes */}
            {person.notes && (
              <div className="rounded bg-muted/40 p-2.5 text-[11px] text-muted-foreground leading-relaxed">
                {person.notes}
              </div>
            )}
          </Card>
        ))}
        </div>
      )}

      {/* Add Stakeholder Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add Deal Stakeholder</DialogTitle>
            <DialogDescription>
              Assign roles and sentiment to map the organizational buying committee.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Full Name *</label>
              <Input
                placeholder="e.g. Kwame Mensah"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="min-h-[44px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Job Title</label>
              <Input
                placeholder="e.g. VP of Operations"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="min-h-[44px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Email</label>
                <Input
                  placeholder="name@company.com"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Phone</label>
                <Input
                  placeholder="+233..."
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="min-h-[44px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as StakeholderRole)}
                  className="w-full h-11 text-xs rounded-md border bg-background px-3 font-semibold focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
                >
                  <option value="economic_buyer">Economic Buyer</option>
                  <option value="champion">Champion</option>
                  <option value="evaluator">Evaluator</option>
                  <option value="influencer">Influencer</option>
                  <option value="technical_gatekeeper">Tech Gatekeeper</option>
                  <option value="blocker">Blocker</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Sentiment</label>
                <select
                  value={newSentiment}
                  onChange={(e) => setNewSentiment(e.target.value as StakeholderSentiment)}
                  className="w-full h-11 text-xs rounded-md border bg-background px-3 font-semibold focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
                >
                  <option value="champion">Advocate</option>
                  <option value="supporter">Supporter</option>
                  <option value="neutral">Neutral</option>
                  <option value="skeptic">Skeptic</option>
                  <option value="blocker">Hostile</option>
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsAddModalOpen(false)}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              disabled={isSaving}
              onClick={handleAddStakeholder}
              className="min-h-[44px] active:scale-[0.97]"
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              Save Stakeholder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
