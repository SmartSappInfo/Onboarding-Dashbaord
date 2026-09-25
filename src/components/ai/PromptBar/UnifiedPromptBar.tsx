'use client';

/**
 * @fileoverview Universal AI PromptBar Component (Adapted from React Bits)
 *
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Semantic Design Tokens: Replaces hardcoded hex codes with theme-aware CSS variables.
 * 2. Mobile Ergonomics: Touch targets >= 44px, 16px mobile font to prevent iOS Safari auto-zoom.
 * 3. Emil Kowalski Motion: Spring popovers, active:scale-[0.97] press states, accessible reduced motion.
 * 4. Multi-Modal Ingestion: Directly handles files, images with thumbnails, links, models, and effort levels.
 * 5. Strict Zero-Any Invariant: Completely typed interfaces without `any` or `unknown`.
 */

import * as React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Attachment01Icon,
  Globe02Icon,
  SentIcon,
  StopIcon,
  SparklesIcon,
  FlashIcon,
  File01Icon,
  Cancel01Icon,
  Loading03Icon,
} from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import type {
  UnifiedPromptBarProps,
  PromptBarSourceItem,
  PromptBarModelItem,
  PromptBarCommandItem,
  PromptBarEffortLevel,
} from './types';
import './PromptBar.css';

const DEFAULT_SOURCES: PromptBarSourceItem[] = [
  {
    key: 'files',
    name: 'Photos & files',
    description: 'Upload PDF, DOCX, DOC, PPTX, XLSX, or Images',
    icon: Attachment01Icon,
    attach: true,
  },
  {
    key: 'web',
    name: 'Web reference',
    description: 'Provide an external URL as reference context',
    icon: Globe02Icon,
  },
];

const DEFAULT_MODELS: PromptBarModelItem[] = [
  {
    key: 'gemini-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Ultra-fast multimodal reasoning for high-velocity synthesis',
    badge: 'Fast',
    provider: 'google',
    multimodal: true,
  },
  {
    key: 'claude-sonnet',
    name: 'Claude 3.5 Sonnet',
    description: 'Flagship deep reasoning, nuanced structure, and complex logic',
    badge: 'Flagship',
    provider: 'anthropic',
    multimodal: true,
  },
];

const EFFORT_OPTIONS: Array<{ key: PromptBarEffortLevel; label: string; description: string }> = [
  { key: 'low', label: 'Low Effort', description: 'Quick, concise execution' },
  { key: 'medium', label: 'Medium Effort', description: 'Balanced speed and depth' },
  { key: 'high', label: 'High Effort', description: 'Deep analysis and comprehensive detail' },
  { key: 'max', label: 'Max Reasoning', description: 'Exhaustive verification and edge cases' },
];

export function UnifiedPromptBar({
  placeholder = 'Ask anything or paste source material...',
  value,
  defaultValue = '',
  onChange,
  busy = false,
  sources = DEFAULT_SOURCES,
  models = DEFAULT_MODELS,
  activeModelKey,
  onModelChange,
  effort = 'medium',
  onEffortChange,
  commands = [],
  attachments = [],
  onAttachmentsChange,
  onFileSelected,
  onSend,
  onCancel,
  className,
  disabled = false,
  showModelSelector = true,
  showEffortSelector = true,
  showSourcesMenu = true,
  showCommandsMenu = true,
  autoFocus = false,
}: UnifiedPromptBarProps) {
  const shouldReduceMotion = useReducedMotion();

  // Controlled vs uncontrolled text state
  const [internalText, setInternalText] = React.useState(defaultValue);
  const text = value !== undefined ? value : internalText;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    if (value === undefined) {
      setInternalText(nextVal);
    }
    onChange?.(nextVal);

    // Auto trigger menus on @ or / at start or after whitespace
    if (nextVal.endsWith('@') && showSourcesMenu) {
      setOpenMenu('sources');
    } else if (nextVal.endsWith('/') && showCommandsMenu && commands.length > 0) {
      setOpenMenu('commands');
    }
  };

  // Popover state
  const [openMenu, setOpenMenu] = React.useState<'sources' | 'models' | 'effort' | 'commands' | null>(null);

  // File input ref
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Resolve active model
  const activeModel = React.useMemo(() => {
    if (activeModelKey) {
      return models.find((m) => m.key === activeModelKey) || models[0];
    }
    return models[0];
  }, [models, activeModelKey]);

  // Auto-resize textarea
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(Math.max(el.scrollHeight, 40), 220);
    el.style.height = `${nextHeight}px`;
  }, [text]);

  // Close menus on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      if (openMenu) {
        e.preventDefault();
        setOpenMenu(null);
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      // Enter without shift submits
      e.preventDefault();
      if (!busy && (text.trim().length > 0 || attachments.length > 0)) {
        handleTriggerSend();
      }
    }
  };

  const handleTriggerSend = () => {
    if (busy) {
      onCancel?.();
      return;
    }
    onSend?.(text, {
      attachments,
      model: activeModel,
      effort,
    });
  };

  const handleSourceSelect = (source: PromptBarSourceItem) => {
    setOpenMenu(null);
    if (source.attach) {
      fileInputRef.current?.click();
    } else {
      source.action?.();
    }
  };

  const handleCommandSelect = (cmd: PromptBarCommandItem) => {
    setOpenMenu(null);
    if (cmd.promptText) {
      const nextVal = cmd.promptText;
      if (value === undefined) setInternalText(nextVal);
      onChange?.(nextVal);
    }
    cmd.action?.();
  };

  const handleRemoveAttachment = (id: string) => {
    const updated = attachments.filter((a) => a.id !== id);
    onAttachmentsChange?.(updated);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelected?.(e.target.files);
    }
    e.target.value = '';
  };

  const canSubmit = !busy && (text.trim().length > 0 || attachments.length > 0);

  return (
    <div ref={containerRef} className={cn('promptbar-container relative', className)}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.ppt,.pptx,.xls,.xlsx,.txt,.md,.markdown,.csv,.json"
        onChange={handleFileInputChange}
      />

      {/* Popovers */}
      <AnimatePresence>
        {openMenu === 'sources' && showSourcesMenu && (
          <motion.div
            key="sources-menu"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="promptbar-popover-menu"
          >
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Add Context / Sources
            </div>
            {sources.map((src) => (
              <div
                key={src.key}
                role="button"
                tabIndex={0}
                onClick={() => handleSourceSelect(src)}
                className="promptbar-popover-item group"
              >
                {src.icon && (
                  <div className="p-1 rounded-md bg-muted text-muted-foreground group-hover:text-primary transition-colors">
                    {typeof src.icon === 'function' ? (
                      React.createElement(src.icon, { size: 16 })
                    ) : (
                      <HugeiconsIcon icon={src.icon} size={16} />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">{src.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{src.description}</div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {openMenu === 'models' && showModelSelector && (
          <motion.div
            key="models-menu"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="promptbar-popover-menu"
          >
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Select AI Model Tier
            </div>
            {models.map((mod) => {
              const isSelected = activeModel?.key === mod.key;
              return (
                <div
                  key={mod.key}
                  role="button"
                  tabIndex={0}
                  data-selected={isSelected}
                  onClick={() => {
                    onModelChange?.(mod);
                    setOpenMenu(null);
                  }}
                  className="promptbar-popover-item group"
                >
                  <div
                    className={cn(
                      'p-1 rounded-md transition-colors',
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <HugeiconsIcon icon={SparklesIcon} size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-foreground truncate">{mod.name}</span>
                      {mod.badge && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-muted font-bold text-muted-foreground">
                          {mod.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{mod.description}</div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {openMenu === 'effort' && showEffortSelector && (
          <motion.div
            key="effort-menu"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="promptbar-popover-menu"
          >
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Reasoning Effort
            </div>
            {EFFORT_OPTIONS.map((eff) => {
              const isSelected = effort === eff.key;
              return (
                <div
                  key={eff.key}
                  role="button"
                  tabIndex={0}
                  data-selected={isSelected}
                  onClick={() => {
                    onEffortChange?.(eff.key);
                    setOpenMenu(null);
                  }}
                  className="promptbar-popover-item group"
                >
                  <div
                    className={cn(
                      'p-1 rounded-md transition-colors',
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <HugeiconsIcon icon={FlashIcon} size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-foreground">{eff.label}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{eff.description}</div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {openMenu === 'commands' && showCommandsMenu && commands.length > 0 && (
          <motion.div
            key="commands-menu"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="promptbar-popover-menu"
          >
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Quick-Start Commands
            </div>
            {commands.map((cmd) => (
              <div
                key={cmd.key}
                role="button"
                tabIndex={0}
                onClick={() => handleCommandSelect(cmd)}
                className="promptbar-popover-item group"
              >
                <div className="p-1 rounded-md bg-muted text-muted-foreground group-hover:text-primary transition-colors">
                  {cmd.icon ? (
                    typeof cmd.icon === 'function' ? (
                      React.createElement(cmd.icon, { size: 15 })
                    ) : (
                      <HugeiconsIcon icon={cmd.icon} size={15} />
                    )
                  ) : (
                    <HugeiconsIcon icon={SparklesIcon} size={15} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">{cmd.label}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{cmd.description}</div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attachment Shelf */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 pb-0">
          {attachments.map((att) => (
            <div key={att.id} className="promptbar-attachment-chip group">
              {att.thumbnailUrl ? (
                // Thumbnail preview for images
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={att.thumbnailUrl}
                  alt={att.name}
                  className="h-6 w-6 rounded object-cover border border-border/80"
                />
              ) : att.status === 'extracting' ? (
                <HugeiconsIcon icon={Loading03Icon} size={14} className="animate-spin text-primary shrink-0" />
              ) : (
                <div className="p-1 rounded bg-muted/80 text-foreground shrink-0">
                  <HugeiconsIcon icon={File01Icon} size={13} />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate text-[11px] text-foreground">{att.name}</div>
                <div className="text-[9px] text-muted-foreground font-mono">
                  {att.status === 'extracting' ? (
                    <span className="text-primary font-sans">Extracting...</span>
                  ) : att.status === 'error' ? (
                    <span className="text-destructive font-sans">Failed</span>
                  ) : (
                    `${(att.size / 1024).toFixed(0)} KB${att.charCount ? ` • ${att.charCount.toLocaleString()} chars` : ''}`
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRemoveAttachment(att.id)}
                aria-label={`Remove ${att.name}`}
                className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-90"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Auto-Expanding Textarea */}
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || busy}
        autoFocus={autoFocus}
        className="promptbar-textarea"
      />

      {/* Bottom Controls Strip */}
      <div className="flex items-center justify-between gap-2 p-2 pt-0.5">
        {/* Left Toolbar Pills */}
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {/* Sources button */}
          {showSourcesMenu && (
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'sources' ? null : 'sources')}
              aria-label="Add sources or files"
              className={cn(
                'promptbar-pill-btn',
                openMenu === 'sources' && 'bg-muted text-foreground border-border'
              )}
            >
              <HugeiconsIcon icon={Attachment01Icon} size={14} />
              <span className="hidden sm:inline">Attach</span>
            </button>
          )}

          {/* Model Selector Pill */}
          {showModelSelector && (
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'models' ? null : 'models')}
              aria-label="Select AI Model"
              className={cn(
                'promptbar-pill-btn',
                openMenu === 'models' && 'bg-muted text-foreground border-border'
              )}
            >
              <HugeiconsIcon icon={SparklesIcon} size={13} className="text-primary" />
              <span className="truncate max-w-[110px]">{activeModel?.name || 'Model'}</span>
            </button>
          )}

          {/* Effort Level Pill */}
          {showEffortSelector && (
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'effort' ? null : 'effort')}
              aria-label="Select Reasoning Effort"
              className={cn(
                'promptbar-pill-btn',
                openMenu === 'effort' && 'bg-muted text-foreground border-border'
              )}
            >
              <HugeiconsIcon icon={FlashIcon} size={13} />
              <span className="capitalize">{effort}</span>
            </button>
          )}

          {/* Commands catalog shortcut hint */}
          {showCommandsMenu && commands.length > 0 && (
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'commands' ? null : 'commands')}
              aria-label="Commands"
              className={cn(
                'promptbar-pill-btn',
                openMenu === 'commands' && 'bg-muted text-foreground border-border'
              )}
            >
              <span className="font-mono text-[10px] text-muted-foreground font-bold">/</span>
              <span className="hidden sm:inline">Presets</span>
            </button>
          )}
        </div>

        {/* Right Execution Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={(!canSubmit && !busy) || disabled}
            onClick={handleTriggerSend}
            aria-label={busy ? 'Stop generation' : 'Send prompt'}
            className={cn(
              'promptbar-action-btn shadow-sm',
              busy ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-primary'
            )}
          >
            {busy ? (
              <HugeiconsIcon icon={StopIcon} size={18} />
            ) : (
              <HugeiconsIcon icon={SentIcon} size={18} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UnifiedPromptBar;
