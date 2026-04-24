'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import ComposerWizard from './components/ComposerWizard';
import type { TemplateCategory } from '@/lib/types';

export default function MessageComposerPage() {
    const searchParams = useSearchParams();
    
    // Extract composerContext from URL parameters
    const composerContext = React.useMemo(() => {
        const category = searchParams?.get('category') as TemplateCategory | null;
        const meetingId = searchParams?.get('meetingId') || undefined;
        const formId = searchParams?.get('formId') || undefined;
        const surveyId = searchParams?.get('surveyId') || undefined;
        const agreementId = searchParams?.get('agreementId') || undefined;
        
        if (!category && !meetingId && !formId && !surveyId && !agreementId) {
            return undefined;
        }
        
        return {
            category: category || undefined,
            meetingId,
            formId,
            surveyId,
            agreementId,
        };
    }, [searchParams]);

    return (
        <div className="h-full overflow-y-auto ">
            <div className="max-w-5xl mx-auto">
                <ComposerWizard composerContext={composerContext} />
            </div>
        </div>
    );
}
