'use client';

/**
 * @fileoverview SmartSapp Survey Intelligence 2.0 — Unified AI Survey Architect Studio
 *
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Unified Multi-Modal Surface: Replaces fractured tab silos (text vs url vs file) with an integrated
 *    omni-prompt composer accepting prompts, attached documents (PDF/TXT/MD/CSV/JSON), and reference links.
 * 2. Client-Side Extraction Guardrails: Automatically extracts document text client-side with 10MB/20-page/25k char caps.
 * 3. Compact Docked Model Control: Binds directly to active workspace model tier via <AiModelSelector>.
 * 4. Micro-Interactions & Ergonomics: min-h-[44px] touch targets, active:scale-[0.97] tactile press,
 *    and keyboard execution (Cmd+Enter / Ctrl+Enter).
 * 5. Session Resilience: Autosaves draft prompt and settings to sessionStorage to prevent accidental data loss.
 * 6. Strict Zero-Any Invariant: Completely typed interfaces for props, payloads, and handlers.
 */

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Sparkles,
  Paperclip,
  Link2,
  FileText,
  X,
  Loader2,
  SlidersHorizontal,
  ArrowRight,
  Globe,
  RotateCcw,
  Layers,
  Award,
  UploadCloud,
} from 'lucide-react';
import { RainbowButton } from '@/components/ui/rainbow-button';
import AiModelSelector from '@/components/ai/AiModelSelector';
import { cn } from '@/lib/utils';
import {
  type AttachedSourceFile,
  type AttachedSourceUrl,
  type ArchitectIntentConfig,
  type ArchitectSurveyDepth,
  type ArchitectScoringMode,
  type ArchitectUnifiedPayload,
  ARCHETYPE_PRESETS,
  type ArchetypePreset,
  categorizeFileType,
  extractTextFromFile,
  validateAndParseUrl,
  formatUnifiedArchitectEnvelope,
} from '@/lib/surveys/survey-source-extractor';
import type { SystemAiArchitectGovernanceConfig } from '@/lib/surveys/survey-ai-architect-governance-actions';

const DRAFT_STORAGE_KEY = 'smartsapp_ai_survey_studio_draft';

export interface UnifiedAiArchitectStudioProps {
  isGenerating: boolean;
  onSubmit: (payload: {
    prompt: string;
    finalEnvelope: string;
    attachedFiles: AttachedSourceFile[];
    attachedUrls: AttachedSourceUrl[];
    intent: ArchitectIntentConfig;
  }) => void | Promise<void>;
  onCancel?: () => void;
  governanceConfig?: SystemAiArchitectGovernanceConfig;
  className?: string;
}

export function UnifiedAiArchitectStudio({
  isGenerating,
  onSubmit,
  onCancel,
  governanceConfig,
  className,
}: UnifiedAiArchitectStudioProps) {
  const { toast } = useToast();

  // Primary state
  const [prompt, setPrompt] = React.useState('');
  const [intent, setIntent] = React.useState<ArchitectIntentConfig>({
    depth: 'standard',
    scoringMode: 'auto',
    tone: 'professional',
  });
  const [attachedFiles, setAttachedFiles] = React.useState<AttachedSourceFile[]>([]);
  const [attachedUrls, setAttachedUrls] = React.useState<AttachedSourceUrl[]>([]);

  // UI interaction state
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = React.useState(false);
  const [rawLinkInput, setRawLinkInput] = React.useState('');
  const [linkInputError, setLinkInputError] = React.useState<string | null>(null);
  const [isPolishingPrompt, setIsPolishingPrompt] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const polishTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Unmount cleanup for polish timer
  React.useEffect(() => {
    return () => {
      if (polishTimerRef.current) {
        clearTimeout(polishTimerRef.current);
      }
    };
  }, []);

  // Restore draft from sessionStorage on mount
  React.useEffect(() => {
    try {
      const stored = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as {
          prompt?: string;
          intent?: ArchitectIntentConfig;
          attachedUrls?: AttachedSourceUrl[];
        };
        if (parsed.prompt) setPrompt(parsed.prompt);
        if (parsed.intent) setIntent(parsed.intent);
        if (Array.isArray(parsed.attachedUrls)) setAttachedUrls(parsed.attachedUrls);
      }
    } catch (e: unknown) {
      console.warn('[UnifiedAiArchitectStudio] Could not restore draft from session storage:', e);
    }
  }, []);

  // Autosave to sessionStorage on updates
  React.useEffect(() => {
    try {
      const draft = {
        prompt,
        intent,
        attachedUrls,
      };
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignore quota errors
    }
  }, [prompt, intent, attachedUrls]);

  // Filter archetypes based on governance configuration if provided
  const activeArchetypes = React.useMemo(() => {
    if (!governanceConfig?.enabledArchetypeIds?.length) {
      return ARCHETYPE_PRESETS;
    }
    return ARCHETYPE_PRESETS.filter((preset) =>
      governanceConfig.enabledArchetypeIds.includes(preset.id)
    );
  }, [governanceConfig]);

  // Handle file uploads with client-side extraction
  const handleFilesAdded = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (!fileArray.length) return;

    for (const file of fileArray) {
      const mappedType = categorizeFileType(file);
      if (mappedType === 'other') {
        toast({
          variant: 'destructive',
          title: 'Unsupported File Format',
          description: `"${file.name}" cannot be parsed. Please attach PDF, Markdown, TXT, CSV, or JSON documents.`,
        });
        continue;
      }

      const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Insert placeholder extracting item
      const newFileItem: AttachedSourceFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: mappedType,
        charCount: 0,
        content: '',
        status: 'extracting',
      };

      setAttachedFiles((prev) => [...prev, newFileItem]);

      try {
        const extracted = await extractTextFromFile(file, {
          maxFileSizeMb: governanceConfig?.maxFileUploadSizeMb ?? 10,
          maxPdfPages: governanceConfig?.maxPdfPagesLimit ?? 20,
          maxCharsPerFile: governanceConfig?.maxSourceCharacterLimit ?? 25000,
        });

        setAttachedFiles((prev) =>
          prev.map((item) =>
            item.id === fileId
              ? {
                  ...item,
                  status: 'ready',
                  content: extracted.content,
                  charCount: extracted.charCount,
                  pageCount: extracted.pageCount,
                }
              : item
          )
        );

        toast({
          title: `Attached "${file.name}"`,
          description: `Extracted ${extracted.charCount.toLocaleString()} characters${
            extracted.pageCount ? ` across ${extracted.pageCount} pages` : ''
          }.`,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to extract text';
        setAttachedFiles((prev) =>
          prev.map((item) =>
            item.id === fileId
              ? {
                  ...item,
                  status: 'error',
                  errorMessage: msg,
                }
              : item
          )
        );
        toast({
          variant: 'destructive',
          title: 'Extraction Error',
          description: msg,
        });
      }
    }
  };

  const removeFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Handle adding reference URL
  const handleAddUrl = () => {
    setLinkInputError(null);
    const parsed = validateAndParseUrl(rawLinkInput);

    if (!parsed.isValid) {
      setLinkInputError(parsed.error || 'Please enter a valid web URL.');
      return;
    }

    // Prevent duplicate URLs
    if (attachedUrls.some((u) => u.url === parsed.normalizedUrl)) {
      setLinkInputError('This URL has already been attached.');
      return;
    }

    const newUrlItem: AttachedSourceUrl = {
      id: `url_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      url: parsed.normalizedUrl,
      domain: parsed.domain,
    };

    setAttachedUrls((prev) => [...prev, newUrlItem]);
    setRawLinkInput('');
    setIsLinkPopoverOpen(false);

    toast({
      title: 'Reference URL Added',
      description: `Added ${parsed.domain} as reference material.`,
    });
  };

  const removeUrl = (id: string) => {
    setAttachedUrls((prev) => prev.filter((u) => u.id !== id));
  };

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFilesAdded(e.dataTransfer.files);
    }
  };

  // Archetype selection
  const handleApplyArchetype = (preset: ArchetypePreset) => {
    const currentPrompt = prompt.trim();
    if (currentPrompt && !currentPrompt.includes(preset.promptSeed)) {
      setPrompt(`${currentPrompt}\n\n[Archetype Directive: ${preset.title}]\n${preset.promptSeed}`);
    } else {
      setPrompt(preset.promptSeed);
    }
    setIntent((prev) => ({
      ...prev,
      depth: preset.defaultDepth,
      scoringMode: preset.defaultScoring,
    }));

    toast({
      title: `Applied "${preset.title}" Archetype`,
      description: 'Loaded architectural directives and question depth.',
    });

    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Prompt polisher assistant
  const handlePolishPrompt = () => {
    if (!prompt.trim()) {
      toast({
        title: 'Empty Prompt',
        description: 'Type a brief summary of what you need before polishing.',
      });
      return;
    }

    if (polishTimerRef.current) {
      clearTimeout(polishTimerRef.current);
    }

    setIsPolishingPrompt(true);
    polishTimerRef.current = setTimeout(() => {
      const trimmed = prompt.trim();
      const polished = `Create a structured, enterprise-grade survey based on the following requirements:\n\n${trimmed}\n\nKey Requirements:\n- Group questions into coherent thematic sections with clear stepper titles.\n- Include appropriate response scales (Likert, Multi-choice, Rating) and helpful description tips.\n- Establish logical branching between sections where applicable.\n- Provide an engaging completion message and actionable summary.`;
      setPrompt(polished);
      setIsPolishingPrompt(false);
      toast({
        title: 'Prompt Polished ✨',
        description: 'Added structured sections, scale guidance, and logic directives.',
      });
    }, 450);
  };

  const hasExtractingFiles = attachedFiles.some((f) => f.status === 'extracting');

  // Form submission handler
  const handleExecute = () => {
    if (hasExtractingFiles) {
      toast({
        title: 'Documents Still Extracting',
        description: 'Please wait a moment while your attached files finish parsing.',
      });
      return;
    }

    const trimmedPrompt = prompt.trim();
    const hasFiles = attachedFiles.some((f) => f.status === 'ready');
    const hasUrls = attachedUrls.length > 0;

    if (!trimmedPrompt && !hasFiles && !hasUrls) {
      toast({
        variant: 'destructive',
        title: 'Input Required',
        description: 'Please provide prompt directives, attach documents, or add reference URLs.',
      });
      return;
    }

    const payload: ArchitectUnifiedPayload = {
      prompt: trimmedPrompt,
      attachedFiles,
      attachedUrls,
      intent,
    };

    const finalEnvelope = formatUnifiedArchitectEnvelope(payload);

    // Clear session storage on successful start
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // Ignore
    }

    void onSubmit({
      prompt: trimmedPrompt,
      finalEnvelope,
      attachedFiles,
      attachedUrls,
      intent,
    });
  };

  // Keyboard shortcut listener (Cmd+Enter or Ctrl+Enter)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isGenerating && !hasExtractingFiles) {
        handleExecute();
      }
    }
  };

  const isExecutingDisabled =
    isGenerating ||
    hasExtractingFiles ||
    (!prompt.trim() && !attachedFiles.some((f) => f.status === 'ready') && attachedUrls.length === 0);

  return (
    <Card
      className={cn(
        'max-w-4xl mx-auto shadow-2xl border border-border/80 bg-card/60 backdrop-blur-xl rounded-[2.25rem] overflow-hidden transition-all',
        className
      )}
    >
      <CardHeader className="p-6 sm:p-8 pb-5 border-b border-border/50 bg-gradient-to-b from-primary/[0.03] to-transparent text-left relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 w-11 h-11 rounded-2xl flex items-center justify-center border border-primary/20 shadow-inner shrink-0">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                AI Survey Architect Studio
                <Badge
                  variant="outline"
                  className="hidden sm:inline-flex text-[10px] font-bold uppercase tracking-wider text-primary border-primary/30 bg-primary/5"
                >
                  Unified 2.0
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm font-medium text-muted-foreground mt-0.5">
                Synthesize text briefs, uploaded files, and web references into complete survey engines.
              </CardDescription>
            </div>
          </div>

          {prompt && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setPrompt('');
                setAttachedFiles([]);
                setAttachedUrls([]);
                sessionStorage.removeItem(DRAFT_STORAGE_KEY);
              }}
              className="text-xs text-muted-foreground hover:text-destructive h-9 px-3 rounded-xl active:scale-[0.97] self-end sm:self-auto gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Canvas
            </Button>
          )}
        </div>

        {/* Quick-Start Archetype Strip */}
        <div className="mt-6 pt-4 border-t border-border/40">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" />
              Quick-Start Archetypes
            </span>
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              Click to load directives & structure
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none -mx-1 px-1">
            {activeArchetypes.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyArchetype(preset)}
                className="shrink-0 min-h-[44px] px-3.5 rounded-xl border border-border/70 bg-background/60 hover:bg-accent hover:border-primary/40 text-xs font-semibold text-foreground transition-all duration-200 active:scale-[0.97] flex items-center gap-2 shadow-xs group"
              >
                <span className="text-[10px] font-bold text-primary group-hover:text-primary transition-colors">
                  {preset.badge}
                </span>
                <span className="text-muted-foreground">·</span>
                <span>{preset.title}</span>
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 sm:p-8 space-y-5">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            if (e.target.files) {
              void handleFilesAdded(e.target.files);
              e.target.value = '';
            }
          }}
          multiple
          accept=".pdf,.txt,.md,.markdown,.csv,.json,.tsv"
          className="hidden"
        />

        {/* Omni-Prompt Composer Surface */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'relative rounded-[1.75rem] border transition-all duration-200 bg-background/40 backdrop-blur-sm overflow-hidden group shadow-inner',
            isDraggingOver
              ? 'border-dashed border-2 border-primary bg-primary/[0.05] ring-4 ring-primary/10'
              : 'border-border/60 hover:border-border focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20'
          )}
        >
          {isDraggingOver ? (
            <div className="flex flex-col items-center justify-center p-12 text-center pointer-events-none">
              <UploadCloud className="h-10 w-10 text-primary animate-bounce mb-3" />
              <p className="text-sm font-bold text-foreground">Drop documents here to attach</p>
              <p className="text-xs text-muted-foreground mt-1">
                Extracts text from PDF, Markdown, Plain Text, CSV, or JSON
              </p>
            </div>
          ) : (
            <>
              <Textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your survey objectives, paste a document outline, paste a syllabus, or specify target criteria... (Tip: Drag & drop PDF/text documents directly here)"
                className="w-full min-h-[160px] sm:min-h-[190px] p-5 sm:p-6 text-sm sm:text-base leading-relaxed bg-transparent border-0 resize-none focus-visible:ring-0 shadow-none text-foreground placeholder:text-muted-foreground/70"
              />

              {/* Attached Sources Badges Shelf */}
              {(attachedFiles.length > 0 || attachedUrls.length > 0) && (
                <div className="px-5 pb-4 pt-1 flex flex-wrap gap-2 border-t border-border/40 bg-muted/20">
                  {attachedFiles.map((file) => (
                    <div
                      key={file.id}
                      className={cn(
                        'flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl border text-xs font-medium transition-all shadow-xs',
                        file.status === 'ready'
                          ? 'bg-background border-border text-foreground'
                          : file.status === 'extracting'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                          : 'bg-destructive/10 border-destructive/30 text-destructive'
                      )}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="max-w-[160px] truncate font-semibold">{file.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {(file.size / 1024).toFixed(0)}KB
                      </span>
                      {file.status === 'extracting' && (
                        <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
                      )}
                      {file.status === 'ready' && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                          {file.charCount.toLocaleString()}c
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(file.id)}
                        className="h-6 w-6 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {attachedUrls.map((urlItem) => (
                    <div
                      key={urlItem.id}
                      className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl border border-border bg-background text-xs font-medium shadow-xs"
                    >
                      <Globe className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                      <span className="max-w-[180px] truncate font-semibold text-foreground">
                        {urlItem.domain}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeUrl(urlItem.id)}
                        className="h-6 w-6 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all"
                        aria-label={`Remove ${urlItem.domain}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Secondary In-Box Intent Controls */}
              <div className="px-5 py-3 border-t border-border/40 bg-muted/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Depth Pill */}
                  <div className="flex items-center gap-1.5 bg-background border border-border/60 rounded-xl px-2.5 py-1 shadow-xs">
                    <SlidersHorizontal className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[11px] font-semibold text-muted-foreground">Depth:</span>
                    <select
                      aria-label="Select Target Survey Depth"
                      value={intent.depth}
                      onChange={(e) =>
                        setIntent((prev) => ({
                          ...prev,
                          depth: e.target.value as ArchitectSurveyDepth,
                        }))
                      }
                      className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer"
                    >
                      <option value="compact">Compact (3–5 Qs)</option>
                      <option value="standard">Standard (6–10 Qs)</option>
                      <option value="in_depth">In-Depth (11–15+ Qs)</option>
                    </select>
                  </div>

                  {/* Scoring Mode Pill */}
                  <div className="flex items-center gap-1.5 bg-background border border-border/60 rounded-xl px-2.5 py-1 shadow-xs">
                    <Award className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[11px] font-semibold text-muted-foreground">Mode:</span>
                    <select
                      aria-label="Select Survey Scoring Mode"
                      value={intent.scoringMode}
                      onChange={(e) =>
                        setIntent((prev) => ({
                          ...prev,
                          scoringMode: e.target.value as ArchitectScoringMode,
                        }))
                      }
                      className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer"
                    >
                      <option value="auto">Auto-Detect</option>
                      <option value="scored">Scored Quiz / Exam</option>
                      <option value="feedback">Feedback / Rating</option>
                    </select>
                  </div>
                </div>

                <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-2 ml-auto">
                  <span>{prompt.length.toLocaleString()} chars</span>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">Cmd+Enter to run</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Docked Command Bar */}
        <div className="pt-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left Action Cluster: Model Pill, Attach, Add Link, Polish */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Integrated Workspace Model Selector */}
            <div className="w-full sm:w-auto">
              <AiModelSelector hideLabel={true} className="w-full sm:max-w-[240px]" />
            </div>

            {/* Attach Document Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-11 px-3.5 rounded-2xl border-border/80 font-semibold text-xs gap-2 active:scale-[0.97] transition-all hover:bg-accent shadow-xs"
            >
              <Paperclip className="h-4 w-4 text-primary" />
              <span>Attach Doc</span>
            </Button>

            {/* Add Link Popover */}
            <Popover open={isLinkPopoverOpen} onOpenChange={setIsLinkPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 px-3.5 rounded-2xl border-border/80 font-semibold text-xs gap-2 active:scale-[0.97] transition-all hover:bg-accent shadow-xs"
                >
                  <Link2 className="h-4 w-4 text-blue-500" />
                  <span>Add Link</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4 rounded-2xl shadow-xl space-y-3" align="start">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-foreground">Add Reference URL</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Link to a public guideline, rubric, or article to parse.
                  </p>
                </div>
                <div className="space-y-2">
                  <Input
                    placeholder="https://company.org/values"
                    value={rawLinkInput}
                    onChange={(e) => setRawLinkInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddUrl();
                      }
                    }}
                    className="h-10 text-xs rounded-xl"
                  />
                  {linkInputError && (
                    <p className="text-[11px] text-destructive font-medium">{linkInputError}</p>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddUrl}
                    className="w-full h-10 rounded-xl text-xs font-bold active:scale-[0.97]"
                  >
                    Attach URL
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Polish Prompt Button */}
            {governanceConfig?.enablePromptPolishCopilot !== false && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePolishPrompt}
                disabled={isPolishingPrompt || !prompt.trim()}
                className="h-11 px-3 rounded-2xl font-semibold text-xs gap-1.5 text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all"
              >
                {isPolishingPrompt ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                )}
                <span className="hidden sm:inline">Polish Prompt</span>
              </Button>
            )}
          </div>

          {/* Right Action Cluster: Cancel & High-Impact Run Button */}
          <div className="flex items-center gap-3 self-end sm:self-auto w-full sm:w-auto justify-end pt-2 md:pt-0">
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={isGenerating}
                className="h-11 px-4 rounded-xl font-bold text-xs text-muted-foreground hover:text-foreground active:scale-[0.97]"
              >
                Cancel
              </Button>
            )}

            <RainbowButton
              type="button"
              onClick={handleExecute}
              disabled={isExecutingDisabled}
              className="h-12 px-6 rounded-2xl font-bold text-sm gap-2.5 shadow-xl transition-all active:scale-[0.97] text-white w-full sm:w-auto"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : hasExtractingFiles ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Reading Docs...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Build Survey Engine</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </RainbowButton>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default UnifiedAiArchitectStudio;
