'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

interface ExecutionStepProps {
    totalRows: number;
    entityPluralName: string;
    workspaceName?: string;
}

export function ExecutionStep({
    totalRows,
    entityPluralName,
    workspaceName,
}: ExecutionStepProps) {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-8">
            <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
                <Loader2 className="h-20 w-20 animate-spin text-primary relative" />
            </div>
            <div className="text-center">
                <h2 className="text-3xl font-semibold">Processing Import</h2>
                <p className="mt-3 text-muted-foreground font-bold">
                    Importing {totalRows} {entityPluralName.toLowerCase()} into {workspaceName || 'workspace'}…
                </p>
            </div>
        </div>
    );
}
