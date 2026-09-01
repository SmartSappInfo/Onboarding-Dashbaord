'use client';

/**
 * SmartSapp Forms 2.0: AI Form Creation Modal
 * 
 * Interactive generative wizard allowing administrators to create complete,
 * multi-page, conditionally branched, and scored forms in seconds from natural
 * language prompts or one-click industry preset chips.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles,
  Wand2,
  GraduationCap,
  Ticket,
  Briefcase,
  UserCheck,
  HeartPulse,
  Handshake,
  Loader2,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { generateFormWithAiAction } from '@/lib/forms/form-ai-actions';
import type { FormPurpose } from '@/lib/forms/form-types';

interface PresetPrompt {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge: string;
  purpose: FormPurpose;
  prompt: string;
  tone: 'professional' | 'friendly' | 'academic' | 'modern';
  multiPage: boolean;
  scoring: boolean;
}

const PRESET_PROMPTS: PresetPrompt[] = [
  {
    id: 'school_admission',
    icon: GraduationCap,
    title: 'School Admission & Boarding',
    badge: 'Education',
    purpose: 'application',
    prompt: 'Create a comprehensive student admission application for high school boarding. Include student demographics, previous school records, medical conditions disclosure, emergency guardian contacts, and boarding house room preferences.',
    tone: 'academic',
    multiPage: true,
    scoring: true,
  },
  {
    id: 'tech_summit',
    icon: Ticket,
    title: 'Tech Conference Registration',
    badge: 'Events',
    purpose: 'registration',
    prompt: 'Build an event registration form for an African Tech Summit. Capture attendee details, company name, job title, ticket tier (Standard, VIP, Speaker), dietary preferences, and workshop breakout tracks.',
    tone: 'modern',
    multiPage: true,
    scoring: false,
  },
  {
    id: 'client_onboarding',
    icon: Briefcase,
    title: 'B2B Client Onboarding',
    badge: 'Sales & CRM',
    purpose: 'onboarding',
    prompt: 'Design a client discovery and onboarding questionnaire for a software agency. Ask about business goals, technical stack, monthly budget range, expected launch timeline, and primary stakeholder points of contact.',
    tone: 'professional',
    multiPage: true,
    scoring: true,
  },
  {
    id: 'job_application',
    icon: UserCheck,
    title: 'Job Applicant Intake',
    badge: 'Recruitment',
    purpose: 'application',
    prompt: 'Create a job application form for a Senior Full-Stack Engineer. Collect full name, email, phone, LinkedIn / GitHub URLs, years of experience with React & Node.js, portfolio links, and notice period.',
    tone: 'professional',
    multiPage: false,
    scoring: true,
  },
  {
    id: 'medical_intake',
    icon: HeartPulse,
    title: 'Patient Medical Intake',
    badge: 'Healthcare',
    purpose: 'contact',
    prompt: 'Build a private clinic patient registration form. Capture full legal name, date of birth, insurance provider, policy number, current symptoms, known drug allergies, and digital consent signature checkbox.',
    tone: 'professional',
    multiPage: true,
    scoring: false,
  },
  {
    id: 'sponsorship_intake',
    icon: Handshake,
    title: 'Sponsorship & Partnership',
    badge: 'Partnership',
    purpose: 'qualification',
    prompt: 'Create a brand sponsorship intake form for an annual charity gala. Ask about organization name, sponsorship tier interest (Platinum, Gold, Silver), marketing objectives, and decision-maker contact details.',
    tone: 'friendly',
    multiPage: false,
    scoring: true,
  },
];

const GENERATION_STEPS = [
  'Analyzing intake goals and audience scope...',
  'Generating step pages and canonical questions...',
  'Synthesizing conditional branching & lead score rules...',
  'Configuring CRM bindings & creating draft version...',
];

interface AiFormGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  organizationId?: string;
  userId: string;
}

export default function AiFormGeneratorModal({
  isOpen,
  onClose,
  workspaceId,
  organizationId,
  userId,
}: AiFormGeneratorModalProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [prompt, setPrompt] = React.useState('');
  const [purpose, setPurpose] = React.useState<FormPurpose>('lead_capture');
  const [tone, setTone] = React.useState<'professional' | 'friendly' | 'academic' | 'modern'>('professional');
  const [multiPage, setMultiPage] = React.useState(true);
  const [enableScoring, setEnableScoring] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);

  // Cycle animation steps during generation
  React.useEffect(() => {
    if (!isGenerating) {
      setStepIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setStepIndex(prev => (prev < GENERATION_STEPS.length - 1 ? prev + 1 : prev));
    }, 2200);

    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleApplyPreset = (preset: PresetPrompt) => {
    setPrompt(preset.prompt);
    setPurpose(preset.purpose);
    setTone(preset.tone);
    setMultiPage(preset.multiPage);
    setEnableScoring(preset.scoring);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        variant: 'destructive',
        title: 'Prompt Required',
        description: 'Please type a description or pick a preset prompt above.',
      });
      return;
    }

    setIsGenerating(true);

    try {
      const result = await generateFormWithAiAction({
        prompt: prompt.trim(),
        workspaceId,
        organizationId,
        userId,
        purpose,
        tone,
        pageMode: multiPage ? 'multi' : 'single',
        enableScoring,
      });

      if (result.success && result.formId) {
        toast({
          title: 'Form Synthesized Successfully ✨',
          description: `"${result.title}" has been created with all pages, logic, and questions.`,
        });
        onClose();
        router.push(`/admin/forms/${result.formId}/edit`);
      } else {
        toast({
          variant: 'destructive',
          title: 'Generation Failed',
          description: result.error || 'Failed to synthesize form with AI.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: 'AI Synthesis Error',
        description: msg,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isGenerating && !open) onClose(); }}>
      <DialogContent className="sm:max-w-[760px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl bg-background">
        {/* Modal Top Banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 p-6 text-white">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/30 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
                <Sparkles className="h-6 w-6 text-indigo-300 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Create Form with AI Architect
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    Genkit 2.0
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-indigo-200/80 mt-0.5">
                  Describe what data you want to collect or pick a preset template below.
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {isGenerating ? (
            <div className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/30 flex items-center justify-center shadow-lg animate-pulse">
                  <Wand2 className="h-10 w-10 text-primary animate-bounce" />
                </div>
                <div className="absolute -inset-2 rounded-3xl border-2 border-primary/20 animate-spin" />
              </div>

              <div className="space-y-2 max-w-md">
                <h3 className="text-lg font-bold tracking-tight">Synthesizing Your Form Blueprint</h3>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={stepIndex}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                    className="text-xs font-semibold text-primary/80"
                  >
                    {GENERATION_STEPS[stepIndex]}
                  </motion.p>
                </AnimatePresence>
                <p className="text-[11px] text-muted-foreground pt-2">
                  Building pages, canonical question bindings, AST conditional branching, and lead qualification scoring.
                </p>
              </div>

              <div className="w-full max-w-xs bg-muted/30 rounded-full h-2 overflow-hidden border border-border/40">
                <motion.div
                  className="bg-primary h-full"
                  initial={{ width: '15%' }}
                  animate={{ width: `${((stepIndex + 1) / GENERATION_STEPS.length) * 100}%` }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Preset Chips */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  Quick Business Templates
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {PRESET_PROMPTS.map((preset) => {
                    const Icon = preset.icon;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        className="p-3 rounded-2xl border border-border/60 bg-card hover:border-primary/50 hover:bg-primary/5 transition-all text-left group flex flex-col justify-between space-y-2 active:scale-[0.98] min-h-[44px]"
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="p-1.5 rounded-xl bg-muted group-hover:bg-primary/10 text-foreground group-hover:text-primary transition-colors">
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground group-hover:text-primary">
                            {preset.badge}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                            {preset.title}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Prompt Textarea */}
              <div className="space-y-2">
                <Label htmlFor="form-prompt" className="text-xs font-bold text-foreground">
                  What kind of form do you need?
                </Label>
                <Textarea
                  id="form-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Build an admission form for an international boarding school with student demographics, medical history disclosure, guardian contacts, and room preferences..."
                  rows={4}
                  className="rounded-2xl text-xs resize-none bg-muted/10 border-border/60 focus:border-primary focus:ring-primary/20 leading-relaxed"
                />
              </div>

              {/* Form Fine-Tuning Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-muted/20 border border-border/40">
                {/* Tone Selector */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Copy Tone
                  </Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['professional', 'friendly', 'academic', 'modern'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTone(t)}
                        className={`h-8 rounded-xl text-[11px] font-semibold capitalize border transition-all active:scale-[0.97] ${
                          tone === t
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-background hover:bg-muted text-muted-foreground border-border/60'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stepper & Scoring Toggles */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-primary" />
                        Multi-Page Stepper
                      </p>
                      <p className="text-[10px] text-muted-foreground">Split into progressive steps</p>
                    </div>
                    <Switch checked={multiPage} onCheckedChange={setMultiPage} />
                  </div>

                  <div className="flex items-center justify-between border-t border-border/30 pt-2">
                    <div>
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                        Lead Qualification Scoring
                      </p>
                      <p className="text-[10px] text-muted-foreground">Assign point weights to answers</p>
                    </div>
                    <Switch checked={enableScoring} onCheckedChange={setEnableScoring} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="p-4 bg-muted/20 border-t border-border/40 flex flex-row items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isGenerating}
            className="rounded-xl h-10 px-4 text-xs font-semibold"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="rounded-xl h-10 px-5 text-xs font-bold gap-2 bg-gradient-to-r from-indigo-600 to-primary text-white shadow-md hover:opacity-90 active:scale-[0.97] transition-all min-h-[44px]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                Generate Form with AI
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
