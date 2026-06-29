'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, ClipboardList } from 'lucide-react';

interface EmbeddedSurveyProps {
  surveyId: string;
  pageId?: string;
  displayMode?: 'inline' | 'button';
  isInModal?: boolean;
  onClose?: () => void;
}

export function EmbeddedSurvey({ surveyId, pageId, displayMode = 'inline', isInModal = false, onClose }: EmbeddedSurveyProps) {
  useEffect(() => {
    if (!isInModal) return;
    
    // Listen for completion postMessage from the iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'survey_submitted' && event.data?.surveyId === surveyId) {
        onClose?.();
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isInModal, surveyId, onClose]);

  if (displayMode === 'inline' || isInModal) {
    const embedUrl = `/s/${surveyId}?embed=true${pageId ? `&sourcePageId=${pageId}` : ''}`;
    return (
      <div className="w-full min-h-[600px] h-full flex flex-col bg-transparent relative rounded-2xl overflow-hidden border border-slate-100 dark:border-zinc-800 shadow-inner">
        <iframe
          src={embedUrl}
          className="w-full flex-grow min-h-[600px] border-0 bg-transparent"
          title="Embedded Survey"
          allow="geolocation; microphone; camera"
        />
      </div>
    );
  }

  return (
    <div className="text-center p-12 space-y-6">
      <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto text-primary">
        <ClipboardList className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Survey</h2>
        <p className="text-slate-500 font-medium">Complete our brief survey to continue.</p>
      </div>
      <Button
        onClick={() => window.open(`/s/${surveyId}${pageId ? `?ref=${pageId}` : ''}`, '_blank', 'noopener,noreferrer')}
        className="w-full h-14 rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-[0.97] transition-all duration-200"
      >
        Start Survey
        <ArrowRight className="ml-2 w-5 h-5" />
      </Button>
    </div>
  );
}
