'use client';

/**
 * @fileoverview SmartSapp Survey Intelligence 2.0 — Unified AI Survey Architect Studio
 *
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Consolidated Prompt Hero: Consolidates the entire generation interface into <PromptBar />,
 *    eliminating fractured tabs, external selector rows, and cluttered button clouds.
 * 2. Inculcated Unified Model Selector: Direct bidirectional binding to `useWorkspaceAiModel()`,
 *    allowing PromptBar to function as the unified model selector for the workspace.
 * 3. Clean Modal Workflows:
 *    - Survey Archetype Catalog Modal: Searchable curated blueprint presets.
 *    - Architect Options Modal: Target depth (Compact/Standard/In-Depth) and scoring modes (Auto/Quiz/Feedback).
 *    - Reference URL Modal: Attaching external rubrics, guidelines, and articles.
 * 4. Multi-Modal Extraction: PDF, DOCX, XLSX, PPTX, Images (thumbnails), and URLs.
 * 5. Touch Ergonomics: min-h-[44px] touch targets, active:scale-[0.97] tactile press, WCAG 2.1 AA.
 * 6. Strict Zero-Any Invariant: Completely typed interfaces for props, payloads, and handlers.
 */

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sparkles,
  X,
  Loader2,
  SlidersHorizontal,
  Globe,
  RotateCcw,
  Layers,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { useWorkspaceAiModel } from '@/hooks/use-workspace-ai-model';
import { AiModelRegistry } from '@/lib/ai/model-registry';
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
import PromptBar, {
  type PromptBarSource,
  type PromptBarCommand,
  type PromptBarModel,
  type PromptBarActionItem,
  type PromptBarSendDetail,
} from '@/components/PromptBar';
import { Attachment01Icon, Globe02Icon } from '@hugeicons/core-free-icons';

const DRAFT_STORAGE_KEY = 'smartsapp_ai_survey_studio_draft';

const DEPTH_LABELS: Record<ArchitectSurveyDepth, string> = {
  compact: 'Compact (3–5)',
  standard: 'Standard (6–10)',
  in_depth: 'In-Depth (11–15+)',
};

const MODE_LABELS: Record<ArchitectScoringMode, string> = {
  auto: 'Auto',
  scored: 'Quiz / Scored',
  feedback: 'Feedback',
};

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

  // Inculcated workspace AI model selector
  const { modelId, setModel, isUpdating: isModelUpdating } = useWorkspaceAiModel();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const pbBackground = isDark ? '#1e1e24' : '#ffffff';
  const pbColor = isDark ? '#f4f4f5' : '#0f172a';
  const pbMenuBackground = isDark ? '#27272e' : '#ffffff';
  const pbSparkColor = isDark ? '#a78bfa' : '#4f46e5';

  // Primary state
  const [prompt, setPrompt] = React.useState('');
  const [intent, setIntent] = React.useState<ArchitectIntentConfig>({
    depth: 'standard',
    scoringMode: 'auto',
    tone: 'professional',
  });
  const [effort, setEffort] = React.useState<string>('Medium');
  const [attachedFiles, setAttachedFiles] = React.useState<AttachedSourceFile[]>([]);
  const [attachedUrls, setAttachedUrls] = React.useState<AttachedSourceUrl[]>([]);

  // Modals state
  const [isArchetypesModalOpen, setIsArchetypesModalOpen] = React.useState(false);
  const [archetypeSearch, setArchetypeSearch] = React.useState('');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = React.useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = React.useState(false);

  // Drag & drop and link input state
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);
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

  // Filter archetypes for the modal search
  const filteredArchetypes = React.useMemo(() => {
    if (!archetypeSearch.trim()) return activeArchetypes;
    const q = archetypeSearch.toLowerCase().trim();
    return activeArchetypes.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.badge.toLowerCase().includes(q)
    );
  }, [activeArchetypes, archetypeSearch]);

  // Handle file uploads with client-side multi-format extraction
  const handleFilesAdded = React.useCallback(async (files: FileList | File[]) => {
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
  }, [governanceConfig, toast]);

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
    setIsLinkModalOpen(false);

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

  const handlePolishPrompt = React.useCallback(() => {
    if (!prompt.trim() || isPolishingPrompt) return;

    setIsPolishingPrompt(true);
    polishTimerRef.current = setTimeout(() => {
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
  }, [isPolishingPrompt, prompt, intent.scoringMode, toast]);

  const hasExtractingFiles = attachedFiles.some((f) => f.status === 'extracting');

  const handleExecute = (overridePrompt?: string, _sendDetail?: PromptBarSendDetail) => {
    const effectivePrompt = (overridePrompt !== undefined ? overridePrompt : prompt).trim();
    if (!effectivePrompt && attachedFiles.length === 0 && attachedUrls.length === 0) return;
    if (isGenerating || hasExtractingFiles || isModelUpdating) return;

    const payload: ArchitectUnifiedPayload = {
      prompt: effectivePrompt,
      attachedFiles,
      attachedUrls,
      intent: {
        ...intent,
        effort,
      },
    };

    const finalEnvelope = formatUnifiedArchitectEnvelope(payload);

    // Extract multimodal images
    const images = attachedFiles
      .filter((f) => f.type === 'image' && f.dataUri)
      .map((f) => ({ dataUri: f.dataUri!, name: f.name }));

    void onSubmit({
      prompt: effectivePrompt,
      finalEnvelope,
      attachedFiles,
      attachedUrls,
      intent: {
        ...intent,
        effort,
      },
      images: images.length > 0 ? images : undefined,
    });
  };

  // Dynamic file picker invoking multi-format client extraction
  const pickFiles = React.useCallback((): Promise<string[]> => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept =
        '.pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,.json';
      input.onchange = async () => {
        if (input.files && input.files.length > 0) {
          const files = Array.from(input.files);
          await handleFilesAdded(files);
          resolve(files.map((f) => f.name));
        } else {
          resolve([]);
        }
      };
      input.click();
    });
  }, [handleFilesAdded]);

  // PromptBar Sources Menu
  const promptBarSources: PromptBarSource[] = React.useMemo(
    () => [
      {
        key: 'files',
        name: 'Photos & files',
        description: 'Upload from this device (PDF, DOCX, XLSX, PPTX, Images)',
        icon: Attachment01Icon,
        attach: true,
      },
      {
        key: 'web',
        name: 'Reference URL',
        description: 'Include an online rubric, guideline, or article',
        icon: Globe02Icon,
        action: () => setIsLinkModalOpen(true),
      },
      {
        key: 'archetypes',
        name: 'Archetypes Catalog',
        description: 'Browse curated blueprints & presets',
        icon: <Layers className="h-4 w-4" />,
        action: () => setIsArchetypesModalOpen(true),
      },
      {
        key: 'settings',
        name: 'Architect Options',
        description: 'Configure question depth & scoring modes',
        icon: <SlidersHorizontal className="h-4 w-4" />,
        action: () => setIsSettingsModalOpen(true),
      },
    ],
    []
  );

  // PromptBar Commands (/ menu)
  const promptBarCommands: PromptBarCommand[] = React.useMemo(() => {
    const dynamicCommands: PromptBarCommand[] = [
      {
        key: 'archetypes',
        name: '/archetypes',
        description: 'Open the Survey Archetype Catalog modal',
        action: () => setIsArchetypesModalOpen(true),
      },
      {
        key: 'settings',
        name: '/settings',
        description: 'Configure survey depth, scoring mode, and tone',
        action: () => setIsSettingsModalOpen(true),
      },
      {
        key: 'url',
        name: '/url',
        description: 'Attach a reference web link',
        action: () => setIsLinkModalOpen(true),
      },
    ];

    if (governanceConfig?.enablePromptPolishCopilot !== false) {
      dynamicCommands.push({
        key: 'polish',
        name: '/polish',
        description: 'Polish prompt with survey structure & best practices',
        action: handlePolishPrompt,
      });
    }

    const archetypeCommands: PromptBarCommand[] = activeArchetypes.map((archetype) => ({
      key: archetype.id,
      name: `/${archetype.id}`,
      description: `${archetype.title} - ${archetype.description}`,
      promptText: archetype.promptSeed,
      action: () => {
        setIntent((prev) => ({
          ...prev,
          depth: archetype.defaultDepth,
          scoringMode: archetype.defaultScoring,
        }));
        toast({
          title: `Applied "${archetype.title}" Archetype`,
          description: 'Preset prompt and scoring configuration populated.',
        });
      },
    }));

    return [...dynamicCommands, ...archetypeCommands];
  }, [activeArchetypes, governanceConfig?.enablePromptPolishCopilot, handlePolishPrompt, toast]);

  // Inculcated AI Model Selector Models from Single Source of Truth Registry
  const promptBarModels: PromptBarModel[] = React.useMemo(() => {
    return AiModelRegistry.getAllModels().map((m) => {
      let tag = m.tier.charAt(0).toUpperCase() + m.tier.slice(1);
      if (m.isFlagship) tag = 'Flagship';
      if (m.provider === 'openrouter') tag = 'Free';
      return {
        key: m.id,
        name: m.name,
        tag,
        description: m.description,
      };
    });
  }, []);

  // Action pills rendered cleanly inside the PromptBar toolbar
  const promptBarActions: PromptBarActionItem[] = React.useMemo(() => {
    const actions: PromptBarActionItem[] = [
      {
        key: 'archetypes',
        label: 'Archetypes',
        icon: <Layers className="h-3.5 w-3.5" />,
        onClick: () => setIsArchetypesModalOpen(true),
        title: 'Open Survey Archetypes Catalog',
      },
      {
        key: 'settings',
        label: `${DEPTH_LABELS[intent.depth]} · ${MODE_LABELS[intent.scoringMode]}`,
        icon: <SlidersHorizontal className="h-3.5 w-3.5" />,
        onClick: () => setIsSettingsModalOpen(true),
        title: 'Configure Survey Depth, Scoring Mode & Tone',
      },
    ];

    if (governanceConfig?.enablePromptPolishCopilot !== false) {
      actions.push({
        key: 'polish',
        label: isPolishingPrompt ? 'Polishing...' : 'Polish',
        icon: isPolishingPrompt ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 text-purple-400" />
        ),
        onClick: handlePolishPrompt,
        disabled: isPolishingPrompt || !prompt.trim(),
        title: 'Polish prompt with survey structure & best practices',
      });
    }

    return actions;
  }, [
    intent.depth,
    intent.scoringMode,
    isPolishingPrompt,
    prompt,
    governanceConfig?.enablePromptPolishCopilot,
    handlePolishPrompt,
  ]);

  const EFFORTS = React.useMemo(() => ['Low', 'Medium', 'High', 'Extra', 'Max'], []);

  return (
    <Card
      className={cn(
        'w-full border-2 border-border/80 bg-card shadow-xl rounded-3xl overflow-hidden transition-all duration-200 backdrop-blur-xs',
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
      <CardHeader className="p-6 pb-4 border-b border-border/60 bg-muted/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shadow-xs">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>AI Survey Architect Studio</span>
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider border-primary/30 text-primary bg-primary/10 rounded-full px-2.5 py-0.5">
                  Universal Ingestion
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Synthesize intelligent surveys with attached docs, images, reference links, or curated blueprints.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsArchetypesModalOpen(true)}
              className="h-9 px-3.5 rounded-xl border border-border/80 bg-background/80 hover:bg-muted text-xs font-semibold gap-1.5 shadow-xs transition-all active:scale-[0.97]"
            >
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span>Archetypes Catalog</span>
            </Button>

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

        {/* Attached Images Thumbnail Shelf */}
        {attachedFiles.some((f) => f.type === 'image' && f.thumbnailUrl) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mr-1">
              Images ({attachedFiles.filter((f) => f.type === 'image').length}):
            </span>
            {attachedFiles
              .filter((f) => f.type === 'image' && f.thumbnailUrl)
              .map((img) => (
                <div
                  key={img.id}
                  className="relative group rounded-xl overflow-hidden border border-border/70 bg-muted/40 shadow-xs"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.thumbnailUrl}
                    alt={img.name}
                    className="h-12 w-12 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setAttachedFiles((prev) => prev.filter((f) => f.id !== img.id))}
                      className="p-1 rounded-md bg-destructive text-white hover:bg-destructive/90"
                      aria-label={`Remove image ${img.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Consolidated Central Hero: PromptBar as unified input and model selector */}
        <div className="flex justify-center w-full my-2">
          <PromptBar
            placeholder="Describe your survey goals, outline requirements, or attach documents & images..."
            value={prompt}
            onChange={setPrompt}
            attachments={attachedFiles.map((f) => f.name)}
            onAttachmentsChange={(remainingNames) => {
              setAttachedFiles((prev) =>
                prev.filter((f) => remainingNames.includes(f.name))
              );
            }}
            sources={promptBarSources}
            commands={promptBarCommands}
            models={promptBarModels}
            selectedModel={modelId}
            onModelChange={async (key) => {
              const success = await setModel(key);
              if (success) {
                const modelDef = AiModelRegistry.getModelById(key);
                toast({
                  title: 'Workspace Model Updated',
                  description: `Active AI model set to ${modelDef?.name ?? key}.`,
                });
              }
            }}
            actions={promptBarActions}
            efforts={EFFORTS}
            defaultEffort="Medium"
            onEffortChange={setEffort}
            busy={isGenerating || hasExtractingFiles || isModelUpdating}
            onSend={(text, detail) => handleExecute(text, detail)}
            onStop={onCancel}
            onAttach={pickFiles}
            background={pbBackground}
            color={pbColor}
            menuBackground={pbMenuBackground}
            sparkColor={pbSparkColor}
            sparkBoost={1}
            width={720}
            radius={18}
            maxRows={6}
            morphDuration={240}
            squash={0.12}
            tilt={8}
            pressScale={0.96}
            className="w-full max-w-[720px]"
          />
        </div>
      </CardContent>

      {/* Survey Archetype Catalog Modal */}
      <Dialog open={isArchetypesModalOpen} onOpenChange={setIsArchetypesModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden rounded-3xl">
          <DialogHeader className="p-6 pb-4 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">Survey Archetype Catalog</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Select a curated survey blueprint preset to jumpstart your prompt, structure, and scoring intent.
                </DialogDescription>
              </div>
            </div>
            <div className="pt-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search archetypes by title, description, or tag..."
                  value={archetypeSearch}
                  onChange={(e) => setArchetypeSearch(e.target.value)}
                  className="pl-10 h-10 rounded-xl text-xs bg-muted/30"
                />
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {filteredArchetypes.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-xs">
                No archetypes match &ldquo;{archetypeSearch}&rdquo;. Try another search term.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredArchetypes.map((archetype) => (
                  <div
                    key={archetype.id}
                    onClick={() => {
                      handleSelectArchetype(archetype);
                      setIsArchetypesModalOpen(false);
                    }}
                    className="group p-4 rounded-2xl border border-border/70 bg-card hover:bg-muted/40 hover:border-primary/40 transition-all duration-150 cursor-pointer flex flex-col justify-between gap-3 active:scale-[0.98] shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold">
                          {archetype.badge}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                        {archetype.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                        {archetype.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold capitalize">{DEPTH_LABELS[archetype.defaultDepth].split(' ')[0]}</span>
                        <span>•</span>
                        <span className="font-semibold capitalize">{MODE_LABELS[archetype.defaultScoring]}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2.5 rounded-lg text-xs font-semibold text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all"
                      >
                        Use Archetype
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex justify-between items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {filteredArchetypes.length} of {activeArchetypes.length} presets
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsArchetypesModalOpen(false)}
              className="rounded-xl h-9 text-xs font-semibold active:scale-[0.97]"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Survey Architect Options Modal */}
      <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden rounded-3xl">
          <DialogHeader className="p-6 pb-4 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">Survey Architect Options</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Configure question depth, scoring architecture, and generation parameters.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-6">
            {/* Target Question Depth */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Target Survey Depth
                </label>
                <span className="text-xs text-muted-foreground">Number of questions synthesized</span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {(
                  [
                    { id: 'compact', label: 'Compact', detail: '3–5 Questions', desc: 'Micro-pulse, NPS' },
                    { id: 'standard', label: 'Standard', detail: '6–10 Questions', desc: 'Balanced discovery' },
                    { id: 'in_depth', label: 'In-Depth', detail: '11–15+ Questions', desc: 'Exhaustive audit' },
                  ] as const
                ).map((item) => {
                  const isSelected = intent.depth === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setIntent((prev) => ({ ...prev, depth: item.id }))}
                      className={cn(
                        'p-3 rounded-2xl border text-left cursor-pointer transition-all duration-150 flex flex-col justify-between active:scale-[0.97]',
                        isSelected
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                          : 'border-border/70 bg-card hover:bg-muted/40 hover:border-border'
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-foreground">{item.label}</span>
                          {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                        </div>
                        <p className="text-[11px] font-semibold text-primary/90 mt-0.5">{item.detail}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Survey Scoring Mode */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Scoring & Assessment Mode
                </label>
                <span className="text-xs text-muted-foreground">Logic & evaluation model</span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {(
                  [
                    { id: 'auto', label: 'Auto-Detect', desc: 'Infers scoring from context automatically' },
                    { id: 'scored', label: 'Quiz / Exam', desc: 'Point values, correct answers & tiers' },
                    { id: 'feedback', label: 'Feedback', desc: 'Open feedback, rating scales, no points' },
                  ] as const
                ).map((item) => {
                  const isSelected = intent.scoringMode === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setIntent((prev) => ({ ...prev, scoringMode: item.id }))}
                      className={cn(
                        'p-3 rounded-2xl border text-left cursor-pointer transition-all duration-150 flex flex-col justify-between active:scale-[0.97]',
                        isSelected
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                          : 'border-border/70 bg-card hover:bg-muted/40 hover:border-border'
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-foreground">{item.label}</span>
                          {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Prompt Polish Trigger */}
            {governanceConfig?.enablePromptPolishCopilot !== false && (
              <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                    Prompt Polish Copilot
                  </h5>
                  <p className="text-[11px] text-muted-foreground">
                    Automatically enhance prompt structure with balanced options and branching instructions.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePolishPrompt}
                  disabled={isPolishingPrompt || !prompt.trim()}
                  className="h-9 px-3 rounded-xl border-border/80 font-semibold text-xs gap-1.5 active:scale-[0.97]"
                >
                  {isPolishingPrompt ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                  )}
                  <span>{isPolishingPrompt ? 'Polishing...' : 'Polish Now'}</span>
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex justify-end">
            <Button
              type="button"
              onClick={() => setIsSettingsModalOpen(false)}
              className="rounded-xl h-9 px-5 text-xs font-bold active:scale-[0.97]"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reference URL Modal */}
      <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl">
          <DialogHeader className="p-6 pb-4 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">Add Reference URL</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Link to an online rubric, guideline, or article to parse as survey context.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-3">
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
              autoFocus
            />
            {linkInputError && (
              <p className="text-[11px] text-destructive font-medium">{linkInputError}</p>
            )}
          </div>

          <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex justify-between items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setLinkInputError(null);
                setRawLinkInput('');
                setIsLinkModalOpen(false);
              }}
              className="rounded-xl h-9 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAddUrl}
              className="rounded-xl h-9 px-4 text-xs font-bold active:scale-[0.97]"
            >
              Attach Reference URL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default UnifiedAiArchitectStudio;
