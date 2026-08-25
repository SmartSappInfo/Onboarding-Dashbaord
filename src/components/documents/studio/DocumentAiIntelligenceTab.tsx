'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Studio AI Intelligence (Studio Tab 7):
 *    Generates and applies AI summaries, topic tags, and smart CTA hotspots directly onto pages (PRD Sections 2600–2625).
 * 2. Emil Kowalski Animation Standards:
 *    Loading spinner pulses, active button scaling (`active:scale-[0.97]`), and smooth cards.
 * 3. Mobile Ergonomics & Touch Target Bounds:
 *    All buttons enforce `min-h-[44px]` touch target bounds with clear keyboard focus outlines.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  RefreshCw,
  Save,
  CheckCircle2,
  Tag,
  Clock,
  Users,
  Layers,
  ArrowRight,
  Plus,
  MousePointerClick,
  FileText,
} from 'lucide-react';
import type {
  DocumentAiSummary,
  DocumentAiCtaRecommendation,
} from '@/lib/types/document-types';
import {
  generateDocumentSummaryAction,
  recommendDocumentHotspotsAction,
  applyAiRecommendedHotspotAction,
  saveAiSummaryToDocumentMetadataAction,
} from '@/lib/documents/ai-document-actions';
import { useToast } from '@/hooks/use-toast';

interface DocumentAiIntelligenceTabProps {
  workspaceId: string;
  documentId: string;
  onHotspotApplied?: () => void;
}

export function DocumentAiIntelligenceTab({
  workspaceId,
  documentId,
  onHotspotApplied,
}: DocumentAiIntelligenceTabProps) {
  const { toast } = useToast();

  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summary, setSummary] = useState<DocumentAiSummary | null>(null);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);

  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);
  const [recommendations, setRecommendations] = useState<DocumentAiCtaRecommendation[]>([]);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const handleGenerateSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const res = await generateDocumentSummaryAction(workspaceId, documentId);
      if (res.success && res.summary) {
        setSummary(res.summary);
        toast({ title: 'AI Summary Generated', description: 'Executive summary and topic tags ready for review.' });
      } else {
        toast({ variant: 'destructive', title: 'Generation Failed', description: res.error || 'Failed to generate summary.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred.' });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleSaveToMetadata = async () => {
    if (!summary) return;
    setIsSavingMetadata(true);
    try {
      const res = await saveAiSummaryToDocumentMetadataAction(workspaceId, documentId, summary);
      if (res.success) {
        toast({ title: 'Saved to Metadata', description: 'Document description and topic tags updated.' });
      } else {
        toast({ variant: 'destructive', title: 'Save Failed', description: res.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update metadata.' });
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const handleGenerateRecommendations = async () => {
    setIsGeneratingRecommendations(true);
    try {
      const res = await recommendDocumentHotspotsAction(workspaceId, documentId);
      if (res.success && res.recommendations) {
        setRecommendations(res.recommendations);
        toast({
          title: 'Recommendations Ready',
          description: `Discovered ${res.recommendations.length} conversion opportunities in copy.`,
        });
      } else {
        toast({ variant: 'destructive', title: 'Analysis Failed', description: res.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to analyze hotspots.' });
    } finally {
      setIsGeneratingRecommendations(false);
    }
  };

  const handleApplyRecommendation = async (rec: DocumentAiCtaRecommendation) => {
    setApplyingId(rec.id);
    try {
      const res = await applyAiRecommendedHotspotAction(workspaceId, documentId, rec);
      if (res.success) {
        setAppliedIds((prev) => new Set(prev).add(rec.id));
        toast({
          title: 'Hotspot Layer Applied',
          description: `Created interactive "${rec.buttonLabel}" layer on Page ${rec.pageNumber}.`,
        });
        if (onHotspotApplied) onHotspotApplied();
      } else {
        toast({ variant: 'destructive', title: 'Application Failed', description: res.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create layer.' });
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* ── Section 1: Executive Summary & Topics ────────────────────────────── */}
      <Card className="p-6 sm:p-8 rounded-3xl border-border/60 bg-card shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-black text-foreground">AI Document Summary & Insights</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Extracts core message, audience classification, and topics from page OCR text.
            </p>
          </div>

          <Button
            onClick={handleGenerateSummary}
            disabled={isGeneratingSummary}
            className="rounded-xl h-11 px-5 font-bold text-xs gap-2 min-h-[44px] shrink-0 active:scale-[0.97] transition-all"
          >
            {isGeneratingSummary ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Analyzing Document...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Generate Summary
              </>
            )}
          </Button>
        </div>

        {summary ? (
          <div className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Executive Summary
              </label>
              <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 text-xs leading-relaxed text-foreground font-medium">
                {summary.executiveSummary}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Key Takeaways
                </label>
                <ul className="space-y-2">
                  {summary.keyTakeaways.map((item, idx) => (
                    <li key={idx} className="text-xs text-foreground/90 flex items-start gap-2 bg-muted/10 p-2.5 rounded-xl border border-border/40">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Target Audience
                  </label>
                  <div className="flex items-center gap-2 p-3 bg-muted/20 rounded-xl border border-border/50 text-xs font-bold text-foreground">
                    <Users className="h-4 w-4 text-primary shrink-0" />
                    <span>{summary.targetAudience}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Estimated Reading Duration
                  </label>
                  <div className="flex items-center gap-2 p-3 bg-muted/20 rounded-xl border border-border/50 text-xs font-bold text-foreground">
                    <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                    <span>~{summary.estimatedReadingTimeMinutes} minutes</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Extracted Topics
                  </label>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {summary.topics.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs font-bold rounded-lg px-2.5 py-1">
                        <Tag className="h-3 w-3 mr-1" /> {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button
                variant="outline"
                onClick={handleSaveToMetadata}
                disabled={isSavingMetadata}
                className="rounded-xl h-11 px-5 font-bold text-xs gap-2 min-h-[44px] active:scale-[0.97] transition-all"
              >
                {isSavingMetadata ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 text-primary" />
                )}
                Save to Document Metadata
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-muted-foreground bg-muted/10 rounded-2xl border border-dashed">
            Click "Generate Summary" above to have AI extract topics, audience classification, and highlights.
          </div>
        )}
      </Card>

      {/* ── Section 2: Smart CTA & Hotspot Placement Recommendations ─────────── */}
      <Card className="p-6 sm:p-8 rounded-3xl border-border/60 bg-card shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <MousePointerClick className="h-5 w-5 text-indigo-500" />
              <h3 className="text-lg font-black text-foreground">Smart CTA & Hotspot Recommendations</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Scans document copy for call-to-action intent (applications, phone, email, WhatsApp, calendar booking).
            </p>
          </div>

          <Button
            onClick={handleGenerateRecommendations}
            disabled={isGeneratingRecommendations}
            variant="outline"
            className="rounded-xl h-11 px-5 font-bold text-xs gap-2 min-h-[44px] shrink-0 active:scale-[0.97] transition-all"
          >
            {isGeneratingRecommendations ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Scanning Copy...
              </>
            ) : (
              <>
                <MousePointerClick className="h-4 w-4 text-indigo-500" /> Analyze CTAs
              </>
            )}
          </Button>
        </div>

        {recommendations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {recommendations.map((rec) => {
              const isApplied = appliedIds.has(rec.id);
              const isApplying = applyingId === rec.id;

              return (
                <div
                  key={rec.id}
                  className="p-5 rounded-2xl bg-muted/15 border border-border/60 space-y-3 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[11px] font-bold">
                      Page {rec.pageNumber} · {rec.suggestedLayerType.toUpperCase()}
                    </Badge>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {rec.confidenceScore}% confidence
                    </span>
                  </div>

                  <div>
                    <div className="text-sm font-black text-foreground">{rec.buttonLabel}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{rec.intentDescription}</div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-border/40">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Action: {rec.suggestedAction.type}
                    </span>

                    <Button
                      onClick={() => handleApplyRecommendation(rec)}
                      disabled={isApplied || isApplying}
                      className="rounded-xl font-bold text-xs h-11 min-h-[44px] px-4 gap-1.5 active:scale-[0.97] transition-all"
                    >
                      {isApplied ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Applied
                        </>
                      ) : isApplying ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Applying...
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" /> Apply to Page
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-muted-foreground bg-muted/10 rounded-2xl border border-dashed">
            Click "Analyze CTAs" to automatically discover conversion hotspots and apply them in 1-click.
          </div>
        )}
      </Card>
    </div>
  );
}
