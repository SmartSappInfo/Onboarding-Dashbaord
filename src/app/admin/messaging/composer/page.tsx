'use client';

import * as React from 'react';
import ComposerWizard from './components/ComposerWizard';

export default function MessageComposerPage() {
    return (
 <div className="h-full overflow-y-auto bg-background ">
 <div className="max-w-5xl mx-auto">
                <ComposerWizard />
            </div>
        </div>
    );
}
