'use client';

/**
 * @fileOverview Knowledge Candidate Card (Phase 4 Milestone 4)
 *
 * Implements PRD §62 & §93 (Candidate Triage), Rule 7 (Mobile Touch Friendly),
 * Rule 22 (SHA-256 Hash Display), and Rule 64 (Tactile Micro-Interactions).
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  XCircle,
  Eye,
  Fingerprint,
  Calendar,
  Layers,
} from 'lucide-react';
import type { CanonicalMemoryObject } from '@/platform/memory';

export interface KnowledgeCandidateCardProps {
  item: CanonicalMemoryObject;
  onInspect: (item: CanonicalMemoryObject) => void;
  onVerify?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
  isProcessing?: boolean;
}

export function KnowledgeCandidateCard({
  item,
  onInspect,
  onVerify,
  onReject,
  isProcessing = false,
}: KnowledgeCandidateCardProps) {
  const hash = item.source?.sourceHash || item.provenance?.sourceHash || item.id;
  const shortHash = hash.length > 12 ? `${hash.slice(0, 6)}...${hash.slice(-4)}` : hash;
  const confidencePercent = Math.round(item.confidence * 100);

  const isVerified = item.verification === 'user_confirmed' || item.verification === 'source_verified';
  const isInvalidated = item.verification === 'invalidated';

  return (
    <Card className="border border-border/80 bg-card hover:border-border transition-all duration-200 shadow-sm rounded-xl overflow-hidden group">
      <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full space-y-3">
        {/* Top Meta Line */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="font-mono text-[10px] uppercase py-0 h-5">
              <Layers className="h-2.5 w-2.5 mr-1" />
              {item.tier}
            </Badge>
            <Badge variant="secondary" className="capitalize text-[10px] py-0 h-5">
              {item.source.type.replace('_', ' ')}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
              <Fingerprint className="h-3 w-3" />
              <span>{shortHash}</span>
            </div>
            <span className="text-[11px] font-semibold text-primary font-mono">
              {confidencePercent}%
            </span>
          </div>
        </div>

        {/* Title & Excerpt */}
        <div className="space-y-1">
          <h4 className="text-sm sm:text-base font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
            {item.title || `${item.type.toUpperCase()} from ${item.source.type}`}
          </h4>
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {item.content}
          </p>
        </div>

        {/* Date & Action Buttons */}
        <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{new Date(item.createdAt).toLocaleDateString()}</span>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onInspect(item)}
              className="min-h-[44px] sm:min-h-[32px] sm:h-8 px-2.5 text-xs rounded-lg active:scale-[0.97]"
            >
              <Eye className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              Inspect
            </Button>

            {onReject && !isInvalidated && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isProcessing}
                onClick={() => void onReject(item.id)}
                className="min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px] sm:h-8 px-2 text-xs rounded-lg text-destructive hover:bg-destructive/10 active:scale-[0.97]"
              >
                <XCircle className="h-3.5 w-3.5" />
                <span className="sr-only">Reject</span>
              </Button>
            )}

            {onVerify && !isVerified && (
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={isProcessing}
                onClick={() => void onVerify(item.id)}
                className="min-h-[44px] sm:min-h-[32px] sm:h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg active:scale-[0.97]"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Verify
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
