'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
    ChevronLeft, 
    ArrowRight, 
    Mail, 
    Phone, 
    Calendar, 
    User, 
    FileText, 
    ClipboardList,
    ExternalLink,
    Search,
    Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { CampaignPage } from '@/lib/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface LeadSummary {
    id: string;
    submittedAt: string;
    name: string;
    email: string;
    phone: string;
    data: Record<string, any>;
    entityId?: string;
    type: 'form' | 'survey';
    sourceId: string;
}

interface LeadsClientProps {
    page: CampaignPage;
    initialLeads: LeadSummary[];
}

export default function LeadsClient({ page, initialLeads }: LeadsClientProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');

    const filteredLeads = initialLeads.filter(lead => {
        const matchesSearch = 
            lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lead.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'all' || lead.type === typeFilter;
        return matchesSearch && matchesType;
    });

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <Button asChild variant="ghost" className="w-fit -ml-4 text-muted-foreground">
                    <Link href="/admin/pages">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to Pages
                    </Link>
                </Button>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight uppercase">Campaign Leads</h1>
                        <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest mt-1">
                            {page.name} attribution dashboard
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="rounded-2xl border-none shadow-sm bg-primary/5 ring-1 ring-primary/10">
                    <CardHeader className="pb-2">
                        <CardDescription className="uppercase font-bold text-[10px] tracking-widest text-primary/60">Total Leads</CardDescription>
                        <CardTitle className="text-3xl font-black text-primary">{initialLeads.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="rounded-2xl border-none shadow-sm bg-indigo-50/50 ring-1 ring-indigo-100">
                    <CardHeader className="pb-2">
                        <CardDescription className="uppercase font-bold text-[10px] tracking-widest text-indigo-600/60">Forms</CardDescription>
                        <CardTitle className="text-3xl font-black text-indigo-600">{initialLeads.filter(l => l.type === 'form').length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="rounded-2xl border-none shadow-sm bg-violet-50/50 ring-1 ring-violet-100">
                    <CardHeader className="pb-2">
                        <CardDescription className="uppercase font-bold text-[10px] tracking-widest text-violet-600/60">Surveys</CardDescription>
                        <CardTitle className="text-3xl font-black text-violet-600">{initialLeads.filter(l => l.type === 'survey').length}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Filter Bar */}
            <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate-100 overflow-hidden">
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search leads..." 
                            className="pl-10 h-11 rounded-xl border-none bg-slate-50 focus-visible:ring-1 focus-visible:ring-primary/20"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-full md:w-[160px] h-11 rounded-xl border-none bg-slate-50 font-bold uppercase text-[10px]">
                                <SelectValue placeholder="All Sources" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-2xl">
                                <SelectItem value="all">All Sources</SelectItem>
                                <SelectItem value="form">Forms</SelectItem>
                                <SelectItem value="survey">Surveys</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Leads Table */}
            <div className="rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/50 overflow-hidden ring-1 ring-black/5">
                <Table>
                    <TableHeader className="bg-slate-50/50">
                        <TableRow className="border-slate-100 hover:bg-transparent">
                            <TableHead className="py-5 pl-8 uppercase font-black text-[10px] tracking-widest text-slate-400">Respondent</TableHead>
                            <TableHead className="uppercase font-black text-[10px] tracking-widest text-slate-400">Captured Via</TableHead>
                            <TableHead className="uppercase font-black text-[10px] tracking-widest text-slate-400">Submitted At</TableHead>
                            <TableHead className="uppercase font-black text-[10px] tracking-widest text-slate-400">CRM Sync</TableHead>
                            <TableHead className="pr-8 text-right uppercase font-black text-[10px] tracking-widest text-slate-400">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredLeads.length > 0 ? (
                            filteredLeads.map((lead) => (
                                <TableRow key={lead.id} className="border-slate-50 group hover:bg-slate-50/50 transition-colors">
                                    <TableCell className="py-5 pl-8">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-bold text-slate-900 leading-none">{lead.name}</span>
                                            <div className="flex items-center gap-2 mt-1">
                                                {lead.email && <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Mail className="h-2.5 w-2.5" /> {lead.email}</span>}
                                                {lead.phone && <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> {lead.phone}</span>}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn(
                                            "rounded-lg font-bold uppercase text-[9px] tracking-widest h-6 gap-1.5",
                                            lead.type === 'form' ? "border-indigo-100 text-indigo-600 bg-indigo-50" : "border-violet-100 text-violet-600 bg-violet-50"
                                        )}>
                                            {lead.type === 'form' ? <FileText className="h-3 w-3" /> : <ClipboardList className="h-3 w-3" />}
                                            {lead.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">
                                            {format(new Date(lead.submittedAt), 'MMM dd, yyyy · HH:mm')}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {lead.entityId ? (
                                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[9px] font-black uppercase tracking-widest h-6">Synced</Badge>
                                        ) : (
                                            <Badge variant="secondary" className="bg-slate-100 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-widest h-6">Pending</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="pr-8 text-right">
                                        <div className="flex justify-end gap-2">
                                            {lead.entityId && (
                                                <Button variant="outline" size="sm" asChild className="rounded-xl font-bold h-9 px-4 border-slate-200 text-slate-600 hover:bg-slate-50 gap-2">
                                                    <Link href={`/admin/entities/${lead.entityId}`}>
                                                        <User className="h-3.5 w-3.5" />
                                                        View Profile
                                                    </Link>
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="py-20 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="h-12 w-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                                            <Search className="h-6 w-6 text-slate-200" />
                                        </div>
                                        <p className="font-bold text-slate-300 text-sm uppercase tracking-widest">No leads found matching filters</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
