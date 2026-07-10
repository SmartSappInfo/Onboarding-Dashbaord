'use client';

import * as React from 'react';
import { Sparkles, Paperclip, Mic, Send, X, Loader2 } from 'lucide-react';
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
  onFileSelect?: (files: File[]) => void | Promise<void>;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: {
    resultIndex: number;
    results: {
      [index: number]: {
        [index: number]: {
          transcript: string;
        };
        isFinal: boolean;
      };
      length: number;
    };
  }) => void) | null;
  start: () => void;
  stop: () => void;
}

interface WindowWithSpeechRecognition extends Window {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
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
  className,
  onFileSelect,
  onPaste
}: UnifiedPromptInputProps) {
  const { modelId } = useLiveAiModel();
  const [isRecording, setIsRecording] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const recognitionRef = React.useRef<SpeechRecognitionInstance | null>(null);

  React.useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

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
    if (!files.length) return;

    if (onFileSelect) {
      void onFileSelect(files);
      return;
    }

    if (!onStagedFilesChange) return;

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

  const startRecording = () => {
    const Speech = (window as unknown as WindowWithSpeechRecognition).SpeechRecognition ||
                   (window as unknown as WindowWithSpeechRecognition).webkitSpeechRecognition;
    if (!Speech) {
      alert('Voice dictation is not supported by your current browser.');
      return;
    }

    const recognition = new Speech();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let baseText = value;

    recognition.onstart = () => {
      setIsRecording(true);
      baseText = value;
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const updatedValue = baseText + (baseText ? ' ' : '') + finalTranscript + interimTranscript;
      onChange(updatedValue);
    };

    recognition.onerror = (err) => {
      console.error('Speech recognition error:', err.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const toggleSpeech = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && (value.trim() || stagedFiles.length > 0)) {
        onSubmit(stagedFiles);
      }
    }
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
        onKeyDown={handleKeyDown}
        onPaste={onPaste}
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
                aria-label="Attach files"
              >
                <Paperclip size={16} className="text-muted-foreground" />
              </Button>
            </>
          )}

          {!hideModelSelector && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 bg-muted/60 border hover:bg-muted text-foreground text-xs px-3 py-1.5 rounded-full cursor-pointer transition-colors font-medium"
                >
                  <Sparkles size={11} className="text-violet-500 animate-pulse" />
                  <span>{modelId}</span>
                </button>
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
              className={cn('h-9 w-9 rounded-full transition-colors', isRecording && 'bg-red-500/10 text-red-500 hover:bg-red-500/20')}
              aria-label={isRecording ? "Stop voice recording" : "Start voice recording"}
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
            aria-label="Send"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={14} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
