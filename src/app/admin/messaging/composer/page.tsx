
'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ComposerWizard from './components/ComposerWizard';

export default function MessageComposerPage() {
    return (
        <div className="h-full overflow-y-auto bg-muted/10 p-4 sm:p-6 md:p-8">
            <div className="max-w-5xl mx-auto">
                <div className="mb-8">
                    <Button asChild variant="ghost" className="-ml-2 mb-2 text-muted-foreground hover:text-foreground font-black uppercase text-[10px] tracking-widest h-8">
                        <Link href="/admin/messaging">
                            <ArrowLeft className="mr-2 h-3 w-3" /> Back to Messaging Hub
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3 text-foreground">
                        <Send className="h-8 w-8 text-primary" />
                        Message Composer
                    </h1>
                    <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">Send manual or broadcast communications.</p>
                </div>

                <ComposerWizard />
            </div>
        </div>
    );
}
