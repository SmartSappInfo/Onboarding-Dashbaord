'use client';

/**
 * @fileOverview Pitch Recommendation HUD Component (Phase 10 Milestone 3 Task 3)
 * 
 * ARCHITECTURAL INVARIANTS:
 * 1. Rule 41 Operational Explainability: Explicit WHAT, WHY, and EXPECTED STATE CHANGE breakdown.
 * 2. Untrusted Reference Isolation (Rules 13 & 30): All AI pitch texts, objections, and scraped evidence
 *    are strictly containerized in <untrusted_reference_data id="...">.
 * 3. Multi-Channel Playbooks: Tabbed channel hooks (Email, WhatsApp, Phone) with 1-click tactile copying.
 * 4. Grounded Objection Handling: Direct counter-arguments with verifiable field evidence.
 * 5. Strict Zero-any typing (Rule 4).
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Sparkles,
  MessageSquare,
  Mail,
  Phone,
  Copy,
  Check,
  ShieldAlert,
  HelpCircle,
  Lightbulb,
  CheckCircle2,
  Send,
  Zap,
  UserCheck,
} from 'lucide-react';
import type { LeadPitchRecommendation, LeadObjectionHandler } from '@/platform/agents/sales/context/lead-context-types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

function UntrustedReferenceData({
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return React.createElement('untrusted_reference_data', { id, className }, children);
}

export interface PitchRecommendationHudProps {
  pitch?: LeadPitchRecommendation | null;
  objections?: LeadObjectionHandler[] | null;
  className?: string;
  onLaunchPitch?: (channel: 'email' | 'whatsapp' | 'call') => void;
  onCopyScript?: (text: string) => void;
}

export function PitchRecommendationHud({
  pitch,
  objections,
  className,
  onLaunchPitch,
  onCopyScript,
}: PitchRecommendationHudProps) {
  const { toast } = useToast();
  const [activeChannel, setActiveChannel] = React.useState<'email' | 'whatsapp' | 'phone'>('email');
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  if (!pitch) {
    return (
      <div className={cn('p-6 rounded-2xl border border-dashed border-border/80 bg-muted/10 text-center space-y-2', className)}>
        <Lightbulb className="h-6 w-6 text-muted-foreground mx-auto" />
        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">No Pitch Strategy Generated</h4>
        <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
          Select or enrich a prospect to synthesize personalized value propositions and objection handling playbooks.
        </p>
      </div>
    );
  }

  const handleCopy = (text: string, key: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    onCopyScript?.(text);
    toast({
      title: 'Copied to Clipboard',
      description: `${label} ready to paste.`,
    });
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const getEmailHook = () => {
    return `Subject: Quick question regarding ${pitch.targetPersona} workflows\n\nHi there,\n\nI noticed your recent focus on operational scaling. ${pitch.pitchText}\n\nSpecifically, schools like yours achieve:\n${pitch.valuePropositions.map((vp) => `• ${vp}`).join('\n')}\n\nWould you be open to a 10-minute walkthrough this Thursday?\n\nBest regards,\nSmartSapp SDR Team`;
  };

  const getWhatsAppHook = () => {
    return `Hello! Reaching out regarding your ${pitch.targetPersona} operations. ${pitch.pitchText} Would you be open to reviewing a 2-minute demo video?`;
  };

  const getPhoneHook = () => {
    return `Opening: "Hi, this is the SmartSapp team. I'm calling for the ${pitch.targetPersona} regarding your enrollment and fee management workflows. ${pitch.pitchText} Do you have 90 seconds to see if our automated reconciliation is relevant for you?"`;
  };

  const channelHooks = {
    email: getEmailHook(),
    whatsapp: getWhatsAppHook(),
    phone: getPhoneHook(),
  };

  return (
    <div className={cn('p-5 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm space-y-5', className)}>
      {/* HUD Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Pitch Recommendation HUD
            </h4>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Targeted conversion angles, channel opening hooks & objection playbooks
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-muted-foreground text-[10px] font-semibold flex items-center gap-1">
            <UserCheck className="h-3 w-3 text-primary" />
            <span>Target: {pitch.targetPersona}</span>
          </Badge>
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
            {pitch.confidence}% Confidence
          </Badge>
        </div>
      </div>

      {/* Hero Value Proposition Card */}
      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-[10px] uppercase font-bold text-primary tracking-wider flex items-center gap-1">
              <Zap className="h-3 w-3" />
              <span>Core Value Proposition</span>
            </div>
            <UntrustedReferenceData id={`pitch_text_${pitch.prospectId}`}>
              <p className="text-sm font-semibold text-foreground leading-relaxed">
                {pitch.pitchText}
              </p>
            </UntrustedReferenceData>
          </div>
        </div>

        {/* Value Prop Bullets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {pitch.valuePropositions.map((vp, idx) => (
            <div key={idx} className="flex items-start gap-1.5 text-xs text-muted-foreground p-2 rounded-lg bg-card/60 border border-border/40">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <UntrustedReferenceData id={`vp_${idx}`}>
                <span>{vp}</span>
              </UntrustedReferenceData>
            </div>
          ))}
        </div>

        {/* Grounding Points */}
        {pitch.groundingPoints && pitch.groundingPoints.length > 0 && (
          <div className="pt-2 border-t border-border/40">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block mb-1">
              Grounded Evidence & Signals
            </span>
            <div className="flex flex-wrap gap-1.5">
              {pitch.groundingPoints.map((gp, idx) => (
                <Badge key={idx} variant="secondary" className="text-[10px] font-medium bg-muted/60">
                  <UntrustedReferenceData id={`gp_${idx}`}>
                    {gp}
                  </UntrustedReferenceData>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Multi-Channel Opening Hooks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            Channel-Specific Opening Hooks
          </span>
          <span className="text-[10px] text-muted-foreground">1-Click Tactical Scripts</span>
        </div>

        <Tabs
          value={activeChannel}
          onValueChange={(val) => setActiveChannel(val as 'email' | 'whatsapp' | 'phone')}
          className="w-full"
        >
          <TabsList className="grid grid-cols-3 bg-muted/20 p-1 border border-border/60 rounded-xl">
            <TabsTrigger
              value="email"
              className="text-xs font-semibold gap-1.5 rounded-lg active:scale-[0.97]"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Email</span>
            </TabsTrigger>
            <TabsTrigger
              value="whatsapp"
              className="text-xs font-semibold gap-1.5 rounded-lg active:scale-[0.97]"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>WhatsApp</span>
            </TabsTrigger>
            <TabsTrigger
              value="phone"
              className="text-xs font-semibold gap-1.5 rounded-lg active:scale-[0.97]"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>Phone</span>
            </TabsTrigger>
          </TabsList>

          {(['email', 'whatsapp', 'phone'] as const).map((channel) => (
            <TabsContent key={channel} value={channel} className="mt-3 space-y-2.5">
              <div className="p-3.5 rounded-xl border border-border/80 bg-muted/10 relative group">
                <UntrustedReferenceData id={`channel_script_${channel}`}>
                  <pre className="text-xs font-sans text-foreground whitespace-pre-wrap leading-relaxed select-all">
                    {channelHooks[channel]}
                  </pre>
                </UntrustedReferenceData>

                <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-border/40">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(channelHooks[channel], channel, `${channel.toUpperCase()} Script`)}
                    className="h-8 px-3 rounded-xl active:scale-[0.97] text-xs font-semibold"
                  >
                    {copiedKey === channel ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500 mr-1.5" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        <span>Copy Script</span>
                      </>
                    )}
                  </Button>

                  {onLaunchPitch && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onLaunchPitch(channel === 'phone' ? 'call' : channel)}
                      className="h-8 px-3 rounded-xl active:scale-[0.97] text-xs font-semibold gap-1.5"
                    >
                      <Send className="h-3 w-3" />
                      <span>Launch Sequence</span>
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Objection Handling Playbook */}
      {objections && objections.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
              <span>Objection Handling Playbook</span>
            </span>
            <span className="text-[10px] text-muted-foreground">Battle-Tested Rebuttals</span>
          </div>

          <div className="space-y-2.5">
            {objections.map((obj, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <span className="text-amber-500 font-bold">Objection:</span>
                    <UntrustedReferenceData id={`obj_text_${idx}`}>
                      <span>"{obj.objection}"</span>
                    </UntrustedReferenceData>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(obj.counter, `obj_${idx}`, 'Rebuttal Counter')}
                    className="h-7 px-2 rounded-lg text-[11px] text-muted-foreground hover:text-foreground active:scale-[0.97]"
                  >
                    {copiedKey === `obj_${idx}` ? (
                      <Check className="h-3 w-3 text-emerald-500 mr-1" />
                    ) : (
                      <Copy className="h-3 w-3 mr-1" />
                    )}
                    <span>Copy Rebuttal</span>
                  </Button>
                </div>

                <div className="p-2.5 rounded-lg bg-card/80 border border-border/40 text-[11px] space-y-1">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">
                    Recommended Counter-Narrative:
                  </div>
                  <UntrustedReferenceData id={`obj_counter_${idx}`}>
                    <div className="text-foreground leading-relaxed">{obj.counter}</div>
                  </UntrustedReferenceData>
                </div>

                {obj.evidence && obj.evidence.length > 0 && (
                  <div className="text-[10px] text-muted-foreground flex items-start gap-1 pl-1">
                    <span className="font-semibold text-foreground shrink-0">Supporting Evidence:</span>
                    <UntrustedReferenceData id={`obj_evidence_${idx}`}>
                      <span>{obj.evidence.join('; ')}</span>
                    </UntrustedReferenceData>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rule 41 Explainability Grid: WHAT / WHY / EXPECTED STATE CHANGE */}
      <div className="p-3.5 rounded-xl border border-border/80 bg-muted/15 space-y-2.5 text-xs">
        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
          <HelpCircle className="h-3 w-3 text-primary" />
          <span>Rule 41 Operational Explainability</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div className="space-y-1 p-2 rounded-lg bg-card/60 border border-border/40">
            <div className="text-[10px] font-bold text-foreground uppercase tracking-wider">WHAT</div>
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              Targeted pitch angle for <span className="font-semibold text-foreground">{pitch.targetPersona}</span> with {pitch.confidence}% confidence scoring.
            </div>
          </div>

          <div className="space-y-1 p-2 rounded-lg bg-card/60 border border-border/40">
            <div className="text-[10px] font-bold text-foreground uppercase tracking-wider">WHY</div>
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              Grounded in {pitch.groundingPoints?.[0] || 'demonstrated sector pain point'} and validated across similar closed accounts.
            </div>
          </div>

          <div className="space-y-1 p-2 rounded-lg bg-card/60 border border-border/40">
            <div className="text-[10px] font-bold text-foreground uppercase tracking-wider">EXPECTED STATE CHANGE</div>
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              Empower SDR or autonomous agent to initiate conversation with high-resonance opening hooks and pre-empt objections.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default PitchRecommendationHud;
