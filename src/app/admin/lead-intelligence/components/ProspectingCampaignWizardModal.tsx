'use client';

/**
 * 8-Step Guided Prospecting Campaign Wizard Modal (Lead Intelligence 2.0 - Phase 10)
 * UI Spec Section 42: "Prospecting Campaign UX — 8-Step Guided Wizard"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. 8-Step guided wizard executing discovery, enrichment, verification, qualification, and activation.
 * 2. Mobile-first collapsible step progression.
 * 3. Safe chunked execution on campaign launch.
 * 4. Emil Kowalski active physics (active:scale-[0.97]).
 * 5. Strict Zero-`any` typing.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { 
  Rocket, 
  MapPin, 
  Search, 
  Globe, 
  ShieldCheck, 
  Sliders, 
  Users, 
  Send, 
  BarChart3, 
  CheckCircle2, 
  ArrowLeft, 
  ArrowRight,
  Loader2
} from 'lucide-react';
import type { ProspectingCampaign, LeadList } from '@/lib/lead-intelligence/types';
import { saveProspectingCampaignAction, launchProspectingCampaignAction } from '@/app/actions/lead-intelligence-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ProspectingCampaignWizardModalProps {
  workspaceId: string;
  organizationId: string;
  lists: LeadList[];
  isOpen: boolean;
  onClose: () => void;
  onCampaignLaunched: () => void;
}

const WIZARD_STEPS = [
  { step: 1, title: 'Target', icon: MapPin, desc: 'Define ICP & Region' },
  { step: 2, title: 'Source', icon: Search, desc: 'Prospect Source' },
  { step: 3, title: 'Enrich', icon: Globe, desc: 'Waterfall & AI' },
  { step: 4, title: 'Verify', icon: ShieldCheck, desc: 'SMTP & Deliverability' },
  { step: 5, title: 'Qualify', icon: Sliders, desc: 'Score Threshold' },
  { step: 6, title: 'Assign', icon: Users, desc: 'Sales Rep Distribution' },
  { step: 7, title: 'Activate', icon: Send, desc: 'CRM & Outreach' },
  { step: 8, title: 'Launch', icon: Rocket, desc: 'Review & Execute' }
];

export const ProspectingCampaignWizardModal: React.FC<ProspectingCampaignWizardModalProps> = ({
  workspaceId,
  organizationId,
  lists,
  isOpen,
  onClose,
  onCampaignLaunched
}) => {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLaunching, setIsLaunching] = useState(false);

  // Form State
  const [campaignName, setCampaignName] = useState('Q4 Educational Acquisition');
  const [targetRegion, setTargetRegion] = useState('Greater Accra, Ghana');
  const [targetIndustry, setTargetIndustry] = useState('Private K-12 Schools');
  const [minRating, setMinRating] = useState(4.0);

  const [sourceType, setSourceType] = useState<'places' | 'list' | 'all_discovered'>('places');
  const [sourceListId, setSourceListId] = useState<string>('');

  const [runWebScan, setRunWebScan] = useState(true);
  const [extractDecisionMakers, setExtractDecisionMakers] = useState(true);
  const [verifyEmails, setVerifyEmails] = useState(true);
  const [generateAIDossier, setGenerateAIDossier] = useState(true);

  const [qualificationThreshold, setQualificationThreshold] = useState(75);

  const [assignmentType, setAssignmentType] = useState<'round_robin' | 'specific_rep' | 'unassigned'>('round_robin');
  const [createDeals, setCreateDeals] = useState(true);
  const [enrollInCadence, setEnrollInCadence] = useState(true);
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'call_script'>('email');

  const handleNext = () => {
    if (currentStep < 8) setCurrentStep(currentStep + 1);
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleLaunch = async () => {
    setIsLaunching(true);
    try {
      const campaignId = `camp_${Date.now()}`;
      const campaignData: ProspectingCampaign = {
        id: campaignId,
        workspaceId,
        organizationId,
        name: campaignName,
        status: 'draft',
        targetCriteria: {
          region: targetRegion,
          industry: targetIndustry,
          minRating,
          sourceType,
          sourceListId: sourceType === 'list' ? sourceListId : undefined
        },
        enrichmentOptions: {
          runWebScan,
          extractDecisionMakers,
          verifyEmails,
          generateAIDossier
        },
        qualificationThreshold,
        assignment: {
          type: assignmentType,
          repIds: ['rep_primary', 'rep_secondary']
        },
        activation: {
          createDeals,
          enrollInCadence,
          channel
        },
        stats: {
          totalProspects: 0,
          enrichedCount: 0,
          verifiedCount: 0,
          qualifiedCount: 0,
          dealsCreated: 0,
          outreachSent: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveProspectingCampaignAction(campaignData);
      const res = await launchProspectingCampaignAction(campaignId, workspaceId, organizationId);

      if (res.success) {
        toast({
          title: 'Prospecting Campaign Launched 🚀',
          description: `Campaign "${campaignName}" is active. Qualified ${res.qualifiedCount || 0} leads and created ${res.dealsCreated || 0} CRM deals.`
        });
        onCampaignLaunched();
        onClose();
      } else {
        toast({
          variant: 'destructive',
          title: 'Campaign Launch Failed',
          description: res.error || 'Failed to execute campaign'
        });
      }
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl w-[96vw] p-0 bg-card border-border/80 shadow-2xl rounded-2xl overflow-hidden z-[10003] flex flex-col">
        {/* Header */}
        <DialogHeader className="p-5 border-b bg-muted/20 space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" />
                <DialogTitle className="text-base font-extrabold text-foreground tracking-tight">
                  8-Step Prospecting Campaign Wizard
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground pt-0.5">
                Automated multi-stage engine from discovery to CRM deals and multi-channel activation.
              </DialogDescription>
            </div>

            <Badge className="bg-primary/10 text-primary border-primary/30 text-xs font-bold px-3 py-1">
              Step {currentStep} of 8
            </Badge>
          </div>

          {/* Stepper Progress Rail (UI Spec Section 42) */}
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 pt-2">
            {WIZARD_STEPS.map((s) => {
              const Icon = s.icon;
              const isPassed = s.step < currentStep;
              const isCurrent = s.step === currentStep;

              return (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setCurrentStep(s.step)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-xl text-center transition-all cursor-pointer border",
                    isCurrent
                      ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                      : isPassed
                      ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-600"
                      : "border-border/60 bg-muted/10 text-muted-foreground opacity-70 hover:opacity-100"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-[10px] truncate max-w-full">{s.title}</span>
                </button>
              );
            })}
          </div>
        </DialogHeader>

        {/* Step Body */}
        <div className="p-6 space-y-4 max-h-[55vh] overflow-y-auto">
          {/* STEP 1: DEFINE TARGET */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground">Campaign Name</Label>
                <Input
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">Target Geographic Region</Label>
                  <Input
                    value={targetRegion}
                    onChange={(e) => setTargetRegion(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-foreground">Target Vertical</Label>
                  <Input
                    value={targetIndustry}
                    onChange={(e) => setTargetIndustry(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: SOURCE PROSPECTS */}
          {currentStep === 2 && (
            <div className="space-y-3">
              <Label className="text-xs font-bold text-foreground uppercase tracking-wider block">
                Prospect Sourcing Strategy
              </Label>
              <RadioGroup
                value={sourceType}
                onValueChange={(val: string) => setSourceType(val as 'places' | 'list' | 'all_discovered')}
                className="space-y-2"
              >
                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border/80 cursor-pointer hover:bg-muted/10">
                  <RadioGroupItem value="places" className="mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-foreground">Google Places Discovery Radar</span>
                    <p className="text-[11px] text-muted-foreground">Scans all newly discovered educational institutions in target region.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border/80 cursor-pointer hover:bg-muted/10">
                  <RadioGroupItem value="list" className="mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div>
                      <span className="text-xs font-bold text-foreground">Existing Lead List</span>
                      <p className="text-[11px] text-muted-foreground">Select from previously saved lists or imported spreadsheets.</p>
                    </div>

                    {sourceType === 'list' && (
                      <Select value={sourceListId} onValueChange={setSourceListId}>
                        <SelectTrigger className="h-9 text-xs rounded-lg">
                          <SelectValue placeholder="Select List" />
                        </SelectTrigger>
                        <SelectContent className="z-[10005]">
                          {lists.map(l => (
                            <SelectItem key={l.id} value={l.id} className="text-xs">
                              {l.name} ({l.prospectsCount} leads)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </label>
              </RadioGroup>
            </div>
          )}

          {/* STEP 3: ENRICH */}
          {currentStep === 3 && (
            <div className="space-y-3">
              <Label className="text-xs font-bold text-foreground uppercase tracking-wider block">
                Enrichment Pipeline Layers
              </Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-card">
                  <div>
                    <span className="text-xs font-bold text-foreground">Website Technographics & Subdomain Scan</span>
                    <p className="text-[11px] text-muted-foreground">Detects CMS, portal subdomains, and online payment stacks.</p>
                  </div>
                  <Switch checked={runWebScan} onCheckedChange={setRunWebScan} />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-card">
                  <div>
                    <span className="text-xs font-bold text-foreground">Leadership & Decision Maker Extraction</span>
                    <p className="text-[11px] text-muted-foreground">Finds Headmaster, Principal, Bursar, and Director contacts.</p>
                  </div>
                  <Switch checked={extractDecisionMakers} onCheckedChange={setExtractDecisionMakers} />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-card">
                  <div>
                    <span className="text-xs font-bold text-foreground">AI Strategy Brief & Commercial Packaging</span>
                    <p className="text-[11px] text-muted-foreground">Synthesizes ACV, urgency, and customized pitch scripts.</p>
                  </div>
                  <Switch checked={generateAIDossier} onCheckedChange={setGenerateAIDossier} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: VERIFY */}
          {currentStep === 4 && (
            <div className="space-y-3">
              <Label className="text-xs font-bold text-foreground uppercase tracking-wider block">
                Deliverability Verification
              </Label>
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Real-time SMTP & DNS MX Deliverability Gate</span>
                  <Switch checked={verifyEmails} onCheckedChange={setVerifyEmails} />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Performs non-destructive zero-body socket probing and catch-all detection before outreach to guarantee 0% bounce rate.
                </p>
              </div>
            </div>
          )}

          {/* STEP 5: QUALIFY */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <Label className="text-xs font-bold text-foreground uppercase tracking-wider block">
                Qualification Threshold
              </Label>
              <div className="p-4 rounded-xl border border-border/80 bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Minimum Priority Score</span>
                  <Badge className="bg-primary/20 text-primary border-primary/40 font-mono font-bold">
                    &ge; {qualificationThreshold} / 100
                  </Badge>
                </div>
                <Slider
                  value={[qualificationThreshold]}
                  min={50}
                  max={95}
                  step={5}
                  onValueChange={(val) => setQualificationThreshold(val[0])}
                  className="py-2"
                />
                <p className="text-[11px] text-muted-foreground">
                  Prospects scoring below this threshold will remain in research staging and will not generate CRM deals.
                </p>
              </div>
            </div>
          )}

          {/* STEP 6: ASSIGN */}
          {currentStep === 6 && (
            <div className="space-y-3">
              <Label className="text-xs font-bold text-foreground uppercase tracking-wider block">
                Sales Rep Distribution
              </Label>
              <RadioGroup
                value={assignmentType}
                onValueChange={(val: string) => setAssignmentType(val as 'round_robin' | 'specific_rep' | 'unassigned')}
                className="space-y-2"
              >
                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border/80 cursor-pointer hover:bg-muted/10">
                  <RadioGroupItem value="round_robin" className="mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-foreground">Round-Robin Rep Assignment</span>
                    <p className="text-[11px] text-muted-foreground">Distributes qualified leads evenly across sales reps.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border/80 cursor-pointer hover:bg-muted/10">
                  <RadioGroupItem value="unassigned" className="mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-foreground">Unassigned Pipeline Pool</span>
                    <p className="text-[11px] text-muted-foreground">Pushes leads into unassigned queue for reps to claim.</p>
                  </div>
                </label>
              </RadioGroup>
            </div>
          )}

          {/* STEP 7: ACTIVATE */}
          {currentStep === 7 && (
            <div className="space-y-3">
              <Label className="text-xs font-bold text-foreground uppercase tracking-wider block">
                Multi-Channel Activation Channels
              </Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-card">
                  <div>
                    <span className="text-xs font-bold text-foreground">Auto-Create CRM Deals in Onboarding Pipeline</span>
                    <p className="text-[11px] text-muted-foreground">Generates Entity & Deal records automatically.</p>
                  </div>
                  <Switch checked={createDeals} onCheckedChange={setCreateDeals} />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-card">
                  <div>
                    <span className="text-xs font-bold text-foreground">Enroll in Multi-Channel Outreach Cadence</span>
                    <p className="text-[11px] text-muted-foreground">Auto-schedules email, WhatsApp, and call scripts.</p>
                  </div>
                  <Switch checked={enrollInCadence} onCheckedChange={setEnrollInCadence} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 8: LAUNCH & SUMMARY */}
          {currentStep === 8 && (
            <div className="space-y-3">
              <Label className="text-xs font-bold text-foreground uppercase tracking-wider block">
                Campaign Launch Summary
              </Label>
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Campaign: {campaignName}</span>
                  <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/40 text-[10px] font-bold">
                    Ready to Execute
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                  <div>Region: <strong className="text-foreground">{targetRegion}</strong></div>
                  <div>Industry: <strong className="text-foreground">{targetIndustry}</strong></div>
                  <div>Qualification: <strong className="text-foreground">&ge; {qualificationThreshold} Score</strong></div>
                  <div>Deals: <strong className="text-foreground">{createDeals ? 'Auto-Create' : 'Manual'}</strong></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <DialogFooter className="p-4 bg-muted/20 border-t flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={currentStep === 1 ? onClose : handlePrev}
            className="h-9 px-4 text-xs font-semibold rounded-xl flex items-center gap-1.5"
          >
            {currentStep > 1 && <ArrowLeft className="h-3.5 w-3.5" />}
            <span>{currentStep === 1 ? 'Cancel' : 'Back'}</span>
          </Button>

          {currentStep < 8 ? (
            <Button
              type="button"
              onClick={handleNext}
              className="h-9 px-4 text-xs font-bold bg-primary text-primary-foreground rounded-xl flex items-center gap-1.5 active:scale-[0.97]"
            >
              <span>Next Step</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleLaunch}
              disabled={isLaunching}
              className="h-9 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1.5 active:scale-[0.97]"
            >
              {isLaunching ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Launching Pipeline...</span>
                </>
              ) : (
                <>
                  <Rocket className="h-3.5 w-3.5" />
                  <span>Launch Campaign</span>
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
