/**
 * @fileoverview Universal AI PromptBar Type Definitions
 *
 * ARCHITECTURAL GUIDELINES (Strict Zero-Any Invariant & Standards):
 * 1. Strict Typing: Completely typed interfaces for sources, models, commands, effort levels, and attachments.
 * 2. Theme Agnostic: Models and commands can accept either Hugeicons IconSvgElement or React Lucide components.
 * 3. Bidirectional Integration: Supports both controlled and uncontrolled patterns.
 */

import type { ComponentType } from 'react';
import type { IconSvgElement } from '@hugeicons/react';
import type { SourceFileType } from '@/lib/surveys/survey-source-extractor';

export type PromptBarEffortLevel = 'low' | 'medium' | 'high' | 'max';

export interface PromptBarSourceItem {
  key: string;
  name: string;
  description: string;
  icon?: IconSvgElement | ComponentType<{ className?: string; size?: number }>;
  attach?: boolean;
  action?: () => void;
}

export interface PromptBarModelItem {
  key: string;
  name: string;
  description: string;
  badge?: string;
  provider?: string;
  multimodal?: boolean;
}

export interface PromptBarCommandItem {
  key: string;
  label: string;
  description: string;
  icon?: IconSvgElement | ComponentType<{ className?: string; size?: number }>;
  action?: () => void;
  promptText?: string;
}

export interface PromptBarAttachment {
  id: string;
  name: string;
  size: number;
  type: SourceFileType;
  thumbnailUrl?: string;
  content?: string;
  charCount?: number;
  pageCount?: number;
  status: 'ready' | 'extracting' | 'error';
  errorMessage?: string;
}

export interface UnifiedPromptBarProps {
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  busy?: boolean;
  sources?: PromptBarSourceItem[];
  models?: PromptBarModelItem[];
  activeModelKey?: string;
  onModelChange?: (model: PromptBarModelItem) => void;
  effort?: PromptBarEffortLevel;
  onEffortChange?: (effort: PromptBarEffortLevel) => void;
  commands?: PromptBarCommandItem[];
  attachments?: PromptBarAttachment[];
  onAttachmentsChange?: (attachments: PromptBarAttachment[]) => void;
  onFileSelected?: (files: FileList | File[]) => void;
  onSend?: (
    text: string,
    context: {
      attachments: PromptBarAttachment[];
      model?: PromptBarModelItem;
      effort: PromptBarEffortLevel;
    }
  ) => void | Promise<void>;
  onCancel?: () => void;
  className?: string;
  disabled?: boolean;
  showModelSelector?: boolean;
  showEffortSelector?: boolean;
  showSourcesMenu?: boolean;
  showCommandsMenu?: boolean;
  autoFocus?: boolean;
}
