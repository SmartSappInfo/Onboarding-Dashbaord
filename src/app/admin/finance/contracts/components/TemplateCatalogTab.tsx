'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Template Catalog Tab for Agreements Hub (Phase 3 Task 9).
 * 2. Visual Invariants & Everyday Microcopy (Rule 7 Minimal Text):
 *    Surfaces reusable approved document templates with version pills,
 *    document type tags, and direct actions ("Issue Agreement", "Edit in Studio").
 * 3. Emil Kowalski Micro-Interactions:
 *    Tactile button depressions via `active:scale-[0.97]` and card hover elevations.
 * 4. Strict Typing Standard (Rule 4 Zero-Tolerance Typing):
 *    Strictly zero `any`.
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FileText,
  Search,
  Plus,
  Edit,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { PDFForm } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface TemplateCatalogTabProps {
  workspaceId: string;
  onIssueAgreement?: (templateId: string) => void;
  className?: string;
}

export default function TemplateCatalogTab({
  workspaceId,
  onIssueAgreement,
  className,
}: TemplateCatalogTabProps) {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = React.useState('');

  // Fetch templates for current workspace
  const templatesQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(
      collection(firestore, 'pdfs'),
      where('workspaceIds', 'array-contains', workspaceId)
    );
  }, [firestore, workspaceId]);

  const { data: rawTemplates, isLoading } = useCollection<PDFForm>(templatesQuery);
  const templates = React.useMemo(() => rawTemplates || [], [rawTemplates]);

  const filteredTemplates = React.useMemo(() => {
    return templates.filter((tmpl) => {
      const matchSearch =
        searchTerm === '' ||
        tmpl.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tmpl.publicTitle?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchSearch;
    });
  }, [templates, searchTerm]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search templates..."
            className="pl-9 text-xs min-h-[44px] sm:min-h-[38px] rounded-xl"
          />
        </div>

        <Button
          asChild
          size="sm"
          className="w-full sm:w-auto min-h-[44px] sm:min-h-[38px] px-4 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97]"
        >
          <Link href="/admin/pdfs/new">
            <Plus className="w-4 h-4 mr-1.5" />
            Upload New Template
          </Link>
        </Button>
      </div>

      {/* Grid of Templates */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-muted/40 animate-pulse border" />
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-border/80 p-8 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto text-muted-foreground">
            <FileText className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-foreground">No templates found</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Upload your first standard agreement or legal contract template to start generating enforceable documents.
          </p>
          <Button asChild size="sm" className="mt-2 min-h-[44px] sm:min-h-[36px]">
            <Link href="/admin/pdfs/new">
              <Plus className="w-4 h-4 mr-1.5" />
              Create Template
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => {
            const isPublished = template.status === 'published';
            const isDraft = template.status === 'draft';

            return (
              <Card
                key={template.id}
                className="rounded-2xl border border-border shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group bg-card"
              >
                <CardContent className="p-5 space-y-4">
                  {/* Header badges */}
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                        isPublished && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
                        isDraft && 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                      )}
                    >
                      {isPublished ? 'Published' : 'Draft Revision'}
                    </Badge>

                    {template.isContractDocument && (
                      <Badge variant="secondary" className="text-[10px]">
                        Standard Contract
                      </Badge>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {template.name || template.publicTitle || 'Untitled Template'}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {template.publicTitle || 'Reusable document template for institutional agreements.'}
                    </p>
                  </div>

                  {/* Fields info */}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3 text-muted-foreground/70" />
                      {template.fields?.length || 0} fields
                    </span>
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-muted-foreground/70" />
                      Vector Signed
                    </span>
                  </div>
                </CardContent>

                {/* Footer Actions */}
                <div className="px-5 py-3 bg-muted/20 border-t border-border/50 flex items-center justify-between gap-2">
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground active:scale-[0.97]"
                  >
                    <Link href={`/admin/pdfs/${template.id}/edit`}>
                      <Edit className="w-3.5 h-3.5 mr-1" />
                      Studio
                    </Link>
                  </Button>

                  {onIssueAgreement && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onIssueAgreement(template.id)}
                      className="h-8 px-3 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97]"
                    >
                      Issue Agreement
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
