'use client';

import * as React from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useVoiceDictation } from '@/hooks/use-voice-dictation';

export interface VoiceCaptureButtonProps {
  onTranscript: (newText: string) => void;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'ghost' | 'outline' | 'default';
  /** Max recording duration in seconds (defaults to 300s / 5 mins) */
  maxDurationSeconds?: number;
}

export function VoiceCaptureButton({
  onTranscript,
  className,
  size = 'sm',
  variant = 'outline',
  maxDurationSeconds = 300,
}: VoiceCaptureButtonProps) {
  const { toast } = useToast();
  const [seconds, setSeconds] = React.useState(0);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const {
    isListening,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceDictation({
    onTranscriptChange: (text) => {
      if (text) {
        onTranscript(text);
      }
    },
    onError: (err) => {
      toast({
        title: 'Voice dictation notice',
        description: err,
        variant: 'destructive',
      });
    },
  });

  // Recording timer & max duration limit
  React.useEffect(() => {
    if (isListening) {
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev + 1 >= maxDurationSeconds) {
            stopListening();
            toast({ title: 'Voice capture reached 5-minute maximum limit' });
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setSeconds(0);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isListening, maxDurationSeconds, stopListening, toast]);

  const handleToggle = () => {
    if (!isSupported) {
      toast({
        title: 'Speech recognition unsupported',
        description: 'Your current browser does not support live voice dictation. Please use Google Chrome or Microsoft Edge.',
        variant: 'destructive',
      });
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Button
      type="button"
      variant={isListening ? 'destructive' : variant}
      size={size}
      onClick={handleToggle}
      className={cn(
        'relative gap-1.5 transition-all select-none min-h-[36px] min-w-[36px] md:min-h-[32px] md:min-w-[32px]',
        isListening && 'animate-pulse bg-rose-600 hover:bg-rose-700 text-white shadow-lg border-rose-700',
        className
      )}
      title={isListening ? 'Stop voice recording' : 'Speak to dictate note'}
      aria-label={isListening ? 'Stop voice recording' : 'Speak to dictate note'}
    >
      {isListening ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          <MicOff className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs font-mono font-bold">{formatTimer(seconds)}</span>
        </>
      ) : (
        <>
          <Mic className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
          <span className="text-xs font-medium hidden sm:inline">Voice</span>
        </>
      )}
    </Button>
  );
}
