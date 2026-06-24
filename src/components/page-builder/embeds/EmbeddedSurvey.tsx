'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight, ClipboardList } from 'lucide-react';

/** Launches a standalone survey in a new tab. */
export function EmbeddedSurvey({ surveyId, pageId }: { surveyId: string; pageId?: string }) {
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
        className="w-full h-14 rounded-2xl font-bold text-lg"
      >
        Start Survey
        <ArrowRight className="ml-2 w-5 h-5" />
      </Button>
    </div>
  );
}
