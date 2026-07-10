# System Specification: Unified Premium AI Prompt Component

This document details the architectural design and UI/UX specification for the unified premium AI prompt component (`<UnifiedPromptInput>`) across the application.

---

## 1. Architectural Architecture & Interface

### 1.1 Props Interface (`src/components/shared/UnifiedPromptInput.tsx`)
The component accepts the following props:

```typescript
export interface StagedAttachment {
  name: string;
  url: string;
  type: 'image' | 'document';
  dataUri?: string;
  content?: string;
}

export interface UnifiedPromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (attachments: StagedAttachment[]) => void | Promise<void>;
  isLoading?: boolean;
  placeholder?: string;
  stagedFiles?: StagedAttachment[];
  onStagedFilesChange?: (files: StagedAttachment[]) => void;
  hideAttachments?: boolean;
  hideModelSelector?: boolean;
  hideAudio?: boolean;
  className?: string;
}
```

---

## 2. Interactive Features

### 2.1 Model Selector Popover
- Employs the existing dynamic `useLiveAiModel` hook.
- Displays a click-to-toggle popover aligned directly underneath the active model string indicator (`Gemini 2.5 Flash`).
- Upon selection change, triggers `updateUserAiPreferencesAction` globally to update the Firestore user document.

### 2.2 Voice Recognition Dictation
- Interacts with browser-native Web Speech API (`webkitSpeechRecognition` or `SpeechRecognition`).
- Renders an animated pulse state on the microphone button.
- Appends transcribed voice input directly to the existing text prompt buffer.

### 2.3 Attachment Previews
- Supports staging multiple files and dragging-and-dropping files.
- Renders image thumbnails and document pills directly above the toolbar within the prompt card.

---

## 3. Integration Plan

### 3.1 Survey Chat Editor
- Replaces standard `<Textarea>` input blocks in `ai-chat-editor.tsx` with `<UnifiedPromptInput>`.

### 3.2 Email Template Architect
- Replaces prompt, upload fields, and text areas in `template-workshop.tsx` visual sidebar with `<UnifiedPromptInput>`.
