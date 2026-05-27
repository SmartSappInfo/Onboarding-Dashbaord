'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, Pencil, X } from 'lucide-react';
import { Card, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { evaluateFormula } from '@/lib/formula-parser';

interface CorrectionStepProps {
    terms: { singular: string; plural: string };
    failedRowIndices: number[];
    setFailedRowIndices: React.Dispatch<React.SetStateAction<number[]>>;
    rawData: any[];
    mapping: Record<string, string>;
    executionResults: any[];
    setEditingRowIdx: (idx: number | null) => void;
    onReExecute: (indices: number[]) => void;
    onBack: () => void;
}

export function CorrectionStep({
    terms,
    failedRowIndices,
    setFailedRowIndices,
    rawData,
    mapping,
    executionResults,
    setEditingRowIdx,
    onReExecute,
    onBack,
}: CorrectionStepProps) {
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between mb-8">
                <Button variant="ghost" onClick={onBack} className="font-bold gap-2 animate-none">
                    <ArrowLeft size={16} /> Summary
                </Button>
                <h2 className="text-2xl font-semibold text-rose-600">Correction Console</h2>
            </div>
            <Card className="rounded-2xl border border-border shadow-2xl overflow-hidden bg-card">
                <ScrollArea className="h-[500px]">
                    <Table>
                        <TableHeader className="bg-card/20 sticky top-0 z-10 shadow-sm">
                            <TableRow>
                                <TableHead className="pl-8 py-4 font-semibold text-[10px]">Row</TableHead>
                                <TableHead className="py-4 font-semibold text-[10px]">{terms.singular}</TableHead>
                                <TableHead className="py-4 font-semibold text-[10px]">Error</TableHead>
                                <TableHead className="text-right pr-8 font-semibold text-[10px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {failedRowIndices.map(idx => (
                                <TableRow key={idx} className="group hover:bg-rose-50/30 transition-colors">
                                    <TableCell className="pl-8 font-semibold text-xs">#{idx + 1}</TableCell>
                                    <TableCell className="font-bold text-xs">
                                        {(() => {
                                            const nameColVal = mapping['name'] || mapping['contact_0_name'];
                                            if (!nameColVal || nameColVal === 'none') return 'Untitled';
                                            const isFormula = nameColVal?.includes('{{');
                                            return (isFormula ? evaluateFormula(nameColVal, rawData[idx]) : rawData[idx][nameColVal]) || 'Untitled';
                                        })()}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-none text-[10px]">
                                            {executionResults.find(r => r.row === idx)?.error || 'Logic Error'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right pr-8 flex items-center justify-end gap-2 py-4">
                                        <Button variant="ghost" size="icon" onClick={() => setEditingRowIdx(idx)} className="h-8 w-8 text-rose-600 animate-none">
                                            <Pencil size={14} />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => setFailedRowIndices(p => p.filter(i => i !== idx))} className="h-8 w-8 text-muted-foreground animate-none">
                                            <X size={14} />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
                <CardFooter className="bg-rose-500/10 p-8 border-t">
                    <Button onClick={() => onReExecute(failedRowIndices)} disabled={failedRowIndices.length === 0} className="w-full h-14 rounded-xl bg-rose-600 hover:bg-rose-700 font-semibold gap-2 shadow-lg animate-none">
                        <RefreshCw size={16} /> Re-Execute Failures
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
