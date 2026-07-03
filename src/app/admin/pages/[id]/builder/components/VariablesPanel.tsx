'use client';

import React, { useState, useMemo } from 'react';
import { 
    Search, User, Users, Receipt, Calendar, Info, 
    Sparkles, PlusCircle, Globe, Copy, Check 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface VariableToken {
    key: string;
    label: string;
    description: string;
    exampleValue: string;
    category: 'student' | 'parent' | 'invoice' | 'system' | 'custom';
}

const DEFAULT_TOKENS: VariableToken[] = [
    // Student
    { key: '{{student.name}}', label: 'Student Name', description: "Full name of the student profile", exampleValue: 'Ama Serwaa', category: 'student' },
    { key: '{{student.id}}', label: 'Student ID', description: "Unique campus registration number", exampleValue: 'STU-2026-092', category: 'student' },
    { key: '{{student.class}}', label: 'Class/Grade', description: "Class level or study course", exampleValue: 'Primary 5 B', category: 'student' },
    
    // Parent
    { key: '{{parent.name}}', label: 'Parent Name', description: "Primary parent or guardian name", exampleValue: 'Kwame Mensah', category: 'parent' },
    { key: '{{parent.phone}}', label: 'Parent Phone', description: "Contact number for notifications", exampleValue: '+233 24 412 3456', category: 'parent' },
    { key: '{{parent.email}}', label: 'Parent Email', description: "Guardian email address", exampleValue: 'kwame@mensah.gh', category: 'parent' },
    
    // Invoice
    { key: '{{invoice.amount}}', label: 'Invoice Amount', description: "Total outstanding fee invoice amount", exampleValue: 'GH₵ 1,200.00', category: 'invoice' },
    { key: '{{invoice.dueDate}}', label: 'Due Date', description: "Fee payment deadline", exampleValue: 'June 30, 2026', category: 'invoice' },
    { key: '{{invoice.number}}', label: 'Invoice No.', description: "Unique billing invoice record ID", exampleValue: 'INV-7731-2026', category: 'invoice' },
    
    // System
    { key: '{{current.date}}', label: 'Current Date', description: "Current local formatted date", exampleValue: 'July 3, 2026', category: 'system' },
    { key: '{{current.time}}', label: 'Current Time', description: "Current local formatted timestamp", exampleValue: '14:30 GMT', category: 'system' },
    { key: '{{tenant.name}}', label: 'School/Org Name', description: "Name of active tenant portal", exampleValue: 'SmartSapp Admissions', category: 'system' },
];

export default function VariablesPanel() {
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [customTokens, setCustomTokens] = useState<VariableToken[]>([]);
    
    // Form for new custom variables
    const [newKey, setNewKey] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);

    const categories = [
        { id: 'student', label: 'Student Profile', icon: User, color: 'text-sky-400' },
        { id: 'parent', label: 'Parent Profile', icon: Users, color: 'text-amber-400' },
        { id: 'invoice', label: 'Fee & Invoice Details', icon: Receipt, color: 'text-emerald-400' },
        { id: 'system', label: 'System Globals', icon: Globe, color: 'text-purple-400' },
        { id: 'custom', label: 'Custom Variables', icon: Sparkles, color: 'text-pink-400' },
    ] as const;

    const allTokens = useMemo(() => {
        return [...DEFAULT_TOKENS, ...customTokens];
    }, [customTokens]);

    const filteredTokens = useMemo(() => {
        if (!searchQuery) return allTokens;
        const q = searchQuery.toLowerCase();
        return allTokens.filter(t => 
            t.label.toLowerCase().includes(q) || 
            t.key.toLowerCase().includes(q) || 
            t.description.toLowerCase().includes(q)
        );
    }, [allTokens, searchQuery]);

    const handleCopy = (key: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(key);
        setCopiedKey(key);
        toast({
            title: "Token Copied",
            description: `Copied ${key} to clipboard. You can paste it into text fields.`,
        });
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const handleCreateCustom = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKey || !newLabel) return;
        
        let formattedKey = newKey.trim();
        if (!formattedKey.startsWith('{{')) formattedKey = '{{' + formattedKey;
        if (!formattedKey.endsWith('}}')) formattedKey = formattedKey + '}}';

        // Check duplicate
        if (allTokens.some(t => t.key === formattedKey)) {
            toast({
                variant: 'destructive',
                title: "Duplicate Token",
                description: "This variable key already exists.",
            });
            return;
        }

        const newVar: VariableToken = {
            key: formattedKey,
            label: newLabel.trim(),
            description: newDesc.trim() || 'Custom user variable definition',
            exampleValue: 'value',
            category: 'custom'
        };

        setCustomTokens(prev => [...prev, newVar]);
        setNewKey('');
        setNewLabel('');
        setNewDesc('');
        setShowAddForm(false);
        toast({
            title: "Custom Variable Created",
            description: `Token ${formattedKey} is now ready for use.`,
        });
    };

    return (
        <div className="space-y-4 flex flex-col h-full select-none text-slate-200">
            {/* Header info */}
            <div className="pb-2 border-b border-slate-800/60 shrink-0">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 font-sans">Data Bindings & Variables</span>
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 select-none">
                        Draggable
                    </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                    Drag and drop any variable token directly into canvas text inputs, headers, descriptions, or editor text blocks.
                </p>
            </div>

            {/* Search Input */}
            <div className="relative shrink-0">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search variables (e.g. Student name)..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
            </div>

            {/* Variables List */}
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-4">
                {categories.map(cat => {
                    const tokens = filteredTokens.filter(t => t.category === cat.id);
                    if (tokens.length === 0) return null;

                    const CategoryIcon = cat.icon;

                    return (
                        <div key={cat.id} className="space-y-2">
                            <div className="flex items-center gap-1.5 px-1 py-0.5">
                                <CategoryIcon className={cn("w-3.5 h-3.5", cat.color)} />
                                <span className="text-[11px] font-bold text-slate-400">{cat.label}</span>
                            </div>
                            
                            <div className="space-y-1.5">
                                {tokens.map(token => {
                                    const isCopied = copiedKey === token.key;
                                    return (
                                        <div
                                            key={token.key}
                                            draggable
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('text/plain', token.key);
                                                e.dataTransfer.effectAllowed = 'copy';
                                            }}
                                            className="group/var flex items-center justify-between border border-slate-800 bg-slate-900/10 hover:border-slate-700/50 hover:bg-slate-900/30 p-2.5 rounded-xl transition-all cursor-grab active:cursor-grabbing"
                                        >
                                            <div className="min-w-0 pr-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-semibold text-slate-200 text-xs truncate">
                                                        {token.label}
                                                    </span>
                                                    <span className="text-[9px] font-mono text-emerald-400/80 bg-emerald-500/5 border border-emerald-500/10 px-1 rounded">
                                                        {token.key}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[190px]">
                                                    {token.description}
                                                </p>
                                                <p className="text-[9px] text-slate-600 font-semibold mt-0.5">
                                                    Preview: <span className="text-slate-400 italic">"{token.exampleValue}"</span>
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={(e) => handleCopy(token.key, e)}
                                                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-200 transition-colors shrink-0"
                                                title="Copy to clipboard"
                                            >
                                                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Sticky Add Custom Variable Form */}
            <div className="pt-2 border-t border-slate-800/60 shrink-0">
                {showAddForm ? (
                    <form onSubmit={handleCreateCustom} className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                            <span className="text-[10px] font-bold text-slate-400">Add Custom Variable</span>
                            <button 
                                type="button" 
                                onClick={() => setShowAddForm(false)}
                                className="text-[10px] text-slate-500 hover:text-slate-300 font-semibold"
                            >
                                Cancel
                            </button>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Token ID</label>
                            <input
                                type="text"
                                value={newKey}
                                onChange={(e) => setNewKey(e.target.value)}
                                placeholder="e.g. custom.varName"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1 px-2 text-[10px] focus:outline-none focus:border-emerald-500"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Label</label>
                            <input
                                type="text"
                                value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                placeholder="e.g. Custom Variable"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1 px-2 text-[10px] focus:outline-none focus:border-emerald-500"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Description</label>
                            <input
                                type="text"
                                value={newDesc}
                                onChange={(e) => setNewDesc(e.target.value)}
                                placeholder="e.g. Custom user field text"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1 px-2 text-[10px] focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-lg transition-colors"
                        >
                            Save Token
                        </button>
                    </form>
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowAddForm(true)}
                        className="w-full h-10 rounded-xl border-dashed border-2 border-slate-800 hover:border-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/5 transition-all bg-transparent text-slate-500 font-bold text-xs flex items-center justify-center gap-2"
                    >
                        <PlusCircle className="w-4 h-4" /> Define Custom Variable
                    </button>
                )}
            </div>
        </div>
    );
}
