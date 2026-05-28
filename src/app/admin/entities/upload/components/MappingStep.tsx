'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Table as TableIcon, UserPlus, Trash2, Users, FileText, Zap, Plus, Database, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { DefaultValueRow } from './DefaultValueRow';

interface MappingStepProps {
    terms: { singular: string; plural: string };
    contactScope: string;
    activeWorkspace: any;
    headers: string[];
    rawData: any[];
    mapping: Record<string, string>;
    setMapping: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    defaultValues: Record<string, string>;
    setDefaultValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    contactSlotCount: number;
    setContactSlotCount: React.Dispatch<React.SetStateAction<number>>;
    allMappableFields: any[];
    regionsList: any[] | null | undefined;
    districtsList: any[] | null | undefined;
    packagesList: any[] | null | undefined;
    modulesList: any[] | null | undefined;
    workspaceStatuses: any[];
    onBack: () => void;
    onNext: () => void;
    stepperMarkup?: React.ReactNode;
    appFieldsList?: any[] | null;
}

export function MappingStep({
    terms,
    contactScope,
    activeWorkspace,
    headers,
    rawData,
    mapping,
    setMapping,
    defaultValues,
    setDefaultValues,
    contactSlotCount,
    setContactSlotCount,
    allMappableFields,
    regionsList,
    districtsList,
    packagesList,
    modulesList,
    workspaceStatuses,
    onBack,
    onNext,
    stepperMarkup,
    appFieldsList,
}: MappingStepProps) {
    const [selectedFormulaField, setSelectedFormulaField] = React.useState<string>('');
    const [formulaInputValue, setFormulaInputValue] = React.useState<string>('');
    const formulaInputRef = React.useRef<HTMLInputElement | null>(null);

    const handleAddFormulaMapping = React.useCallback(() => {
        if (!selectedFormulaField || !formulaInputValue.trim()) return;
        setMapping(prev => {
            const next = { ...prev };
            next[selectedFormulaField] = formulaInputValue.trim();
            return next;
        });
        setFormulaInputValue('');
        setSelectedFormulaField('');
    }, [selectedFormulaField, formulaInputValue, setMapping]);

    const handleDeleteFormulaMapping = React.useCallback((fieldKey: string) => {
        setMapping(prev => {
            const next = { ...prev };
            delete next[fieldKey];
            return next;
        });
    }, [setMapping]);

    const insertColumnPlaceholder = React.useCallback((header: string) => {
        const input = formulaInputRef.current;
        if (!input) {
            setFormulaInputValue(prev => prev + `{{${header}}}`);
            return;
        }
        const start = input.selectionStart ?? formulaInputValue.length;
        const end = input.selectionEnd ?? formulaInputValue.length;
        const text = formulaInputValue;
        const before = text.substring(0, start);
        const after = text.substring(end, text.length);
        const newValue = before + `{{${header}}}` + after;
        setFormulaInputValue(newValue);
        const newCursorPos = start + header.length + 4;
        setTimeout(() => {
            input.focus();
            input.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    }, [formulaInputValue]);

    const handleDefaultValueChange = React.useCallback((key: string, val: string) => {
        setDefaultValues(prev => ({ ...prev, [key]: val }));
    }, [setDefaultValues]);

    const handleDeleteDefaultValue = React.useCallback((key: string) => {
        setDefaultValues(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, [setDefaultValues]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Schema Correlation</h2>
                    <p className="text-sm text-muted-foreground mt-1">Map your spreadsheet columns to workspace fields.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="ghost" onClick={onBack} className="rounded-xl h-11 px-4 font-semibold text-sm hover:bg-primary/5 animate-none">
                        <ArrowLeft size={16} className="mr-2" /> Change File
                    </Button>
                    <Badge className="bg-primary/10 text-primary border-none px-4 h-11 rounded-xl text-xs font-bold uppercase tracking-widest">
                        {rawData.length} {rawData.length === 1 ? terms.singular : terms.plural}
                    </Badge>
                </div>
            </div>

            {stepperMarkup}

            <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-card overflow-hidden">
                <CardHeader className="border-b p-8 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-primary/5 text-primary">
                            <TableIcon size={22} />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-bold">Field Mapping</CardTitle>
                            <CardDescription className="text-xs font-medium">Verify each column maps to the correct property.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    {/* Contact Slots Controls & Explicit Mapping */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-lg font-bold">Entity Contacts Mapping</p>
                                <p className="text-sm text-muted-foreground">Map your spreadsheet columns to specific contact properties.</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setContactSlotCount(c => c + 1)} className="gap-1.5 border-violet-200 text-violet-600 hover:bg-violet-50 hover:border-violet-300 font-bold text-xs h-9 px-4 rounded-xl animate-none">
                                <UserPlus size={14} /> Add Another Contact
                            </Button>
                        </div>

                        {Array.from({ length: contactSlotCount }).map((_, idx) => (
                            <div key={idx} className="p-5 rounded-xl border border-violet-200/50 bg-violet-500/5 relative">
                                {idx > 0 && idx === contactSlotCount - 1 && (
                                    <Button 
                                        variant="ghost" 
                                        size="icon"
                                        className="absolute top-3 right-3 text-rose-500 hover:text-rose-600 hover:bg-rose-50 h-8 w-8 animate-none"
                                        onClick={() => {
                                            setMapping(prev => {
                                                const next = { ...prev };
                                                delete next[`contact_${idx}_name`];
                                                delete next[`contact_${idx}_email`];
                                                delete next[`contact_${idx}_phone`];
                                                delete next[`contact_${idx}_role`];
                                                return next;
                                            });
                                            setContactSlotCount(c => c - 1);
                                        }}
                                    >
                                        <Trash2 size={16} />
                                    </Button>
                                )}
                                <h4 className="font-bold text-sm mb-4 text-violet-700 flex items-center gap-2">
                                    <Users size={16} /> Contact {idx + 1} {idx === 0 ? '(Primary & Signatory)' : ''}
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {['name', 'email', 'phone', 'role'].map(prop => {
                                        const fieldKey = `contact_${idx}_${prop}`;
                                        const rawValue = mapping[fieldKey];
                                        const hasMapping = rawValue !== undefined;
                                        const currentHeader = rawValue || 'none';
                                        // Custom role mode: key exists in mapping, but value is NOT a CSV column header
                                        const isCustomRoleMode = prop === 'role' && hasMapping && !headers.includes(rawValue ?? '');
                                        return (
                                            <div key={prop} className="space-y-1.5">
                                                <Label className="text-xs font-semibold capitalize text-violet-800">{prop}</Label>
                                                {isCustomRoleMode ? (
                                                    <div className="relative">
                                                        <Input
                                                            value={rawValue || ''}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setMapping(prev => ({ ...prev, [fieldKey]: val }));
                                                            }}
                                                            placeholder="e.g. Champion, Admin, Sponsor"
                                                            autoFocus
                                                            className="h-10 pr-10 bg-background border-violet-200 text-violet-900 font-semibold shadow-sm focus-visible:ring-1 focus-visible:ring-violet-300"
                                                        />
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="absolute right-1 top-1 h-8 w-8 text-violet-600 hover:bg-violet-50 hover:text-violet-700 animate-none"
                                                            onClick={() => {
                                                                setMapping(prev => {
                                                                    const next = { ...prev };
                                                                    delete next[fieldKey];
                                                                    return next;
                                                                });
                                                            }}
                                                            title="Switch back to column selector"
                                                        >
                                                            <Database size={14} />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Select 
                                                        value={currentHeader}
                                                        onValueChange={(headerVal) => {
                                                            setMapping(prev => {
                                                                const next = { ...prev };
                                                                if (headerVal === 'none') {
                                                                    delete next[fieldKey];
                                                                } else if (headerVal === '__custom__') {
                                                                    // Set to empty string to trigger custom input mode
                                                                    next[fieldKey] = '';
                                                                } else {
                                                                    Object.keys(next).forEach(k => {
                                                                        if (next[k] === headerVal && k.startsWith('contact_')) delete next[k];
                                                                    });
                                                                    next[fieldKey] = headerVal;
                                                                }
                                                                return next;
                                                            });
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-10 bg-background border-violet-200 text-violet-900 font-semibold shadow-sm">
                                                            <SelectValue placeholder="-- Unmapped --" />
                                                        </SelectTrigger>
                                                        <SelectContent className="max-h-[300px]">
                                                            <SelectItem value="none">-- Unmapped --</SelectItem>
                                                            {prop === 'role' && (
                                                                <SelectItem value="__custom__" className="text-violet-700 font-bold text-xs py-2 border-b border-violet-100">
                                                                    <span className="flex items-center gap-2">
                                                                        <Plus size={14} />
                                                                        <span>Enter Custom Role...</span>
                                                                    </span>
                                                                </SelectItem>
                                                            )}
                                                            {headers.filter(h => h && h.trim() !== "").map(h => {
                                                                const mappedTo = Object.entries(mapping).find(([k, v]) => v === h && k.startsWith('contact_'))?.[0];
                                                                const isUsed = mappedTo && mappedTo !== fieldKey;
                                                                return (
                                                                    <SelectItem key={h} value={h} className={cn("font-semibold", isUsed && "opacity-60 text-muted-foreground")}>
                                                                        {h} {isUsed ? `(Used)` : ''}
                                                                    </SelectItem>
                                                                );
                                                            })}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CSV Column → Entity Field Mapping */}
                    <div className="pt-8 border-t border-border/50">
                        <div className="mb-6">
                            <p className="text-lg font-bold">Additional {terms.singular} Details</p>
                            <p className="text-sm text-muted-foreground">Map remaining columns to {terms.singular.toLowerCase()}-level properties.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                            {headers.map((csvHeader) => {
                                const entityMappedFieldKey = Object.entries(mapping).find(([k, v]) => v === csvHeader && !k.startsWith('contact_'))?.[0] || 'none';
                                const mappedContactFields = Object.entries(mapping).filter(([k, v]) => v === csvHeader && k.startsWith('contact_'));
                                
                                if (mappedContactFields.length > 0) {
                                    return null;
                                }

                                return (
                                    <div key={csvHeader} className="space-y-2">
                                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1 flex items-center gap-2">
                                            <FileText className="h-3 w-3 text-primary/50" />
                                            {csvHeader}
                                        </Label>
                                        <Select 
                                            value={entityMappedFieldKey} 
                                            onValueChange={(entityKey) => {
                                                setMapping(prev => {
                                                    const next = { ...prev };
                                                    Object.keys(next).forEach(k => {
                                                        if (next[k] === csvHeader && !k.startsWith('contact_')) delete next[k];
                                                    });
                                                    if (entityKey !== 'none') {
                                                        delete next[entityKey];
                                                        next[entityKey] = csvHeader;
                                                    }
                                                    return next;
                                                });
                                            }}
                                        >
                                            <SelectTrigger className={cn(
                                                "h-12 rounded-xl border-none shadow-inner font-bold transition-colors",
                                                entityMappedFieldKey === 'none' 
                                                    ? "bg-background/50 text-muted-foreground"
                                                    : "bg-primary/5 text-primary ring-1 ring-primary/20"
                                            )}>
                                                <SelectValue placeholder="-- Skip Column --" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl max-h-[350px]">
                                                <SelectItem value="none">-- Skip Column --</SelectItem>
                                                <div className="px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/50 mt-1">Entity Fields</div>
                                                {allMappableFields.filter(f => !f.key.startsWith('contact_')).map(f => {
                                                    const alreadyMappedTo = mapping[f.key];
                                                    const isUsed = alreadyMappedTo && alreadyMappedTo !== csvHeader;
                                                    return (
                                                        <SelectItem key={f.key} value={f.key} className={cn("font-semibold", isUsed && "opacity-60 text-muted-foreground")}>
                                                            {f.label} {f.required ? '(Required)' : ''} {isUsed ? `← ${alreadyMappedTo}` : ''}
                                                        </SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Formula-based Mappings */}
                    <div className="pt-8 border-t border-border/50 space-y-6">
                        <div>
                            <p className="text-lg font-bold flex items-center gap-2">
                                <Zap className="h-5 w-5 text-indigo-500 animate-pulse" />
                                Custom Formula Expressions
                            </p>
                            <p className="text-sm text-muted-foreground">Construct dynamic computed fields by referencing CSV columns inside double curly braces (e.g. <code>{"{{First Name}} {{Last Name}}"}</code>).</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end p-6 rounded-2xl border border-indigo-200/40 bg-indigo-500/[0.02]">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-indigo-800 dark:text-indigo-400">1. Select Target Field</Label>
                                <Select value={selectedFormulaField} onValueChange={setSelectedFormulaField}>
                                    <SelectTrigger className="h-11 rounded-xl bg-background border-indigo-200">
                                        <SelectValue placeholder="Select property..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl max-h-[300px]">
                                        {allMappableFields.filter(f => !mapping[f.key] || mapping[f.key].includes('{{')).map(f => (
                                            <SelectItem key={f.key} value={f.key} className="font-semibold">{f.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs font-bold text-indigo-800 dark:text-indigo-400">2. Enter Text / Logic Pattern</Label>
                                    <span className="text-[10px] text-muted-foreground font-semibold">Prepend <code>=</code> for mathematical calculations</span>
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        ref={formulaInputRef}
                                        placeholder="e.g. {{First Name}} {{Last Name}}"
                                        value={formulaInputValue}
                                        onChange={(e) => setFormulaInputValue(e.target.value)}
                                        className="h-11 rounded-xl bg-background border-indigo-200 text-sm font-semibold"
                                    />
                                    <Button
                                        onClick={handleAddFormulaMapping}
                                        disabled={!selectedFormulaField || !formulaInputValue.trim()}
                                        className="h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0 px-6 animate-none"
                                    >
                                        Add Formula
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {headers.length > 0 && (
                            <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-950 bg-indigo-500/[0.01] space-y-3">
                                <span className="text-[10px] font-bold text-indigo-800 dark:text-indigo-400 uppercase tracking-wider block">Available CSV Column Placeholders</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {headers.map(h => (
                                        <button
                                            key={h}
                                            onClick={() => insertColumnPlaceholder(h)}
                                            className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-indigo-100 hover:border-indigo-300 bg-background hover:bg-indigo-50 dark:hover:bg-indigo-950 text-indigo-700 dark:text-indigo-400 transition-all font-mono shadow-sm"
                                        >
                                            {`{{${h}}}`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {Object.keys(mapping).some(key => typeof mapping[key] === 'string' && mapping[key].includes('{{')) && (
                            <div className="space-y-3 pt-2">
                                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest block">Active Formulas</span>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Object.entries(mapping)
                                        .filter(([_, val]) => typeof val === 'string' && val.includes('{{'))
                                        .map(([key, val]) => {
                                            const field = allMappableFields.find(f => f.key === key);
                                            const isMath = val.trim().startsWith('=');
                                            return (
                                                <div key={key} className="flex items-center justify-between p-4 rounded-xl border border-border/85 bg-background shadow-inner">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-foreground">{field?.label || key}</span>
                                                            <Badge className={cn("text-[9px] font-bold px-1.5 py-0.5 border-none", isMath ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800")}>
                                                                {isMath ? 'Math' : 'Text'}
                                                            </Badge>
                                                        </div>
                                                        <code className="text-xs font-mono text-muted-foreground block bg-muted/50 px-2 py-0.5 rounded border border-border/40 truncate max-w-[280px]">
                                                            {val}
                                                        </code>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDeleteFormulaMapping(key)}
                                                        className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg animate-none"
                                                    >
                                                        <Trash2 size={15} />
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Default Values Controls */}
                    <div className="pt-6 border-t border-border/50">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/10 rounded-xl"><Plus size={16} className="text-amber-600" /></div>
                                <div>
                                    <p className="text-sm font-bold">Default Field Values</p>
                                    <p className="text-[10px] text-muted-foreground font-medium">Apply a fixed value to all records if missing or unmapped</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Select onValueChange={(key) => {
                                    if (key && key !== 'none' && defaultValues[key] === undefined) {
                                        setDefaultValues(prev => ({ ...prev, [key]: '' }));
                                    }
                                }} value="none">
                                    <SelectTrigger className="h-9 px-4 rounded-xl border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 font-bold text-xs gap-1.5 w-[180px]">
                                        <Plus size={14} /> Add Default
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl max-h-[300px]">
                                        <SelectItem value="none" className="hidden">Select Field...</SelectItem>
                                        {allMappableFields.filter(f => 
                                            defaultValues[f.key] === undefined && 
                                            !(mapping[f.key] && mapping[f.key] !== 'none') && 
                                            !f.key.startsWith('contact_')
                                        ).map(f => (
                                            <SelectItem key={f.key} value={f.key} className="font-semibold">{f.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        {Object.keys(defaultValues).length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                                <AnimatePresence mode="popLayout">
                                    {Object.entries(defaultValues).map(([key, val]) => {
                                        const field = allMappableFields.find(f => f.key === key);
                                        return (
                                            <DefaultValueRow
                                                key={key}
                                                fieldKey={key}
                                                value={val}
                                                fieldLabel={field?.label || key}
                                                onValueChange={handleDefaultValueChange}
                                                onDelete={handleDeleteDefaultValue}
                                                regionsList={regionsList}
                                                districtsList={districtsList}
                                                packagesList={packagesList}
                                                modulesList={modulesList}
                                                workspaceStatuses={workspaceStatuses}
                                                parentRegionValue={defaultValues['locationRegion']}
                                                appFieldsList={appFieldsList}
                                            />
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>

                    {/* Mapping summary */}
                    <div className="pt-4 border-t border-border/50 flex items-center justify-between">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Mapped: {Object.keys(mapping).filter(k => mapping[k] && mapping[k] !== 'none').length} of {headers.length} columns
                        </p>
                        <Badge variant="outline" className="text-[10px] font-bold border-violet-200 text-violet-600 bg-violet-500/5">
                            {Object.keys(mapping).filter(k => k.startsWith('contact_') && mapping[k] && mapping[k] !== 'none').length} contact fields mapped
                        </Badge>
                    </div>
                </CardContent>
                <CardFooter className="bg-primary/5 p-8 border-t flex flex-col gap-6">
                    {/* Workspace Context Banner */}
                    <div className="w-full p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg"><Database size={18} className="text-primary" /></div>
                        <div className="text-left">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-wider leading-none">Target Workspace</p>
                            <p className="text-sm font-bold mt-1">{activeWorkspace?.name || 'Unknown'} · <span className="text-muted-foreground capitalize">{contactScope}</span></p>
                        </div>
                    </div>
                    {rawData.length > 500 && (
                        <div className="w-full p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-4">
                            <AlertCircle size={18} className="text-amber-600 shrink-0" />
                            <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wide">Large dataset detected ({rawData.length} rows). Process may take time.</p>
                        </div>
                    )}
                    <Button 
                        onClick={onNext} 
                        disabled={(!mapping['name'] && !mapping['contact_0_name']) || !activeWorkspace?.id} 
                        className="w-full h-14 rounded-xl font-bold text-lg shadow-lg shadow-primary/20 bg-primary text-white gap-2 transition-all active:scale-[0.98] animate-none"
                    >
                        Continue to Settings <ArrowRight size={20} />
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
