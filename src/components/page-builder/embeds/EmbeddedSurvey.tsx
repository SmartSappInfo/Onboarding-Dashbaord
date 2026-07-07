'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmbeddedSurveyProps {
  surveyId: string;
  pageId?: string;
  displayMode?: 'inline' | 'button';
  isInModal?: boolean;
  onClose?: () => void;
  showIcon?: boolean;
  showHeader?: boolean;
  headerText?: string;
  showDescription?: boolean;
  descriptionText?: string;
  buttonText?: string;
  buttonStyle?: 'primary' | 'secondary' | 'glass' | 'glow';
  primaryColor?: string;
}

export function EmbeddedSurvey({ 
  surveyId, 
  pageId, 
  displayMode = 'inline', 
  isInModal = false, 
  onClose,
  showIcon = true,
  showHeader = true,
  headerText = 'Survey',
  showDescription = true,
  descriptionText = 'Complete our brief survey to continue.',
  buttonText = 'Start Survey',
  buttonStyle = 'primary',
  primaryColor = '#3B5FFF'
}: EmbeddedSurveyProps) {
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

  const isOutline = buttonStyle === 'secondary';
  const resolvedPrimaryColor = primaryColor || '#3B5FFF';
  const customButtonStyle: React.CSSProperties = isOutline
    ? { borderColor: resolvedPrimaryColor, color: resolvedPrimaryColor, borderWidth: '2px', backgroundColor: 'transparent' }
    : { backgroundColor: resolvedPrimaryColor, color: '#ffffff' };

  return (
    <div className="text-center p-12 space-y-6">
      {showIcon && (
        <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto text-primary">
          <ClipboardList className="h-8 w-8" />
        </div>
      )}
      {(showHeader || showDescription) && (
        <div className="space-y-2">
          {showHeader && <h2 className="text-2xl font-bold">{headerText}</h2>}
          {showDescription && <p className="text-slate-500 font-medium">{descriptionText}</p>}
        </div>
      )}
      <Button
        onClick={() => window.open(`/surveys/${surveyId}${pageId ? `?ref=${pageId}` : ''}`, '_blank', 'noopener,noreferrer')}
        className={cn(
          "w-full h-14 rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-[0.97] transition-all duration-200 gap-2 flex items-center justify-center",
          buttonStyle === 'glass' && 'backdrop-blur-md border border-white/30',
          buttonStyle === 'glow' && 'shadow-[0_0_20px_rgba(59,95,255,0.3)]',
        )}
        style={customButtonStyle}
      >
        {buttonText}
        <ArrowRight className="ml-2 w-5 h-5" />
      </Button>
    </div>
  );
}
