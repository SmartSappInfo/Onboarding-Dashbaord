'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Download,
  Upload,
  FileText,
  Code,
  Loader2,
  CheckCircle2,
  FileArchive,
  Database,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  exportWorkspaceKnowledgeAction,
  importKnowledgeArchiveAction,
} from '@/lib/quick-notes-federation-actions';
import { deserializeMarkdownArchive } from '@/lib/quick-notes-domain';
import type { KnowledgeExportPackage } from '@/lib/quick-notes-types';

interface ImportExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  organizationId: string;
  userId: string;
  userName?: string;
  onImportCompleted?: (count: number) => void;
}

export function ImportExportModal({
  open,
  onOpenChange,
  workspaceId,
  organizationId,
  userId,
  userName,
  onImportCompleted,
}: ImportExportModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState<'export' | 'import'>('export');
  const [exportFormat, setExportFormat] = React.useState<'json' | 'markdown'>('markdown');
  const [isExporting, setIsExporting] = React.useState(false);

  // Import State
  const [importFile, setImportFile] = React.useState<File | null>(null);
  const [importContent, setImportContent] = React.useState<string>('');
  const [parsedCount, setParsedCount] = React.useState<number | null>(null);
  const [isImporting, setIsImporting] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await exportWorkspaceKnowledgeAction({
        workspaceId,
        organizationId,
        userId,
      });

      if (res.success && res.data) {
        let blob: Blob;
        let filename: string;

        if (exportFormat === 'markdown') {
          blob = new Blob([res.data.markdownBundle], { type: 'text/markdown;charset=utf-8' });
          filename = `company-brain-export-${workspaceId}-${new Date().toISOString().slice(0, 10)}.md`;
        } else {
          blob = new Blob([JSON.stringify(res.data.jsonPackage, null, 2)], {
            type: 'application/json;charset=utf-8',
          });
          filename = `company-brain-backup-${workspaceId}-${new Date().toISOString().slice(0, 10)}.json`;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: 'Export Downloaded',
          description: `Successfully exported ${res.data.fileCount} knowledge files in ${exportFormat.toUpperCase()} format.`,
        });
        onOpenChange(false);
      } else {
        toast({
          title: 'Export Failed',
          description: res.error || 'Failed to generate export bundle',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Unknown error during export',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportContent(text);

      if (file.name.endsWith('.json')) {
        try {
          const pkg = JSON.parse(text) as KnowledgeExportPackage;
          setParsedCount(pkg.notes?.length || 0);
        } catch {
          setParsedCount(0);
          toast({ title: 'Invalid JSON', description: 'File is not a valid JSON package', variant: 'destructive' });
        }
      } else {
        // Markdown archive
        const parsed = deserializeMarkdownArchive(text);
        setParsedCount(parsed.length);
      }
    };

    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importContent || !importFile) return;

    setIsImporting(true);
    try {
      let res;
      if (importFile.name.endsWith('.json')) {
        const pkg = JSON.parse(importContent) as KnowledgeExportPackage;
        res = await importKnowledgeArchiveAction({
          workspaceId,
          userId,
          userName,
          jsonPackage: pkg,
        });
      } else {
        res = await importKnowledgeArchiveAction({
          workspaceId,
          userId,
          userName,
          rawMarkdown: importContent,
        });
      }

      if (res.success && res.data) {
        toast({
          title: 'Import Completed',
          description: `Successfully ingested ${res.data.importedCount} knowledge records into this workspace.`,
        });
        onImportCompleted?.(res.data.importedCount);
        onOpenChange(false);
        setImportFile(null);
        setImportContent('');
        setParsedCount(null);
      } else {
        toast({
          title: 'Import Failed',
          description: res.error || 'Failed to import archive',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Unknown error during import',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg rounded-2xl p-5 sm:p-6">
        <DialogHeader className="space-y-1 pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
              <Database className="h-4.5 w-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                Bulk Knowledge Import & Export
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Lossless data archiving, migration, and offline Markdown backup.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'export' | 'import')} className="pt-2">
          <TabsList className="grid grid-cols-2 h-9 rounded-xl bg-muted/60 p-0.5">
            <TabsTrigger value="export" className="text-xs rounded-lg">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export Archive
            </TabsTrigger>
            <TabsTrigger value="import" className="text-xs rounded-lg">
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Import Archive
            </TabsTrigger>
          </TabsList>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4 pt-3">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">Select Export Format</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setExportFormat('markdown')}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                    exportFormat === 'markdown'
                      ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-border/80'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <FileText className="h-4 w-4 text-blue-500" />
                    Markdown Bundle (.md)
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Standard YAML frontmatter. Human-readable & Notion/Obsidian compatible.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setExportFormat('json')}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                    exportFormat === 'json'
                      ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-border/80'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Code className="h-4 w-4 text-purple-500" />
                    JSON Backup (.json)
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Full structured database schema with all categories, ideas, and battlecards.
                  </p>
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-1 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Export Scope Includes:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                <li>All Workspace Quick Notes & Categories</li>
                <li>Strategic Ideas, Assumptions & Hypotheses</li>
                <li>Objection Battlecards & Rebuttal Scripts</li>
                <li>Strategic Knowledge Insights & Trends</li>
              </ul>
            </div>

            <DialogFooter className="pt-2 border-t border-border/60">
              <Button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="w-full h-9 rounded-xl text-xs font-semibold bg-primary text-primary-foreground min-h-[44px] sm:min-h-[36px]"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Generating Archive...
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Download {exportFormat.toUpperCase()} Archive
                  </>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-4 pt-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".md,.markdown,.json"
              className="hidden"
            />

            {!importFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-border/80 hover:border-primary/60 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-2 bg-muted/10 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <FileArchive className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Click to upload Markdown or JSON archive</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Supports .md (with frontmatter) or .json schema export</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs font-bold text-foreground truncate max-w-[200px]">{importFile.name}</p>
                      <p className="text-[10px] text-muted-foreground">{(importFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setImportFile(null);
                      setImportContent('');
                      setParsedCount(null);
                    }}
                    className="text-xs h-7 rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    Change
                  </Button>
                </div>

                {parsedCount !== null && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Parsed {parsedCount} document(s) ready for workspace ingestion.</span>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="pt-2 border-t border-border/60">
              <Button
                type="button"
                onClick={handleImport}
                disabled={isImporting || !importFile || parsedCount === 0}
                className="w-full h-9 rounded-xl text-xs font-semibold bg-primary text-primary-foreground min-h-[44px] sm:min-h-[36px]"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Ingesting Documents...
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Commit Ingestion ({parsedCount ?? 0} Docs)
                  </>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
