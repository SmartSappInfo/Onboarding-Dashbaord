'use client';

/**
 * @fileOverview SmartSapp Media Intelligence 2.0 - Idea Canvas AI Assist Drawer
 *
 * Provides generative brainstorming tools for the Idea Canvas, generating audience pain points,
 * attention-grabbing hooks, multi-format content concepts, and recommended CTAs.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (RULE 10):
 * 1. Simple UI Copy: Uses clear, plain English without AI buzzwords.
 * 2. Non-blocking UI: Generation runs inside React's `useTransition`.
 * 3. Mobile Accessibility: Touch targets strictly satisfy `min-h-[44px] min-w-[44px]`.
 * 4. Strict Typing: Zero `any`, `any[]`, or `unknown`.
 */

import React, { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sparkles,
  Plus,
  Lightbulb,
  Users,
  Anchor,
  FileText,
  MousePointerClick,
  Loader2,
  Check,
} from 'lucide-react';
import { generateAiIdeasAction, type AiGeneratedIdeasResult } from '@/lib/media/idea-canvas-service';
import type { IdeaCanvasNodeType } from '@/lib/types/media-2.0';

export interface IdeaAiAssistPanelProps {
  canvasTitle: string;
  targetAudience: string;
  onAddNode: (type: IdeaCanvasNodeType, title: string, description?: string) => void;
  onClose?: () => void;
}

export function IdeaAiAssistPanel({
  canvasTitle,
  targetAudience,
  onAddNode,
  onClose,
}: IdeaAiAssistPanelProps) {
  const [topicPrompt, setTopicPrompt] = useState(canvasTitle || '');
  const [audiencePrompt, setAudiencePrompt] = useState(targetAudience || 'Parent Decision Makers');
  const [results, setResults] = useState<AiGeneratedIdeasResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});

  const handleGenerate = () => {
    startTransition(async () => {
      const generated = await generateAiIdeasAction(topicPrompt, audiencePrompt);
      setResults(generated);
    });
  };

  const handleAdd = (id: string, type: IdeaCanvasNodeType, title: string, desc?: string) => {
    onAddNode(type, title, desc);
    setAddedIds((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-4 sm:p-5 overflow-y-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center text-yellow-600 dark:text-yellow-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              AI Content Strategist
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Generate audience hooks, pain points, and content formats
            </p>
          </div>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] text-xs active:scale-[0.97]"
          >
            Close
          </Button>
        )}
      </div>

      {/* Input Parameters */}
      <div className="space-y-4 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Core Topic or Goal
          </Label>
          <Input
            value={topicPrompt}
            onChange={(e) => setTopicPrompt(e.target.value)}
            placeholder="e.g. Explaining school fees and payment options"
            className="min-h-[44px] text-sm bg-white dark:bg-slate-900"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Target Audience
          </Label>
          <Input
            value={audiencePrompt}
            onChange={(e) => setAudiencePrompt(e.target.value)}
            placeholder="e.g. Parents worried about fee transparency"
            className="min-h-[44px] text-sm bg-white dark:bg-slate-900"
          />
        </div>

        <Button
          onClick={handleGenerate}
          disabled={isPending || !topicPrompt.trim()}
          className="w-full min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-medium active:scale-[0.97] transition-all flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking & Structuring...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Content Strategy
            </>
          )}
        </Button>
      </div>

      {/* Results View */}
      {results && (
        <div className="space-y-6">
          {/* 1. Pain Points */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-blue-500" />
              Audience Pain Points
            </h4>
            <div className="space-y-2">
              {results.painPoints.map((item, idx) => {
                const id = `pain_${idx}`;
                const isAdded = !!addedIds[id];
                return (
                  <div
                    key={id}
                    className="flex items-start justify-between gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                  >
                    <span className="text-slate-700 dark:text-slate-300 leading-relaxed">
                      {item}
                    </span>
                    <Button
                      size="sm"
                      variant={isAdded ? 'secondary' : 'outline'}
                      disabled={isAdded}
                      onClick={() => handleAdd(id, 'topic', `Pain Point: ${item}`, item)}
                      className="min-h-[44px] min-w-[44px] px-2 text-xs shrink-0 active:scale-[0.97] flex items-center justify-center"
                      aria-label="Add pain point to canvas"
                    >
                      {isAdded ? <Check className="h-4 w-4 text-green-600" /> : <Plus className="h-4 w-4" />}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Hooks */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Anchor className="h-3.5 w-3.5 text-emerald-500" />
              Attention-Grabbing Hooks
            </h4>
            <div className="space-y-2">
              {results.hooks.map((item, idx) => {
                const id = `hook_${idx}`;
                const isAdded = !!addedIds[id];
                return (
                  <div
                    key={id}
                    className="flex items-start justify-between gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200 italic leading-relaxed">
                      {item}
                    </span>
                    <Button
                      size="sm"
                      variant={isAdded ? 'secondary' : 'outline'}
                      disabled={isAdded}
                      onClick={() => handleAdd(id, 'hook', item, 'Hook / Angle')}
                      className="min-h-[44px] min-w-[44px] px-2 text-xs shrink-0 active:scale-[0.97] flex items-center justify-center"
                      aria-label="Add hook to canvas"
                    >
                      {isAdded ? <Check className="h-4 w-4 text-green-600" /> : <Plus className="h-4 w-4" />}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Content Concepts */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-indigo-500" />
              Suggested Media Concepts
            </h4>
            <div className="space-y-2.5">
              {results.concepts.map((concept, idx) => {
                const id = `concept_${idx}`;
                const isAdded = !!addedIds[id];
                return (
                  <Card key={id} className="border-slate-200 dark:border-slate-800 shadow-none">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                          {concept.format}
                        </Badge>
                        <Button
                          size="sm"
                          variant={isAdded ? 'secondary' : 'outline'}
                          disabled={isAdded}
                          onClick={() => handleAdd(id, 'asset', concept.title, concept.description)}
                          className="min-h-[44px] min-w-[44px] px-3 text-xs active:scale-[0.97] flex items-center justify-center"
                          aria-label="Add concept to canvas"
                        >
                          {isAdded ? (
                            <>
                              <Check className="h-4 w-4 text-green-600 mr-1" /> Added
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-1" /> Add to Canvas
                            </>
                          )}
                        </Button>
                      </div>
                      <h5 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {concept.title}
                      </h5>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {concept.description}
                      </p>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <MousePointerClick className="h-3 w-3 text-rose-500" />
                        CTA: <span className="font-medium text-slate-700 dark:text-slate-300">{concept.suggestedCta}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* 4. Recommended CTAs */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <MousePointerClick className="h-3.5 w-3.5 text-rose-500" />
              Recommended CTAs
            </h4>
            <div className="space-y-2">
              {results.recommendedCtas.map((item, idx) => {
                const id = `cta_${idx}`;
                const isAdded = !!addedIds[id];
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {item}
                    </span>
                    <Button
                      size="sm"
                      variant={isAdded ? 'secondary' : 'outline'}
                      disabled={isAdded}
                      onClick={() => handleAdd(id, 'cta', item, 'Call to Action')}
                      className="min-h-[44px] min-w-[44px] px-2 text-xs shrink-0 active:scale-[0.97] flex items-center justify-center"
                      aria-label="Add CTA to canvas"
                    >
                      {isAdded ? <Check className="h-4 w-4 text-green-600" /> : <Plus className="h-4 w-4" />}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
