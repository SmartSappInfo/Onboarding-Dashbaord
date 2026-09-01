'use client';

/**
 * SmartSapp Forms 2.0: Studio Page Manager Component
 * 
 * Enables multi-page journey authoring in Form Studio (Step 2 Builder).
 * Supports page creation, reordering, metadata editing (title & description),
 * and moving fields between pages.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  PlusCircle,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Layers,
  ArrowUpDown,
  FileText,
  Copy,
} from 'lucide-react';
import type { FormPage, FormComponent } from '@/lib/forms/form-types';
import type { FormFieldInstance, AppField } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PageManagerProps {
  pages: FormPage[];
  activePageId: string;
  onActivePageChange: (pageId: string) => void;
  onPagesChange: (pages: FormPage[]) => void;
  fields: FormFieldInstance[];
  getAppField: (appFieldId: string) => AppField | undefined;
}

export default function PageManager({
  pages,
  activePageId,
  onActivePageChange,
  onPagesChange,
  fields,
  getAppField,
}: PageManagerProps) {
  const [editingPage, setEditingPage] = React.useState<FormPage | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [pageTitle, setPageTitle] = React.useState('');
  const [pageDescription, setPageDescription] = React.useState('');

  const activePageIndex = Math.max(0, pages.findIndex(p => p.id === activePageId));

  const handleAddPage = () => {
    const newPageId = `page_${Date.now().toString(36)}`;
    const newPageNumber = pages.length + 1;
    const newPage: FormPage = {
      id: newPageId,
      title: `Page ${newPageNumber}`,
      description: `Step ${newPageNumber} of your application`,
      order: pages.length,
      components: [],
    };
    const updated = [...pages, newPage];
    onPagesChange(updated);
    onActivePageChange(newPageId);
  };

  const handleOpenEditModal = (page: FormPage) => {
    setEditingPage(page);
    setPageTitle(page.title || '');
    setPageDescription(page.description || '');
    setIsEditModalOpen(true);
  };

  const handleSavePageMetadata = () => {
    if (!editingPage) return;
    const updated = pages.map(p =>
      p.id === editingPage.id
        ? { ...p, title: pageTitle.trim() || p.title, description: pageDescription.trim() }
        : p
    );
    onPagesChange(updated);
    setIsEditModalOpen(false);
    setEditingPage(null);
  };

  const handleDeletePage = (pageId: string) => {
    if (pages.length <= 1) return; // Keep at least 1 page
    const pageToDelete = pages.find(p => p.id === pageId);
    const remainingPages = pages.filter(p => p.id !== pageId);

    // Re-order remaining pages and migrate orphan components to the first page with normalized sequential orders
    const componentsToMigrate = pageToDelete?.components || [];
    if (componentsToMigrate.length > 0 && remainingPages.length > 0) {
      const baseOrder = remainingPages[0].components.length;
      const normalizedMigrated = componentsToMigrate.map((c, i) => ({ ...c, order: baseOrder + i }));
      remainingPages[0].components = [...remainingPages[0].components, ...normalizedMigrated];
    }

    const reindexed = remainingPages.map((p, idx) => ({ ...p, order: idx }));
    onPagesChange(reindexed);
    if (activePageId === pageId) {
      const fallbackId = reindexed[0] ? reindexed[0].id : '';
      onActivePageChange(fallbackId);
    }
  };

  const handleMovePage = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= pages.length) return;

    const updated = [...pages];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);

    const reindexed = updated.map((p, idx) => ({ ...p, order: idx }));
    onPagesChange(reindexed);
  };

  return (
    <div className="space-y-4">
      {/* Top Page Navigation Strip */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2 scrollbar-thin">
        <div className="flex items-center gap-2">
          {pages.map((page, idx) => {
            const isActive = page.id === activePageId;
            const fieldCount = page.components.length;

            return (
              <div
                key={page.id}
                onClick={() => onActivePageChange(page.id)}
                className={cn(
                  "flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border transition-all cursor-pointer select-none text-xs shrink-0",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                    : "bg-muted/40 hover:bg-muted/70 border-border text-foreground"
                )}
              >
                <span className={cn(
                  "h-5 w-5 rounded-lg flex items-center justify-center font-bold text-[10px]",
                  isActive ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                )}>
                  {idx + 1}
                </span>

                <span className="font-semibold truncate max-w-[140px]">
                  {page.title || `Page ${idx + 1}`}
                </span>

                <Badge
                  variant={isActive ? "secondary" : "outline"}
                  className="h-4 px-1.5 text-[9px] font-bold rounded-md"
                >
                  {fieldCount} {fieldCount === 1 ? 'field' : 'fields'}
                </Badge>

                {isActive && (
                  <div className="flex items-center gap-0.5 ml-1" onClick={e => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEditModal(page)}
                      className="h-6 w-6 rounded-lg text-primary-foreground/80 hover:text-white hover:bg-white/10"
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>

                    {idx > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMovePage(idx, -1)}
                        className="h-6 w-6 rounded-lg text-primary-foreground/80 hover:text-white hover:bg-white/10"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                    )}

                    {idx < pages.length - 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMovePage(idx, 1)}
                        className="h-6 w-6 rounded-lg text-primary-foreground/80 hover:text-white hover:bg-white/10"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    )}

                    {pages.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeletePage(page.id)}
                        className="h-6 w-6 rounded-lg text-primary-foreground/80 hover:text-rose-200 hover:bg-rose-500/20"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Page Button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddPage}
          className="h-9 px-3 rounded-2xl text-xs font-bold gap-1.5 shrink-0"
        >
          <PlusCircle className="h-3.5 w-3.5 text-primary" />
          <span>Add Page</span>
        </Button>
      </div>

      {/* Edit Page Metadata Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" /> Edit Page Settings
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure page title and instructions visible to respondents.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Page Title</Label>
              <Input
                value={pageTitle}
                onChange={e => setPageTitle(e.target.value)}
                placeholder="e.g. Personal Details"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Page Subtitle / Instructions (Optional)</Label>
              <Input
                value={pageDescription}
                onChange={e => setPageDescription(e.target.value)}
                placeholder="e.g. Please provide your contact details for enrollment"
                className="h-10 text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              className="rounded-xl font-bold text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSavePageMetadata}
              className="rounded-xl font-bold text-xs"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
