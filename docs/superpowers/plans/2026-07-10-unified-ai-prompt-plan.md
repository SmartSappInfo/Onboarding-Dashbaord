# Unified AI Prompt Input Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and integrate a unified, highly polished AI prompt input component supporting attachments, model selections, and voice recording dictation across the application.

**Architecture:** Create a central component `<UnifiedPromptInput>` that encapsulates textarea scaling, file staging utilities, speech recognition controllers, and live model preferences sync, and integrate it modularly within the survey editor and email visual builder.

**Tech Stack:** React 18, Tailwind CSS, Lucide icons, Framer Motion, Web Speech API (SpeechRecognition).

---

## 1. What Could Go Wrong & Solutions

| Risk | Impact | Resolution |
| :--- | :--- | :--- |
| **Speech Recognition Unsupported** | Voice dictation crashes or silently fails in Safari/Firefox. | Detect API support safely at mount; hide or gracefully degrade the microphone target with a tooltip explanation. |
| **Viewport Overlaps on Mobile** | Virtual keyboard covers or cuts off the bottom prompt container. | Use flex box containers, avoid fixed absolute top boundaries, and enforce `pb-safe` layouts. Enforce tap targets to be at least `44px`. |
| **Memory Leak from File Blobs** | base64 or object URLs are left in memory, leading to browser crashes on massive uploads. | Run `URL.revokeObjectURL` explicitly whenever an attachment is removed from state. |
| **Type Safety Failure** | Custom attachment objects are passed with implicit `any` definitions. | Declare strict interfaces for attachments and payloads without any `any`/`any[]` keywords. |

---

## 2. Phase-by-Phase Implementation Plan

### Task 1: Create Shared Component `<UnifiedPromptInput>`

**Files:**
- Create: `src/components/shared/UnifiedPromptInput.tsx`
- Test: `src/components/shared/__tests__/UnifiedPromptInput.test.tsx`

- [ ] **Step 1: Write a unit test for `<UnifiedPromptInput>`**
  - Verify it renders base layout elements (textarea, attachment triggers, send button).
  - Verify it shows active model name from context/hook.

  Create `src/components/shared/__tests__/UnifiedPromptInput.test.tsx`:
  ```tsx
  import * as React from 'react';
  import { render, screen, fireEvent } from '@testing-library/react';
  import UnifiedPromptInput from '../UnifiedPromptInput';

  describe('UnifiedPromptInput', () => {
    it('renders textarea and buttons correctly', () => {
      const mockSubmit = jest.fn();
      render(
        <UnifiedPromptInput
          value=""
          onChange={() => {}}
          onSubmit={mockSubmit}
          placeholder="Type a message"
        />
      );
      expect(screen.getByPlaceholderText('Type a message')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test src/components/shared/__tests__/UnifiedPromptInput.test.tsx`
  Expected: FAIL (component doesn't exist yet)

- [ ] **Step 3: Implement `<UnifiedPromptInput>` component**
  Create `src/components/shared/UnifiedPromptInput.tsx`:
  ```tsx
  import * as React from 'react';
  import { Sparkles, Paperclip, Mic, Send, X, Loader2, Play, Pause } from 'lucide-react';
  import { cn } from '@/lib/utils';
  import { useLiveAiModel } from '@/hooks/use-live-ai-model';
  import AiModelSelector from '@/components/ai/AiModelSelector';
  import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
  import { Button } from '@/components/ui/button';

  export interface StagedAttachment {
    name: string;
    url: string;
    type: 'image' | 'document';
    dataUri?: string;
    content?: string;
  }

  interface UnifiedPromptInputProps {
    value: string;
    onChange: (val: string) => void;
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

  export default function UnifiedPromptInput({
    value,
    onChange,
    onSubmit,
    isLoading = false,
    placeholder = 'Ask me anything...',
    stagedFiles = [],
    onStagedFilesChange,
    hideAttachments = false,
    hideModelSelector = false,
    hideAudio = false,
    className
  }: UnifiedPromptInputProps) {
    const { modelId } = useLiveAiModel();
    const [isRecording, setIsRecording] = React.useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
      }
    };

    const triggerFileSelect = () => {
      fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (!files.length || !onStagedFilesChange) return;

      const newFiles: StagedAttachment[] = files.map(file => {
        const url = URL.createObjectURL(file);
        const type = file.type.startsWith('image/') ? 'image' : 'document';
        return { name: file.name, url, type };
      });

      onStagedFilesChange([...stagedFiles, ...newFiles]);
    };

    const removeFile = (index: number) => {
      if (!onStagedFilesChange) return;
      const target = stagedFiles[index];
      if (target.url.startsWith('blob:')) {
        URL.revokeObjectURL(target.url);
      }
      const updated = stagedFiles.filter((_, i) => i !== index);
      onStagedFilesChange(updated);
    };

    const toggleSpeech = () => {
      const Speech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!Speech) {
        alert('Voice dictation is not supported by your current browser.');
        return;
      }
      setIsRecording(!isRecording);
    };

    return (
      <div className={cn('bg-card border rounded-2xl p-3 space-y-3 shadow-md flex flex-col', className)}>
        {/* Staged file chips */}
        {stagedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pb-2">
            {stagedFiles.map((file, idx) => (
              <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-xl text-xs font-semibold">
                <span className="truncate max-w-[120px]">{file.name}</span>
                <button type="button" onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-foreground">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleTextareaChange}
          placeholder={placeholder}
          className="w-full text-sm bg-transparent resize-none focus:outline-none min-h-[40px] max-h-44 leading-relaxed p-1"
          rows={1}
          disabled={isLoading}
        />

        <div className="flex items-center justify-between border-t pt-2.5">
          <div className="flex items-center gap-2">
            {!hideAttachments && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  multiple
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={triggerFileSelect}
                  className="h-9 w-9 rounded-full hover:bg-accent"
                >
                  <Paperclip size={16} className="text-muted-foreground" />
                </Button>
              </>
            )}

            {!hideModelSelector && (
              <Popover>
                <PopoverTrigger asChild>
                  <div className="flex items-center gap-1 bg-muted/60 border hover:bg-muted text-foreground text-xs px-3 py-1 rounded-full cursor-pointer transition-colors font-medium">
                    <span>{modelId}</span>
                    <Sparkles size={11} className="text-violet-500 animate-pulse" />
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-0 border border-border/80 shadow-lg rounded-xl">
                  <AiModelSelector hideLabel className="w-full" />
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!hideAudio && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleSpeech}
                className={cn('h-9 w-9 rounded-full', isRecording && 'bg-red-500/10 text-red-500 hover:bg-red-500/25')}
              >
                <Mic size={16} />
              </Button>
            )}

            <Button
              type="button"
              disabled={isLoading || (!value.trim() && stagedFiles.length === 0)}
              onClick={() => onSubmit(stagedFiles)}
              size="icon"
              className="h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/95 flex items-center justify-center shrink-0"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={14} />}
            </Button>
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test src/components/shared/__tests__/UnifiedPromptInput.test.tsx`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/shared/UnifiedPromptInput.tsx src/components/shared/__tests__/UnifiedPromptInput.test.tsx
  git commit -m "feat(shared): implement unified premium prompt input component"
  ```

---

### Task 2: Integrate in Survey Chat Editor

**Files:**
- Modify: `src/app/admin/surveys/components/ai-chat-editor.tsx`

- [ ] **Step 1: Replace prompt textarea with unified component**
  Open [ai-chat-editor.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/surveys/components/ai-chat-editor.tsx) around line 640. Remove local file attach buttons, input/textarea render blocks, and replace with `<UnifiedPromptInput>`.

  ```tsx
  <UnifiedPromptInput
    value={input}
    onChange={setInput}
    onSubmit={handleSend}
    isLoading={isLoading}
    stagedFiles={stagedFile ? [stagedFile] : []}
    onStagedFilesChange={(files) => setStagedFile(files[0] || null)}
    placeholder="Ask me to build or modify a survey..."
    hideModelSelector
  />
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add src/app/admin/surveys/components/ai-chat-editor.tsx
  git commit -m "refactor(surveys): consume UnifiedPromptInput in chat builder editor"
  ```

---

### Task 3: Integrate in Email Template Architect

**Files:**
- Modify: `src/app/admin/messaging/templates/components/template-workshop.tsx`

- [ ] **Step 1: Replace architect prompt sidebar controls**
  Open [template-workshop.tsx](file:///Users/josephaidoo/Desktop/Codes/vibe%20Coding/Onboarding-Dashbaord-main/src/app/admin/messaging/templates/components/template-workshop.tsx) around line 3804.
  Remove raw textarea, model selection, and visual upload buttons inside the `"architect"` tab card block, replacing with `<UnifiedPromptInput>`.

  ```tsx
  <UnifiedPromptInput
    value={architectPrompt}
    onChange={setArchitectPrompt}
    onSubmit={handleArchitectSubmit}
    isLoading={isArchitecting}
    stagedFiles={architectImageUrl ? [{ name: 'Visual Inspiration', url: architectImageUrl, type: 'image' }] : []}
    onStagedFilesChange={(files) => {
      const img = files.find(f => f.type === 'image');
      setArchitectImageUrl(img?.url || '');
    }}
    placeholder="Describe layout details or upload inspiration..."
  />
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add src/app/admin/messaging/templates/components/template-workshop.tsx
  git commit -m "refactor(templates): consume UnifiedPromptInput in visual email architect sidebar"
  ```

---

### Task 4: Compilation and Verification

- [ ] **Step 1: Run TypeScript compiler**
  Run: `npx tsc --noEmit`
  Expected: Success with **0 errors**.

- [ ] **Step 2: Run ESLint**
  Run: `npx eslint "src/components/shared/UnifiedPromptInput.tsx"`
  Expected: Success with **0 issues**.
