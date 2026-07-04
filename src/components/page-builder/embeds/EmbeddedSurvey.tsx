'use client';

import { useEffect, useState } from 'react';
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
  const [size, setSize] = useState({ height: 600, width: 512 });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'survey_submitted' && event.data?.surveyId === surveyId) {
        onClose?.();
      }
      if (event.data?.type === 'iframe_resize' && event.data?.height) {
        setSize({
          height: event.data.height,
          width: event.data.width || 512
        });
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [surveyId, onClose]);

  if (displayMode === 'inline' || isInModal) {
    const embedUrl = `/surveys/${surveyId}?embed=true${pageId ? `&sourcePageId=${pageId}` : ''}`;
    return (
      <div 
        className="w-full flex flex-col bg-transparent relative rounded-2xl overflow-hidden shadow-inner transition-all duration-200"
        style={{
          height: isInModal ? `${size.height}px` : '600px',
          maxHeight: '100%',
        }}
      >
        <iframe
          src={embedUrl}
          className="w-full flex-grow border-0 bg-transparent"
          style={{ height: '100%' }}
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
        onClick={() => window.open(`/surveys/${surveyId}${pageId ? `?ref=${pageId}` : ''}`, '_blank', 'noopener,noreferrer')}
        className="w-full h-14 rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-[0.97] transition-all duration-200"
      >
        Start Survey
        <ArrowRight className="ml-2 w-5 h-5" />
      </Button>
    </div>
  );
}
