'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Eye, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { evaluateFormula } from '@/lib/formula-parser';
import { normalizePhoneNumber } from '@/lib/phone-utils';

interface ImportPreviewStepProps {
    terms: { singular: string; plural: string };
    rawData: any[];
    mapping: Record<string, string>;
    targetFields: any[];
    onBack: () => void;
    onExecute: () => void;
    stepperMarkup?: React.ReactNode;
}

export function ImportPreviewStep({
    terms,
    rawData,
    mapping,
    targetFields,
    onBack,
    onExecute,
    stepperMarkup,
}: ImportPreviewStepProps) {
    const activeMappedFields = React.useMemo(() => {
        return targetFields.filter(f => mapping[f.key] && mapping[f.key] !== 'none');
    }, [targetFields, mapping]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Data Preview</h2>
                    <p className="text-sm text-muted-foreground mt-1">Final validation before ingestion.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="ghost" onClick={onBack} className="rounded-xl h-11 px-4 font-semibold text-sm hover:bg-primary/5 animate-none">
                        <ArrowLeft size={16} className="mr-2" /> Adjust Settings
                    </Button>
                    <Badge className="bg-primary/10 text-primary border-none px-4 h-11 rounded-xl text-xs font-bold uppercase tracking-widest">
                        {rawData.length} Rows Ready
                    </Badge>
                </div>
            </div>

            {stepperMarkup}

            <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-card overflow-hidden">
                <CardHeader className="border-b p-8 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-primary/5 text-primary">
                            <Eye size={22} />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-bold">Verification</CardTitle>
                            <CardDescription className="text-xs font-medium">Verify mapped values before importing.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[400px]">
                        <Table>
                            <TableHeader className="bg-muted/30 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="pl-6 py-3 text-[10px] font-bold w-12 bg-muted/30">#</TableHead>
                                    {activeMappedFields.map(f => (
                                        <TableHead key={f.key} className="py-3 text-[10px] font-bold bg-muted/30">{f.label}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rawData.slice(0, 10).map((row, i) => (
                                    <TableRow key={i} className="hover:bg-primary/5 transition-colors">
                                        <TableCell className="pl-6 font-semibold text-xs text-muted-foreground">{i + 1}</TableCell>
                                        {activeMappedFields.map(f => {
                                            const colVal = mapping[f.key];
                                            const isFormula = colVal.includes('{{');
                                            let displayVal: any;
                                            if (isFormula) {
                                                displayVal = evaluateFormula(colVal, row);
                                            } else if (row[colVal] !== undefined && row[colVal] !== null) {
                                                displayVal = row[colVal];
                                            } else {
                                                // Literal custom value (e.g. a custom role typed by the user)
                                                displayVal = colVal;
                                            }
                                            if (displayVal && f.key.includes('phone')) {
                                                const defaultCountry = 'GH';
                                                const parsed = normalizePhoneNumber(String(displayVal), defaultCountry);
                                                displayVal = parsed.e164 || displayVal;
                                            }
                                            return (
                                                <TableCell key={f.key} className="text-xs font-medium max-w-[200px] truncate">
                                                    {String(displayVal || '—')}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                                {rawData.length > 10 && (
                                    <TableRow>
                                        <TableCell colSpan={activeMappedFields.length + 1} className="text-center py-4 text-xs font-semibold text-muted-foreground italic bg-muted/10">
                                            ... and {rawData.length - 10} more rows (only previewing top 10 rows for optimal performance)
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
                <CardFooter className="p-8 border-t bg-primary/5">
                    <Button onClick={onExecute} className="w-full h-14 rounded-xl font-bold text-lg shadow-lg shadow-primary/20 bg-primary text-white gap-2 transition-all active:scale-[0.98] animate-none">
                        <Zap size={20} /> Import {rawData.length} {terms.plural}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
