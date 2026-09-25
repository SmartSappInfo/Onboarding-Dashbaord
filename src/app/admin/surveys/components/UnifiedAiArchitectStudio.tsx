'use client';

/**
 * @fileoverview SmartSapp Survey Intelligence 2.0 — Unified AI Survey Architect Studio
 *
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Unified Multi-Modal Surface: Replaces fractured tab silos with <UnifiedPromptBar />,
 *    accepting prompts, multi-format documents (PDF/DOCX/DOC/PPTX/XLSX), images with visual previews, and reference links.
 * 2. Client-Side Extraction Guardrails: Automatically extracts document text client-side with 10MB/20-page/25k char caps.
 * 3. Compact Docked Model Control: Binds directly to active workspace model tier via <AiModelSelector>.
 * 4. Micro-Interactions & Ergonomics: min-h-[44px] touch targets, active:scale-[0.97] tactile press,
 *    and keyboard execution (Cmd+Enter / Enter).
 * 5. Session Resilience: Autosaves draft prompt and settings to sessionStorage to prevent accidental data loss.
 * 6. Strict Zero-Any Invariant: Completely typed interfaces for props, payloads, and handlers.
 */

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Sparkles,
  X,
  Loader2,
  SlidersHorizontal,
  ArrowRight,
  Globe,
  RotateCcw,
  Layers,
  Award,
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
import { UnifiedPromptBar } from '@/components/ai/PromptBar/UnifiedPromptBar';
import type {
  PromptBarAttachment,
  PromptBarSourceItem,
  PromptBarCommandItem,
  PromptBarEffortLevel,
} from '@/components/ai/PromptBar/types';
import { Attachment01Icon, Globe02Icon } from '@hugeicons/core-free-icons';

const DRAFT_STORAGE_KEY = 'smartsapp_ai_survey_studio_draft';

export interface UnifiedAiArchitectStudioProps {
  isGenerating: boolean;
  onSubmit: (payload: {
    prompt: string;
    finalEnvelope: string;
    attachedFiles: AttachedSourceFile[];
    attachedUrls: AttachedSourceUrl[];
    intent: ArchitectIntentConfig;
    images?: Array<{ dataUri: string; name?: string }>;
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
  const [effort, setEffort] = React.useState<PromptBarEffortLevel>('medium');
  const [attachedFiles, setAttachedFiles] = React.useState<AttachedSourceFile[]>([]);
  const [attachedUrls, setAttachedUrls] = React.useState<AttachedSourceUrl[]>([]);

  // UI interaction state
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = React.useState(false);
  const [rawLinkInput, setRawLinkInput] = React.useState('');
  const [linkInputError, setLinkInputError] = React.useState<string | null>(null);
  const [isPolishingPrompt, setIsPolishingPrompt] = React.useState(false);

  const isHydratedRef = React.useRef(false);
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
    } finally {
      isHydratedRef.current = true;
    }
  }, []);

  // Autosave to sessionStorage on updates (only after mount hydration completes)
  React.useEffect(() => {
    if (!isHydratedRef.current) return;
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

  // Handle file uploads with client-side multi-format extraction
  const handleFilesAdded = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (!fileArray.length) return;

    for (const file of fileArray) {
      const mappedType = categorizeFileType(file);
      if (mappedType === 'other') {
        toast({
          variant: 'destructive',
          title: 'Unsupported File Format',
          description: `"${file.name}" cannot be parsed. Please attach PDF, DOCX, DOC, XLSX, XLS, PPTX, PPT, PNG, JPG, TXT, CSV, or JSON documents.`,
        });
        continue;
      }

      // Enforce Backoffice system governance allowed file types
      if (governanceConfig?.allowedFileTypes && !governanceConfig.allowedFileTypes.includes(mappedType)) {
        toast({
          variant: 'destructive',
          title: 'File Type Restricted',
          description: `"${file.name}" (${mappedType.toUpperCase()}) is currently disabled by system governance policies.`,
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
          maxImageSizeMb: governanceConfig?.maxImageUploadSizeMb ?? 5,
          maxPdfPages: governanceConfig?.maxPdfPagesLimit ?? 20,
          maxSpreadsheetRows: governanceConfig?.maxSpreadsheetRows ?? 500,
          maxPresentationSlides: governanceConfig?.maxPresentationSlides ?? 30,
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
                  thumbnailUrl: extracted.thumbnailUrl,
                  dataUri: extracted.dataUri,
                  dimensions: extracted.dimensions,
                }
              : item
          )
        );

        toast({
          title: 'Source Ingested',
          description: `Successfully extracted ${extracted.charCount.toLocaleString()} characters from "${file.name}".`,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to parse file';
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

  const handleAddUrl = () => {
    setLinkInputError(null);
    const parsed = validateAndParseUrl(rawLinkInput);
    if (!parsed.isValid || !parsed.normalizedUrl || !parsed.domain) {
      setLinkInputError(parsed.error || 'Please enter a valid URL (e.g. acme.com/principles).');
      return;
    }

    // Check duplicate
    if (attachedUrls.some((u) => u.url === parsed.normalizedUrl)) {
      setLinkInputError('This URL has already been attached.');
      return;
    }

    const newUrl: AttachedSourceUrl = {
      id: `url_${Date.now()}`,
      url: parsed.normalizedUrl,
      domain: parsed.domain,
    };

    setAttachedUrls((prev) => [...prev, newUrl]);
    setRawLinkInput('');
    setIsLinkPopoverOpen(false);

    toast({
      title: 'Reference URL Added',
      description: `Attached ${parsed.domain} as reference context.`,
    });
  };

  const handleRemoveUrl = (urlId: string) => {
    setAttachedUrls((prev) => prev.filter((item) => item.id !== urlId));
  };

  const handleSelectArchetype = (preset: ArchetypePreset) => {
    setPrompt(preset.promptSeed);
    setIntent((prev) => ({
      ...prev,
      depth: preset.defaultDepth,
      scoringMode: preset.defaultScoring,
    }));

    toast({
      title: `Applied "${preset.title}" Archetype`,
      description: 'Preset prompt and scoring configuration populated.',
    });
  };

  const handleClearAll = () => {
    setPrompt('');
    setAttachedFiles([]);
    setAttachedUrls([]);
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    toast({
      title: 'Composer Cleared',
      description: 'Prompt and attached context have been reset.',
    });
  };

  const handlePolishPrompt = () => {
    if (!prompt.trim() || isPolishingPrompt) return;

    setIsPolishingPrompt(true);
    polishTimerRef.current = setTimeout(() => {
      // Intelligent prompt enhancement heuristic
      let enhanced = prompt.trim();
      if (!enhanced.toLowerCase().includes('logic') && !enhanced.toLowerCase().includes('conditional')) {
        enhanced += '\n\nInclude conditional branching logic where relevant to personalize respondent flow.';
      }
      if (!enhanced.toLowerCase().includes('clear') && !enhanced.toLowerCase().includes('options')) {
        enhanced += '\nEnsure all multiple-choice options are mutually exclusive, balanced, and free of bias.';
      }
      if (intent.scoringMode === 'scored' && !enhanced.toLowerCase().includes('points')) {
        enhanced += '\nAssign precise point values to correct answers and establish clear outcome tiers.';
      }

      setPrompt(enhanced);
      setIsPolishingPrompt(false);
      toast({
        title: 'Prompt Polished',
        description: 'Enhanced prompt with structured clarity and best-practice survey instructions.',
      });
    }, 450);
  };

  const hasExtractingFiles = attachedFiles.some((f) => f.status === 'extracting');
  const isExecutingDisabled =
    isGenerating ||
    hasExtractingFiles ||
    (!prompt.trim() && attachedFiles.length === 0 && attachedUrls.length === 0);

  const handleExecute = () => {
    if (isExecutingDisabled) return;

    const payload: ArchitectUnifiedPayload = {
      prompt,
      attachedFiles,
      attachedUrls,
      intent,
    };

    const finalEnvelope = formatUnifiedArchitectEnvelope(payload);

    // Extract multimodal images (Approach 1)
    const images = attachedFiles
      .filter((f) => f.type === 'image' && f.dataUri)
      .map((f) => ({ dataUri: f.dataUri!, name: f.name }));

    void onSubmit({
      prompt,
      finalEnvelope,
      attachedFiles,
      attachedUrls,
      intent,
      images: images.length > 0 ? images : undefined,
    });
  };

  // Map attached files to PromptBar attachments
  const promptBarAttachments: PromptBarAttachment[] = React.useMemo(() => {
    return attachedFiles.map((file) => ({
      id: file.id,
      name: file.name,
      size: file.size,
      type: file.type,
      thumbnailUrl: file.thumbnailUrl,
      content: file.content,
      charCount: file.charCount,
      pageCount: file.pageCount,
      status: file.status,
      errorMessage: file.errorMessage,
    }));
  }, [attachedFiles]);

  // PromptBar Sources
  const promptBarSources: PromptBarSourceItem[] = React.useMemo(() => [
    {
      key: 'files',
      name: 'Photos & documents',
      description: 'Attach PDF, DOCX, DOC, PPTX, XLSX, or Images',
      icon: Attachment01Icon,
      attach: true,
    },
    {
      key: 'web',
      name: 'Reference URL',
      description: 'Include an online rubric, guideline, or article',
      icon: Globe02Icon,
      action: () => setIsLinkPopoverOpen(true),
    },
  ], []);

  // PromptBar Commands from Archetypes
  const promptBarCommands: PromptBarCommandItem[] = React.useMemo(() => {
    return activeArchetypes.map((archetype) => ({
      key: archetype.id,
      label: archetype.title,
      description: archetype.description,
      promptText: archetype.promptSeed,
      action: () => {
        setIntent((prev) => ({
          ...prev,
          depth: archetype.defaultDepth,
          scoringMode: archetype.defaultScoring,
        }));
      },
    }));
  }, [activeArchetypes]);

  return (
    <Card
      className={cn(
        'w-full border-border/80 bg-card shadow-lg rounded-3xl overflow-hidden transition-all duration-200',
        isDraggingOver && 'border-primary ring-4 ring-primary/10 bg-primary/5',
        className
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          void handleFilesAdded(e.dataTransfer.files);
        }
      }}
    >
      <CardHeader className="p-6 pb-4 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shadow-xs">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>AI Survey Architect Studio</span>
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider border-primary/30 text-primary bg-primary/5">
                  Universal Ingestion
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Drop documents, spreadsheets, presentations, images, or links to synthesize intelligent survey flows.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {(prompt || attachedFiles.length > 0 || attachedUrls.length > 0) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="h-9 px-3 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground active:scale-[0.97]"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Clear All
              </Button>
            )}
          </div>
        </div>

        {/* Quick-Start Archetype Presets */}
        <div className="pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" />
              Quick-Start Survey Archetypes:
            </span>
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              Click to populate prompt & intent
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {activeArchetypes.map((archetype) => (
              <button
                key={archetype.id}
                type="button"
                onClick={() => handleSelectArchetype(archetype)}
                className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/80 bg-background/80 hover:bg-muted/60 hover:border-primary/40 text-xs font-medium text-foreground transition-all duration-150 active:scale-[0.97] text-left shadow-xs"
              >
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  {archetype.badge}
                </span>
                <span className="font-semibold">{archetype.title}</span>
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {/* Attached Reference Links Shelf */}
        {attachedUrls.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mr-1">
              Links ({attachedUrls.length}):
            </span>
            {attachedUrls.map((url) => (
              <div
                key={url.id}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-foreground font-medium shadow-xs"
              >
                <Globe className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span className="font-semibold truncate max-w-[200px]">{url.domain}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveUrl(url.id)}
                  aria-label={`Remove URL ${url.domain}`}
                  className="p-0.5 rounded-md hover:bg-blue-500/20 text-muted-foreground hover:text-foreground transition-colors active:scale-95"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Universal React Bits PromptBar Adaptation */}
        <UnifiedPromptBar
          placeholder="Describe your survey goals, outline requirements, or drop PDF, DOCX, XLSX, PPTX, or Images..."
          value={prompt}
          onChange={setPrompt}
          busy={isGenerating || hasExtractingFiles}
          sources={promptBarSources}
          commands={promptBarCommands}
          effort={effort}
          onEffortChange={setEffort}
          attachments={promptBarAttachments}
          onAttachmentsChange={(updated) => {
            const updatedIds = new Set(updated.map((u) => u.id));
            setAttachedFiles((prev) => prev.filter((f) => updatedIds.has(f.id)));
          }}
          onFileSelected={(files) => void handleFilesAdded(files)}
          onSend={handleExecute}
          onCancel={onCancel}
          autoFocus={true}
        />

        {/* Secondary Architectural Intent & Polish Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Depth Selector Pill */}
            <div className="flex items-center gap-1.5 bg-background border border-border/80 rounded-xl px-3 py-1.5 shadow-xs">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground">Depth:</span>
              <select
                aria-label="Target Survey Depth"
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

            {/* Scoring Mode Selector Pill */}
            <div className="flex items-center gap-1.5 bg-background border border-border/80 rounded-xl px-3 py-1.5 shadow-xs">
              <Award className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground">Mode:</span>
              <select
                aria-label="Survey Scoring Mode"
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

            {/* Polish Prompt Helper */}
            {governanceConfig?.enablePromptPolishCopilot !== false && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePolishPrompt}
                disabled={isPolishingPrompt || !prompt.trim()}
                className="h-9 px-3 rounded-xl border-border/80 font-semibold text-xs gap-1.5 text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all shadow-xs"
              >
                {isPolishingPrompt ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                )}
                <span>Polish Prompt</span>
              </Button>
            )}
          </div>

          {/* Model Selector & Submit Button */}
          <div className="flex items-center gap-2.5 ml-auto">
            <div className="hidden lg:block">
              <AiModelSelector hideLabel={true} className="w-[200px]" />
            </div>

            <RainbowButton
              type="button"
              onClick={handleExecute}
              disabled={isExecutingDisabled}
              className="h-11 px-6 rounded-2xl font-bold text-sm gap-2 shadow-lg transition-all active:scale-[0.97] text-white"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : hasExtractingFiles ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Reading Files...</span>
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

        {/* Add Link Popover Modal */}
        <Popover open={isLinkPopoverOpen} onOpenChange={setIsLinkPopoverOpen}>
          <PopoverTrigger asChild>
            <span className="hidden" />
          </PopoverTrigger>
          <PopoverContent className="w-84 p-4 rounded-2xl shadow-xl space-y-3" align="start">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-foreground">Add Reference URL</h4>
              <p className="text-[11px] text-muted-foreground">
                Link to a public guideline, rubric, or article to parse as survey context.
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
                Attach Reference URL
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </CardContent>
    </Card>
  );
}

export default UnifiedAiArchitectStudio;
