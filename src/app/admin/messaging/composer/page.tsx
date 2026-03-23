'use client';

import * as React from 'react';
import ComposerWizard from './components/ComposerWizard';

export default function MessageComposerPage() {
    return (
        <div className="h-full overflow-y-auto bg-muted/10 p-4 sm:p-6 md:p-8">
            <div className="max-w-5xl mx-auto">
                <ComposerWizard />
            </div>
        </div>
    );
}
