'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import ComposerWizard from './components/ComposerWizard';
import type { TemplateCategory } from '@/lib/types';

export default function MessageComposerPage() {
    const searchParams = useSearchParams();
    
    // Extract composerContext from URL parameters
    const composerContext = React.useMemo(() => {
        const categoryParam = searchParams?.get('category');
        const meetingId = searchParams?.get('meetingId') || undefined;
        const formId = searchParams?.get('formId') || undefined;
        const surveyId = searchParams?.get('surveyId') || undefined;
        const agreementId = searchParams?.get('agreementId') || undefined;
        
        if (!categoryParam && !meetingId && !formId && !surveyId && !agreementId) {
            return undefined;
        }
        
        // Filter category to supported values
        const supportedCategories = ['forms', 'surveys', 'meetings', 'agreements', 'campaigns', 'reminders', 'general'] as const;
        type SupportedCategory = typeof supportedCategories[number];
        const category = (categoryParam && supportedCategories.includes(categoryParam as any)) 
            ? categoryParam as SupportedCategory
            : undefined;
        
        return {
            category,
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
