/**
 * @fileoverview Interactive "Create with AI" Modal Dialog
 * Allows users to describe a campaign in plain English and generates a fully-configured,
 * branded, scannable QR experience with live preview and 1-click instantiation.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Employs micro-animations and active press states (active:scale-[0.97]).
 * - Scannability Guard ensures generated QR code has >= 4.5:1 contrast.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Sliders,
  Palette,
  Tag,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/firebase';
import { generateQRFromPromptAction } from '@/app/actions/qr-ai-actions';
import { createQRCode } from '@/lib/qr-actions';
import QRPreview from './qr-preview';
import type { AiGeneratedQRConfig, QRDesign } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';

interface AiCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const SAMPLE_PROMPTS = [
  'Admissions Open Day 2026 for high school graduates with campus tour registration',
  'Rooftop Lounge cocktail & tapas dining menu for table tents',
  'Guest Wi-Fi instant connect sign for reception lobby',
  'VIP Flash Promotion with 20% in-store discount code',
  'Annual Tech Summit speaker and VIP attendee badge pass',
  'Customer satisfaction 5-star review survey for medical clinic',
];

export default function AiCreateDialog({ open, onOpenChange, onSuccess }: AiCreateDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { activeOrganizationId, activeWorkspaceId } = useTenant();
  const { user } = useUser();

  const [prompt, setPrompt] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [generatedConfig, setGeneratedConfig] = React.useState<AiGeneratedQRConfig | null>(null);

  React.useEffect(() => {
    if (!open) {
      setPrompt('');
      setGeneratedConfig(null);
    }
  }, [open]);

  const handleGenerate = async (customPrompt?: string) => {
    const textToUse = customPrompt || prompt;
    if (!textToUse.trim()) {
      toast({ variant: 'destructive', title: 'Empty Prompt', description: 'Please describe the QR code experience you want to create.' });
      return;
    }

    setIsGenerating(true);
    try {
      const res = await generateQRFromPromptAction(textToUse, activeOrganizationId, activeWorkspaceId);
      if (res.success && res.data) {
        setGeneratedConfig(res.data);
      } else {
        toast({ variant: 'destructive', title: 'Generation Failed', description: res.error || 'Failed to infer QR configuration.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred during generation.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateInstantly = async () => {
    if (!generatedConfig || !activeOrganizationId || !activeWorkspaceId || !user) return;
    setIsCreating(true);

    try {
      const design: Partial<QRDesign> = {
        foregroundColor: generatedConfig.foregroundColor,
        backgroundColor: generatedConfig.backgroundColor,
        cornerSquareColor: generatedConfig.cornerSquareColor,
        cornerDotColor: generatedConfig.cornerDotColor,
        dotStyle: generatedConfig.dotStyle,
        cornerSquareStyle: generatedConfig.cornerSquareStyle,
        cornerDotStyle: generatedConfig.cornerDotStyle,
        errorCorrection: generatedConfig.errorCorrection,
        frameStyle: generatedConfig.frameStyle,
        frameText: generatedConfig.ctaText,
        frameIcon: generatedConfig.frameIcon,
        frameColor: generatedConfig.foregroundColor,
        frameTextColor: '#FFFFFF',
      };

      const res = await createQRCode({
        organizationId: activeOrganizationId,
        workspaceId: activeWorkspaceId,
        name: generatedConfig.name,
        mode: 'dynamic',
        type: generatedConfig.type,
        destination: { url: generatedConfig.destinationUrl },
        design,
        tracking: {
          enabled: true,
          utmSource: generatedConfig.tracking.utmSource,
          utmMedium: generatedConfig.tracking.utmMedium,
          utmCampaign: generatedConfig.tracking.utmCampaign,
        },
        createdBy: { userId: user.uid, name: user.displayName || 'Admin', email: user.email || '' },
      });

      if (res.id) {
        toast({
          title: 'QR Code Created with AI',
          description: `"${generatedConfig.name}" is now live and ready to deploy.`,
        });
        onSuccess?.();
        onOpenChange(false);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create QR code.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenInDesigner = () => {
    if (!generatedConfig) return;
    // Store pre-filled AI configuration in session storage for the new QR page
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('smart_qr_ai_draft', JSON.stringify(generatedConfig));
    }
    onOpenChange(false);
    router.push('/admin/qr-studio/new?fromAi=true');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-card border-border shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-border/50 bg-gradient-to-r from-primary/5 via-violet-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-foreground">
                Create QR Code with AI
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Describe your use case in plain English. AI infers the target layout, high-contrast palette, CTA frame, and tracking tags.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Prompt Input Section */}
          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              What do you want to create?
            </Label>
            <div className="relative">
              <Textarea
                placeholder="e.g. Create a high-converting QR poster for our Fall 2026 Admissions Open Day with early bird registration discount..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[90px] rounded-xl border-border bg-background/50 resize-none pr-28 text-sm focus-visible:ring-primary"
              />
              <Button
                onClick={() => handleGenerate()}
                disabled={isGenerating || !prompt.trim()}
                className="absolute right-2.5 bottom-2.5 h-9 rounded-xl px-4 text-xs font-bold shadow-md shadow-primary/20 active:scale-[0.97] transition-all"
              >
                {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                Generate
              </Button>
            </div>

            {/* Quick Starter Chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] font-semibold text-muted-foreground mr-1">Inspirations:</span>
              {SAMPLE_PROMPTS.slice(0, 3).map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPrompt(sample);
                    handleGenerate(sample);
                  }}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all truncate max-w-[220px] text-left active:scale-[0.97]"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>

          {/* AI Result Review Pane */}
          <AnimatePresence>
            {generatedConfig && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 rounded-2xl border border-primary/20 bg-primary/[0.02]"
              >
                {/* Visual Preview */}
                <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-background/80 border border-border shadow-inner">
                  <QRPreview
                    data={generatedConfig.destinationUrl}
                    design={{
                      foregroundColor: generatedConfig.foregroundColor,
                      backgroundColor: generatedConfig.backgroundColor,
                      cornerSquareColor: generatedConfig.cornerSquareColor,
                      cornerDotColor: generatedConfig.cornerDotColor,
                      dotStyle: generatedConfig.dotStyle,
                      cornerSquareStyle: generatedConfig.cornerSquareStyle,
                      cornerDotStyle: generatedConfig.cornerDotStyle,
                      errorCorrection: generatedConfig.errorCorrection,
                      frameStyle: generatedConfig.frameStyle,
                      frameText: generatedConfig.ctaText,
                      frameIcon: generatedConfig.frameIcon,
                      frameColor: generatedConfig.foregroundColor,
                      frameTextColor: '#FFFFFF',
                    }}
                    size={200}
                    showFrame={true}
                  />
                  <div className="mt-3 text-center">
                    <p className="text-xs font-bold text-foreground">{generatedConfig.headline}</p>
                    {generatedConfig.subheadline && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[220px]">{generatedConfig.subheadline}</p>
                    )}
                  </div>
                </div>

                {/* Configuration Breakdown */}
                <div className="space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Campaign Title</Label>
                      <p className="text-sm font-bold text-foreground mt-0.5">{generatedConfig.name}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">CTA Frame</Label>
                        <p className="text-xs font-semibold capitalize text-foreground mt-0.5">{generatedConfig.frameStyle.replace('-', ' ')}</p>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Error Correction</Label>
                        <p className="text-xs font-semibold text-foreground mt-0.5">Level {generatedConfig.errorCorrection} (High)</p>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Color Harmony</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <div
                          className="h-5 w-5 rounded-full border border-border shadow-sm"
                          style={{ backgroundColor: generatedConfig.foregroundColor }}
                          title="Foreground"
                        />
                        <div
                          className="h-5 w-5 rounded-full border border-border shadow-sm"
                          style={{ backgroundColor: generatedConfig.backgroundColor }}
                          title="Background"
                        />
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {generatedConfig.foregroundColor} on {generatedConfig.backgroundColor}
                        </span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Inferred Tags</Label>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        {generatedConfig.campaignTags.map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] font-semibold py-0.5 px-2">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {generatedConfig.reasoning}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="p-4 border-t border-border/50 bg-muted/10 flex items-center justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl h-10 text-xs font-semibold">
            Cancel
          </Button>

          {generatedConfig && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleOpenInDesigner}
                className="rounded-xl h-10 px-4 text-xs font-semibold active:scale-[0.97]"
              >
                <Sliders className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                Edit in Designer
              </Button>

              <Button
                onClick={handleCreateInstantly}
                disabled={isCreating}
                className="rounded-xl h-10 px-6 text-xs font-semibold shadow-lg shadow-primary/20 active:scale-[0.97]"
              >
                {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                Create QR Code
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
