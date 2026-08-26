'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Survey, SurveyResponse, SurveyQuestion, ResolvedContact } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Trophy, Trash2, MoreHorizontal, CheckSquare, Loader2, Lock, Eye, AlertTriangle, Building2, User as UserIcon, Filter, Search, ShieldCheck, X, Phone, Mail, Copy, Check, Tag as TagIcon, GitPullRequest, CalendarDays, ExternalLink } from 'lucide-react';
import SurveyAnalyticsBulkActionsBar from './SurveyAnalyticsBulkActionsBar';
import SurveyEntityManageDialogs, { type ManagedEntityTarget } from './SurveyEntityManageDialogs';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { getDoc, doc, updateDoc } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Settings } from 'lucide-react';
import { deleteSurveyResponses } from '@/lib/survey-actions';
import { extractResponseContactDetails } from '@/lib/survey-response-utils';
import { resolveContact } from '@/lib/contact-adapter';
import { parseDateSafe } from '@/lib/forms-utils';
import { useWorkspace } from '@/context/WorkspaceContext';
import { cn, stripHtml } from '@/lib/utils';
import { BentoPagination } from '@/app/admin/entities/components/BentoPagination';
import type { UserProfile } from '@/lib/types';

/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * Component to display entity & contact details for a survey response.
 * 
 * Supports two view modes:
 * - Compact (showFullDetails: false): Organization/School name with Live CRM badge.
 * - Full (showFullDetails: true): Full entity card including school name, primary contact person,
 *   role/title, location, and interactive touch-optimized Click-to-Call and Click-to-Email action pills.
 * 
 * Mobile & A11y: Touch targets >= 44px on mobile viewports, active:scale-[0.97] press states,
 * native tel: and mailto: protocols, and clipboard copy fallback.
 */
function EntityInfo({ 
    response, 
    showFullDetails = false 
}: { 
    response: SurveyResponse; 
    showFullDetails?: boolean; 
}) {
    const { activeWorkspaceId } = useWorkspace();
    const { toast } = useToast();
    const [contact, setContact] = React.useState<ResolvedContact | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [copiedField, setCopiedField] = React.useState<'phone' | 'email' | null>(null);
    const copyTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    React.useEffect(() => {
        return () => {
            if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        };
    }, []);

    React.useEffect(() => {
        let active = true;
        async function loadContact() {
            if (!response.entityId) {
                if (active) setIsLoading(false);
                return;
            }

            try {
                const resolved = await resolveContact(
                    response.entityId || '',
                    activeWorkspaceId
                );
                if (active) setContact(resolved);
            } catch (error) {
                console.error('Failed to resolve contact:', error);
            } finally {
                if (active) setIsLoading(false);
            }
        }

        loadContact();
        return () => {
            active = false;
        };
    }, [response.entityId, activeWorkspaceId]);

    const details = React.useMemo(() => {
        return extractResponseContactDetails(response, contact);
    }, [response, contact]);

    const handleCopy = (text: string, type: 'phone' | 'email', e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (!text) return;
        try {
            navigator.clipboard.writeText(text);
            setCopiedField(type);
            toast({
                title: type === 'phone' ? "Phone Copied" : "Email Copied",
                description: `${text} copied to clipboard.`,
            });
            if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
            copyTimeoutRef.current = setTimeout(() => setCopiedField(null), 2000);
        } catch {
            toast({
                variant: "destructive",
                title: "Copy Failed",
                description: "Could not access clipboard."
            });
        }
    };

    if (isLoading) {
        return <Skeleton className="h-5 w-24" />;
    }

    const hasAnyDetails = Boolean(
        details.entityName || 
        details.primaryContactName || 
        details.primaryContactPhone || 
        details.primaryContactEmail
    );

    if (!hasAnyDetails) {
        return <span className="text-xs text-muted-foreground">-</span>;
    }

    // --- COMPACT VIEW MODE ---
    if (!showFullDetails) {
        return (
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {details.entityId ? (
                        <a 
                            href={`/admin/entities/${details.entityId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold hover:underline hover:text-primary transition-colors truncate max-w-[150px]"
                            title={details.entityName || details.primaryContactName}
                        >
                            {details.entityName || details.primaryContactName}
                        </a>
                    ) : (
                        <span className="text-xs font-semibold truncate max-w-[150px]" title={details.entityName || details.primaryContactName}>
                            {details.entityName || details.primaryContactName}
                        </span>
                    )}
                </div>
                {details.isLiveCrm && (
                    <Badge variant="outline" className="w-fit h-4 py-0 text-[8px] font-black uppercase tracking-tighter bg-emerald-500/5 text-emerald-600 border-emerald-500/20 gap-1">
                        <ShieldCheck className="h-2 w-2" /> Live CRM
                    </Badge>
                )}
            </div>
        );
    }

    // --- FULL DETAILS VIEW MODE ---
    return (
        <div className="flex flex-col gap-2 py-1 max-w-[280px]">
            {/* Entity / School Header */}
            <div className="space-y-0.5">
                <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Building2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        {details.entityId ? (
                            <a 
                                href={`/admin/entities/${details.entityId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-bold text-foreground hover:underline hover:text-primary transition-colors truncate"
                                title={details.entityName || 'Unnamed Entity'}
                            >
                                {details.entityName || 'Unnamed Entity'}
                            </a>
                        ) : (
                            <span className="text-xs font-bold text-foreground truncate" title={details.entityName || 'Lead Submission'}>
                                {details.entityName || 'Lead Submission'}
                            </span>
                        )}
                    </div>
                    {details.isLiveCrm && (
                        <Badge variant="outline" className="h-4 px-1 py-0 text-[8px] font-black uppercase tracking-tighter bg-emerald-500/5 text-emerald-600 border-emerald-500/20 shrink-0">
                            Live CRM
                        </Badge>
                    )}
                </div>
                {(details.zoneName || details.locationString) && (
                    <p className="text-[9px] text-muted-foreground truncate pl-5">
                        {[details.zoneName, details.locationString].filter(Boolean).join(' · ')}
                    </p>
                )}
            </div>

            {/* Primary Contact Person */}
            {details.primaryContactName && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/30 px-2 py-1 rounded-md border border-border/40">
                    <UserIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="font-semibold text-foreground truncate">{details.primaryContactName}</span>
                    {details.roleOrTitle && (
                        <span className="text-[9px] font-medium text-muted-foreground ml-auto bg-muted px-1.5 py-0.2 rounded shrink-0">
                            {details.roleOrTitle}
                        </span>
                    )}
                </div>
            )}

            {/* Interactive Contact Actions (Call & Email) */}
            <div className="flex flex-col gap-1.5">
                {/* Click-to-Call */}
                {details.primaryContactPhone ? (
                    <div className="flex items-center gap-1">
                        <a
                            href={`tel:${details.primaryContactPhone.replace(/[\s()\-]/g, '')}`}
                            aria-label={`Call ${details.primaryContactPhone}`}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold transition-all active:scale-[0.97] min-h-[28px] flex-1 truncate"
                            title={`Click to call ${details.primaryContactPhone}`}
                        >
                            <Phone className="h-3 w-3 shrink-0" />
                            <span className="truncate">{details.primaryContactPhone}</span>
                        </a>
                        <button
                            type="button"
                            onClick={(e) => handleCopy(details.primaryContactPhone, 'phone', e)}
                            aria-label="Copy phone number"
                            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 active:scale-[0.97]"
                            title="Copy phone"
                        >
                            {copiedField === 'phone' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        </button>
                    </div>
                ) : null}

                {/* Click-to-Email */}
                {details.primaryContactEmail ? (
                    <div className="flex items-center gap-1">
                        <a
                            href={`mailto:${details.primaryContactEmail}`}
                            aria-label={`Email ${details.primaryContactEmail}`}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold transition-all active:scale-[0.97] min-h-[28px] flex-1 truncate"
                            title={`Click to email ${details.primaryContactEmail}`}
                        >
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{details.primaryContactEmail}</span>
                        </a>
                        <button
                            type="button"
                            onClick={(e) => handleCopy(details.primaryContactEmail, 'email', e)}
                            aria-label="Copy email address"
                            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 active:scale-[0.97]"
                            title="Copy email"
                        >
                            {copiedField === 'email' ? <Check className="h-3 w-3 text-blue-600" /> : <Copy className="h-3 w-3" />}
                        </button>
                    </div>
                ) : null}

                {!details.primaryContactPhone && !details.primaryContactEmail && !details.primaryContactName && (
                    <span className="text-[10px] text-muted-foreground/60 italic">No direct contact info captured</span>
                )}
            </div>
        </div>
    );
}

/**
 * Component to display who shared the survey link
 */
function SharedByInfo({ userId }: { userId?: string }) {
    const firestore = useFirestore();
    const [name, setName] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        let active = true;
        if (!userId || !firestore) {
            setIsLoading(false);
            return;
        }
        
        getDoc(doc(firestore, 'users', userId)).then((snap) => {
            if (active) {
                if (snap.exists()) {
                    const data = snap.data() as UserProfile;
                    setName(data.name || data.email);
                }
                setIsLoading(false);
            }
        }).catch((err) => {
            console.error("SharedByInfo resolution failed:", err);
            if (active) setIsLoading(false);
        });

        return () => {
            active = false;
        };
    }, [userId, firestore]);

    if (!userId) return <span className="text-[10px] text-muted-foreground/40 italic">Anonymous</span>;
    if (isLoading) return <Skeleton className="h-4 w-20" />;

    return (
        <div className="flex items-center gap-1.5">
            <div className="p-1 bg-blue-500/10 rounded text-blue-600">
                <UserIcon className="h-3 w-3" />
            </div>
            <span className="text-[10px] font-bold text-blue-700/80 truncate max-w-[100px]">{name || 'Team Member'}</span>
        </div>
    );
}

function formatAnswer(value: unknown): string {
    if (value === undefined || value === null) return '-';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        // Checkboxes with allowOther: { options: string[], other: string }
        if (Array.isArray(obj.options)) {
            const parts = [...obj.options] as string[];
            if (typeof obj.other === 'string' && obj.other.trim()) parts.push(`Other: ${obj.other.trim()}`);
            return parts.length > 0 ? parts.join(', ') : '-';
        }
        // Multiple-choice with allowOther: { option: string, other: string }
        if (obj.option !== undefined) {
            if (obj.option === '__other__') {
                return typeof obj.other === 'string' && obj.other.trim() ? `Other: ${obj.other.trim()}` : 'Other (not specified)';
            }
            // Regular option selected
            const parts = [String(obj.option)];
            if (typeof obj.other === 'string' && obj.other.trim()) parts.push(`Other: ${obj.other.trim()}`);
            return parts.join(', ');
        }
        // Fallback for unknown object shapes
        return Object.entries(obj)
            .filter(([, v]) => v !== '' && v !== null && v !== undefined)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ') || '-';
    }
    return String(value);
}

interface ResponsesListViewProps {
    survey: Survey;
    responses: SurveyResponse[];
    filteredResponses: SurveyResponse[];
    isLoading: boolean;
    columnFilters: Record<string, string[]>;
    setColumnFilters: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
    hideEmptyColumns: boolean;
    setHideEmptyColumns: (val: boolean) => void;
    attributionFilter: string;
    setAttributionFilter: (val: string) => void;
    deepLinkFilterType: string | null;
    setDeepLinkFilterType: (val: string | null) => void;
}

function ResponsesListView({ 
    survey, 
    responses, 
    filteredResponses, 
    isLoading,
    columnFilters,
    setColumnFilters,
    hideEmptyColumns,
    setHideEmptyColumns,
    attributionFilter,
    setAttributionFilter,
    deepLinkFilterType,
    setDeepLinkFilterType
}: ResponsesListViewProps) {
    const router = useRouter();
    const { toast } = useToast();
    const auth = useAuth();
    const { user } = useUser();
    const firestore = useFirestore();

    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
    const [taggingEntity, setTaggingEntity] = React.useState<ManagedEntityTarget | null>(null);
    const [movingEntity, setMovingEntity] = React.useState<ManagedEntityTarget | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [password, setPassword] = React.useState('');
    const [authError, setAuthError] = React.useState<string | null>(null);
    const [columnWidth, setColumnWidth] = React.useState<number>(250);
    const [hiddenColumnIds, setHiddenColumnIds] = React.useState<string[]>([]);
    const [showFullEntityDetails, setShowFullEntityDetails] = React.useState(false);

    // Compute distinct identified entity IDs among selected responses
    const identifiedEntityIds = React.useMemo(() => {
        const selected = (responses || []).filter(r => selectedIds.includes(r.id));
        return [...new Set(selected.map(r => r.entityId).filter((id): id is string => Boolean(id)))];
    }, [responses, selectedIds]);

    const [currentPage, setCurrentPage] = React.useState(1);
    const [pageSize, setPageSize] = React.useState(50);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [attributionFilter, deepLinkFilterType, columnFilters]);

    const paginatedResponses = React.useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredResponses.slice(start, start + pageSize);
    }, [filteredResponses, currentPage, pageSize]);

    const isSubmittedAtVisible = !hiddenColumnIds.includes('submittedAt');
    const isContactVisible = !hiddenColumnIds.includes('contact');
    const isSharedByVisible = !hiddenColumnIds.includes('sharedBy');

    const contactWidth = showFullEntityDetails ? 300 : 180;
    const submittedAtLeft = 50;
    const contactLeft = 50 + (isSubmittedAtVisible ? 180 : 0);
    const sharedByLeft = contactLeft + (isContactVisible ? contactWidth : 0);

    const rightmostStickyColumn = React.useMemo(() => {
        if (isSharedByVisible) return 'sharedBy';
        if (isContactVisible) return 'contact';
        if (isSubmittedAtVisible) return 'submittedAt';
        return 'checkbox';
    }, [isSharedByVisible, isContactVisible, isSubmittedAtVisible]);

    // Get unique assigned users for filtering
    const attributedUsers = React.useMemo(() => {
        if (!responses) return [];
        const ids = Array.from(new Set(responses.map(r => r.assignedUserId).filter(Boolean))) as string[];
        return ids;
    }, [responses]);

    const questions = React.useMemo(() => survey ? survey.elements.filter((el): el is SurveyQuestion => 'isRequired' in el) : [], [survey]);

    const handleToggleFilterField = async (questionId: string, enabled: boolean) => {
        if (!firestore || !survey) return;
        const updatedElements = survey.elements.map(el => {
            if (el.id === questionId) {
                return { ...el, isFilterField: enabled };
            }
            return el;
        });

        try {
            const docRef = doc(firestore, 'surveys', survey.id);
            await updateDoc(docRef, { elements: updatedElements });
            toast({
                title: enabled ? "Filter Enabled" : "Filter Disabled",
                description: `Column filtering ${enabled ? 'enabled' : 'disabled'}.`,
            });
        } catch (error: any) {
            console.error("Failed to toggle filter field:", error);
            toast({
                variant: 'destructive',
                title: "Failed to update configuration",
                description: error.message
            });
        }
    };

    const getUniqueAnswers = React.useCallback((questionId: string) => {
        const unique = new Set<string>();
        responses.forEach(res => {
            const ans = (res.answers || []).find(a => a.questionId === questionId)?.value;
            if (ans !== undefined && ans !== null) {
                if (Array.isArray(ans)) {
                    ans.forEach(val => {
                        const formatted = formatAnswer(val);
                        if (formatted && formatted !== '-') unique.add(formatted);
                    });
                } else if (typeof ans === 'object' && ans !== null) {
                    if (Array.isArray(((ans as {options?: string[], option?: string, other?: string}).options))) {
                        ((ans as {options?: string[], option?: string, other?: string}).options).forEach((val: string) => {
                             if (val) unique.add(val);
                        });
                        if (((ans as {options?: string[], option?: string, other?: string}).other) && ((ans as {options?: string[], option?: string, other?: string}).other).trim()) {
                            unique.add(((ans as {options?: string[], option?: string, other?: string}).other).trim());
                        }
                    } else if (((ans as {options?: string[], option?: string, other?: string}).option) !== undefined) {
                        if (((ans as {options?: string[], option?: string, other?: string}).option) === '__other__') {
                            if (((ans as {options?: string[], option?: string, other?: string}).other)?.trim()) unique.add(((ans as {options?: string[], option?: string, other?: string}).other).trim());
                        } else {
                            unique.add(((ans as {options?: string[], option?: string, other?: string}).option));
                            if (((ans as {options?: string[], option?: string, other?: string}).other)?.trim()) unique.add(((ans as {options?: string[], option?: string, other?: string}).other).trim());
                        }
                    } else {
                        const formatted = formatAnswer(ans);
                        if (formatted && formatted !== '-') unique.add(formatted);
                    }
                } else {
                    const formatted = formatAnswer(ans);
                    if (formatted && formatted !== '-') unique.add(formatted);
                }
            }
        });
        return Array.from(unique).sort();
    }, [responses]);

    const getFilterOptions = React.useCallback((question: SurveyQuestion) => {
        const unique = new Set<string>();
        if (question.type === 'yes-no') {
            unique.add('Yes');
            unique.add('No');
        } else if (question.options) {
            question.options.forEach(opt => {
                if (opt) unique.add(opt);
            });
        }
        
        const responsesUnique = getUniqueAnswers(question.id);
        responsesUnique.forEach(val => unique.add(val));
        
        return Array.from(unique).sort();
    }, [getUniqueAnswers]);

    // Hiding empty columns dynamically
    const nonActiveQuestionIds = React.useMemo(() => {
        if (!hideEmptyColumns) return new Set<string>();

        const activeQuestionIds = new Set<string>();
        filteredResponses.forEach(res => {
            (res.answers || []).forEach(ans => {
                const formatted = formatAnswer(ans.value);
                if (formatted !== undefined && formatted !== null && formatted !== '' && formatted !== '-') {
                    activeQuestionIds.add(ans.questionId);
                }
            });
        });

        const emptyIds = new Set<string>();
        questions.forEach(q => {
            if (!activeQuestionIds.has(q.id)) {
                emptyIds.add(q.id);
            }
        });
        return emptyIds;
    }, [filteredResponses, questions, hideEmptyColumns]);

    const visibleQuestions = React.useMemo(() => {
        return questions.filter(q => !nonActiveQuestionIds.has(q.id) && !hiddenColumnIds.includes(q.id));
    }, [questions, nonActiveQuestionIds, hiddenColumnIds]);

    const toggleSelectAll = () => {
        if (!responses) return;
        if (selectedIds.length === responses.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(responses.map(r => r.id));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const getAnswerForQuestion = (response: SurveyResponse, questionId: string) => {
        return (response.answers || []).find(a => a.questionId === questionId)?.value;
    }

    const handleDeleteClick = (ids?: string[]) => {
        if (ids) setSelectedIds(ids);
        setIsDeleteDialogOpen(true);
        setAuthError(null);
        setPassword('');
    };

    const handleConfirmDelete = async () => {
        if (!user || !user.email) return;
        setAuthError(null);
        setIsDeleting(true);

        try {
            // 1. Re-authenticate
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);

            // 2. Perform deletion
            const result = await deleteSurveyResponses(survey.id, selectedIds, user.uid);
            
            if (result.success) {
                toast({ title: 'Deletions Successful', description: `${selectedIds.length} responses have been removed.` });
                setSelectedIds([]);
                setIsDeleteDialogOpen(false);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        } catch (error: any) {
            console.error("Auth verification failed", error);
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                setAuthError('Incorrect password. Access denied.');
            } else {
                setAuthError('Verification failed. Please try again.');
            }
        } finally {
            setIsDeleting(false);
        }
    };
    
    if (!survey) {
        return (
 <div className="p-4">
 <Skeleton className="h-12 w-full mb-2" />
 <Skeleton className="h-64 w-full" />
            </div>
        );
    }
    
    return (
        <div className="space-y-0 relative">

            {/* Phase 4: Attribution Filter Toolbar */}
            <div className="flex items-center justify-between p-4 bg-muted/20 border-b border-border/50 flex-wrap gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[10px] font-black uppercase tracking-tight text-muted-foreground">Filter Source</span>
                    </div>
                    <Select value={attributionFilter} onValueChange={setAttributionFilter}>
                        <SelectTrigger className="h-8 w-[180px] bg-background border-none shadow-sm text-[10px] font-bold rounded-lg">
                            <SelectValue placeholder="All Sources" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all" className="text-[11px] font-medium">All Sources</SelectItem>
                            <SelectItem value="anonymous" className="text-[11px] font-medium italic">General Link (Anonymous)</SelectItem>
                            {attributedUsers.map(uid => (
                                <SelectItem key={uid} value={uid} className="text-[11px] font-bold">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                                        <SharedByInfo userId={uid} />
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Central Filter Fields Configuration Popover */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="h-8 gap-1.5 text-[10px] font-bold rounded-lg border-border/50">
                                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                                Filter Config
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-4 rounded-2xl" align="start">
                            <div className="space-y-3">
                                <div className="border-b pb-2">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-foreground">Configure Filter Columns</h4>
                                    <p className="text-[9px] text-muted-foreground mt-0.5">Choose which columns can be filtered directly in the table headers.</p>
                                </div>
                                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 no-scrollbar">
                                    {questions.map(q => {
                                        const isFilter = q.isFilterField || false;
                                        return (
                                            <div key={q.id} className="flex items-center justify-between gap-4 p-2 hover:bg-muted/50 rounded-xl transition-colors">
                                                <span className="text-[11px] font-bold truncate max-w-[160px]" title={stripHtml(q.title || '')}>
                                                    {stripHtml(q.title || '')}
                                                </span>
                                                <Switch 
                                                    checked={isFilter}
                                                    onCheckedChange={(checked) => handleToggleFilterField(q.id, checked)}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Columns Visibility Selector */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="h-8 gap-1.5 text-[10px] font-bold rounded-lg border-border/50">
                                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                Columns
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-4 rounded-2xl" align="start">
                            <div className="space-y-3">
                                <div className="border-b pb-2">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-foreground">Toggle Columns</h4>
                                    <p className="text-[9px] text-muted-foreground mt-0.5">Show or hide columns in the responses table.</p>
                                </div>
                                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 no-scrollbar flex flex-col gap-0.5">
                                    {/* Metadata Columns */}
                                    <label className="flex items-center gap-2.5 p-1.5 hover:bg-muted/50 rounded-lg cursor-pointer text-xs transition-colors">
                                        <Checkbox 
                                            checked={!hiddenColumnIds.includes('submittedAt')}
                                            onCheckedChange={(checked) => {
                                                setHiddenColumnIds(prev => checked ? prev.filter(c => c !== 'submittedAt') : [...prev, 'submittedAt']);
                                            }}
                                        />
                                        <span className="font-bold">Submitted At</span>
                                    </label>
                                    <label className="flex items-center gap-2.5 p-1.5 hover:bg-muted/50 rounded-lg cursor-pointer text-xs transition-colors">
                                        <Checkbox 
                                            checked={!hiddenColumnIds.includes('contact')}
                                            onCheckedChange={(checked) => {
                                                setHiddenColumnIds(prev => checked ? prev.filter(c => c !== 'contact') : [...prev, 'contact']);
                                            }}
                                        />
                                        <span className="font-bold">Contact / Org</span>
                                    </label>
                                    <label className="flex items-center gap-2.5 p-1.5 hover:bg-muted/50 rounded-lg cursor-pointer text-xs transition-colors">
                                        <Checkbox 
                                            checked={!hiddenColumnIds.includes('sharedBy')}
                                            onCheckedChange={(checked) => {
                                                setHiddenColumnIds(prev => checked ? prev.filter(c => c !== 'sharedBy') : [...prev, 'sharedBy']);
                                            }}
                                        />
                                        <span className="font-bold">Shared By</span>
                                    </label>
                                    {survey.scoringEnabled && (
                                        <label className="flex items-center gap-2.5 p-1.5 hover:bg-muted/50 rounded-lg cursor-pointer text-xs transition-colors">
                                            <Checkbox 
                                                checked={!hiddenColumnIds.includes('score')}
                                                onCheckedChange={(checked) => {
                                                    setHiddenColumnIds(prev => checked ? prev.filter(c => c !== 'score') : [...prev, 'score']);
                                                }}
                                            />
                                            <span className="font-bold text-primary">Score</span>
                                        </label>
                                    )}
                                    <div className="border-t my-2 pt-2 text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">Question Fields</div>
                                    {/* Question Columns */}
                                    {questions.map(q => {
                                        const isHidden = hiddenColumnIds.includes(q.id);
                                        return (
                                            <label key={q.id} className="flex items-center gap-2.5 p-1.5 hover:bg-muted/50 rounded-lg cursor-pointer text-xs transition-colors">
                                                <Checkbox 
                                                    checked={!isHidden}
                                                    onCheckedChange={(checked) => {
                                                        setHiddenColumnIds(prev => checked ? prev.filter(c => c !== q.id) : [...prev, q.id]);
                                                    }}
                                                />
                                                <span className="font-medium truncate" title={stripHtml(q.title || '')}>
                                                    {stripHtml(q.title || '')}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Hide Empty Columns Toggle */}
                    <div className="flex items-center gap-2 border-l pl-4 border-border/50">
                        <Switch 
                            id="hide-empty-columns" 
                            checked={hideEmptyColumns} 
                            onCheckedChange={setHideEmptyColumns} 
                        />
                        <Label htmlFor="hide-empty-columns" className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground cursor-pointer whitespace-nowrap">
                            Hide Empty
                        </Label>
                    </div>

                    {/* Full Entity Details Toggle */}
                    <div className="flex items-center gap-2 border-l pl-4 border-border/50">
                        <Switch 
                            id="show-full-entity-details" 
                            checked={showFullEntityDetails} 
                            onCheckedChange={setShowFullEntityDetails} 
                        />
                        <Label htmlFor="show-full-entity-details" className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground cursor-pointer flex items-center gap-1.5 whitespace-nowrap">
                            <Building2 className="h-3.5 w-3.5 text-primary" />
                            Full Details
                        </Label>
                    </div>

                    {/* Column Width Slider */}
                    <div className="flex items-center gap-2.5 border-l pl-4 border-border/50">
                        <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Width</span>
                        <div className="flex items-center gap-2 w-32">
                            <input 
                                type="range" 
                                min="150" 
                                max="500" 
                                value={columnWidth} 
                                onChange={(e) => setColumnWidth(Number(e.target.value))}
                                className="w-full h-1 bg-muted-foreground/20 rounded-lg appearance-none cursor-pointer accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 outline-none transition-all hover:bg-muted-foreground/30"
                            />
                            <span className="text-[9px] font-bold text-muted-foreground/80 w-8 shrink-0">{columnWidth}px</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {(attributionFilter !== 'all' || deepLinkFilterType || Object.keys(columnFilters).length > 0) && (
                        <button
                            type="button"
                            onClick={() => {
                                setAttributionFilter('all');
                                setDeepLinkFilterType(null);
                                setColumnFilters({});
                                // Clear URL params
                                router.replace(`/admin/surveys/${survey.id}/results?view=responses`, { scroll: false });
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-black hover:bg-primary/20 transition-colors"
                        >
                            <X className="h-3 w-3" />
                            Clear Filters
                            {deepLinkFilterType && (
                                <Badge variant="outline" className="ml-1 text-[8px] px-1.5 py-0 border-primary/30">
                                    {deepLinkFilterType}
                                </Badge>
                            )}
                        </button>
                    )}
                    <div className="text-[10px] font-bold text-muted-foreground italic">
                        Showing {filteredResponses.length} of {responses?.length || 0} responses
                    </div>
                </div>
            </div>

            {/* Filter Chips Bar */}
            {Object.keys(columnFilters).length > 0 && (
                <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/10 border-b border-border/50">
                    <span className="text-[10px] font-black uppercase tracking-tight text-muted-foreground">Active Filters:</span>
                    {Object.entries(columnFilters).map(([questionId, values]) => {
                        const q = questions.find(question => question.id === questionId);
                        if (!q) return null;
                        const label = stripHtml(q.title || '');
                        return (
                            <div key={questionId} className="flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1 rounded-full text-[10px] font-black">
                                <span>{label}: {values.join(', ')}</span>
                                <button
                                    onClick={() => {
                                        setColumnFilters(prev => {
                                            const next = { ...prev };
                                            delete next[questionId];
                                            return next;
                                        });
                                    }}
                                    aria-label={`Remove filter for ${label}`}
                                    className="hover:text-destructive transition-colors shrink-0 ml-1"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        );
                    })}
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-[10px] font-black text-destructive hover:bg-destructive/10 rounded-lg ml-auto"
                        onClick={() => setColumnFilters({})}
                    >
                        Clear All Filters
                    </Button>
                </div>
            )}

            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/70 hover:bg-muted/70 border-b-2 border-border font-bold shadow-sm">
                        <TableHead 
                            className={cn(
                                "sticky left-0 bg-muted z-30 pl-6",
                                rightmostStickyColumn === 'checkbox' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                            )}
                            style={{ width: '50px', minWidth: '50px', maxWidth: '50px' }}
                        >
                            <Checkbox 
                                checked={responses?.length ? selectedIds.length === responses.length : false} 
                                onCheckedChange={toggleSelectAll} 
                            />
                        </TableHead>
                        {isSubmittedAtVisible && (
                            <TableHead 
                                className={cn(
                                    "sticky bg-muted z-30 whitespace-nowrap text-[10px] font-bold py-4",
                                    rightmostStickyColumn === 'submittedAt' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                                )}
                                style={{ left: `${submittedAtLeft}px`, width: '180px', minWidth: '180px', maxWidth: '180px' }}
                            >
                                Submitted At
                            </TableHead>
                        )}
                        {isContactVisible && (
                            <TableHead 
                                className={cn(
                                    "sticky bg-muted z-30 text-[10px] font-bold py-4",
                                    rightmostStickyColumn === 'contact' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                                )}
                                style={{ left: `${contactLeft}px`, width: `${contactWidth}px`, minWidth: `${contactWidth}px`, maxWidth: `${contactWidth}px` }}
                            >
                                Contact / Organization
                            </TableHead>
                        )}
                        {isSharedByVisible && (
                            <TableHead 
                                className={cn(
                                    "sticky bg-muted z-30 text-[10px] font-bold py-4",
                                    rightmostStickyColumn === 'sharedBy' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                                )}
                                style={{ left: `${sharedByLeft}px`, width: '150px', minWidth: '150px', maxWidth: '150px' }}
                            >
                                Shared By
                            </TableHead>
                        )}
                        {survey.scoringEnabled && !hiddenColumnIds.includes('score') && (
                            <TableHead className="w-[100px] text-center text-[10px] font-bold py-4 text-primary">Score</TableHead>
                        )}
                        {visibleQuestions.map(q => {
                            const isFilterActive = columnFilters[q.id] && columnFilters[q.id].length > 0;
                            const options = getFilterOptions(q);
                            const isTextQuestion = ['text', 'long-text', 'email', 'phone', 'link', 'number'].includes(q.type);

                            return (
                                <TableHead 
                                    key={q.id} 
                                    className="text-[10px] font-bold py-4 break-words whitespace-normal align-top"
                                    style={{ width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px` }}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="break-words whitespace-normal leading-normal" title={stripHtml(q.title || '')}>{stripHtml(q.title || '')}</span>
                                        {q.isFilterField && (
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        aria-label={`Filter column: ${stripHtml(q.title || '')}`}
                                                        className={cn(
                                                            "h-6 w-6 rounded-md hover:bg-muted shrink-0",
                                                            isFilterActive && "text-primary bg-primary/10"
                                                        )}
                                                    >
                                                        <Filter className="h-3.5 w-3.5" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-64 p-4 rounded-2xl" align="start">
                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between border-b pb-2">
                                                            <span className="text-xs font-black uppercase tracking-wider text-foreground">Filter Field</span>
                                                            {isFilterActive && (
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm" 
                                                                    className="h-6 px-2 text-[10px] font-black text-destructive"
                                                                    onClick={() => {
                                                                        setColumnFilters(prev => {
                                                                            const next = { ...prev };
                                                                            delete next[q.id];
                                                                            return next;
                                                                        });
                                                                    }}
                                                                >
                                                                    Clear
                                                                </Button>
                                                            )}
                                                        </div>

                                                        {isTextQuestion ? (
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Search term</Label>
                                                                <Input 
                                                                    placeholder="Type search query..."
                                                                    value={columnFilters[q.id]?.[0] || ''}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setColumnFilters(prev => {
                                                                            const next = { ...prev };
                                                                            if (val.trim() === '') {
                                                                                delete next[q.id];
                                                                            } else {
                                                                                next[q.id] = [val];
                                                                            }
                                                                            return next;
                                                                        });
                                                                    }}
                                                                    className="h-9 rounded-xl text-xs"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Select values</Label>
                                                                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
                                                                    {options.map(opt => {
                                                                        const isChecked = columnFilters[q.id]?.includes(opt) || false;
                                                                        return (
                                                                            <label key={opt} className="flex items-center gap-2.5 p-1.5 hover:bg-muted/50 rounded-lg cursor-pointer text-xs transition-colors">
                                                                                <Checkbox 
                                                                                    checked={isChecked}
                                                                                    onCheckedChange={(checked) => {
                                                                                        setColumnFilters(prev => {
                                                                                            const next = { ...prev };
                                                                                            const current = next[q.id] || [];
                                                                                            if (checked) {
                                                                                                next[q.id] = [...current, opt];
                                                                                            } else {
                                                                                                next[q.id] = current.filter(c => c !== opt);
                                                                                                if (next[q.id].length === 0) delete next[q.id];
                                                                                            }
                                                                                            return next;
                                                                                        });
                                                                                    }}
                                                                                />
                                                                                <span className="font-medium truncate">{opt}</span>
                                                                            </label>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        )}
                                    </div>
                                </TableHead>
                            );
                        })}
                        <TableHead className="w-[80px] text-right pr-6 text-[10px] font-bold py-4">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell 
                            className={cn(
                                "sticky left-0 bg-background z-20 pl-6",
                                rightmostStickyColumn === 'checkbox' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                            )}
                            style={{ width: '50px', minWidth: '50px', maxWidth: '50px' }}
                        >
                            <Skeleton className="h-4 w-4 rounded" />
                        </TableCell>
                        {isSubmittedAtVisible && (
                            <TableCell 
                                className={cn(
                                    "sticky bg-background z-20",
                                    rightmostStickyColumn === 'submittedAt' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                                )}
                                style={{ left: `${submittedAtLeft}px`, width: '180px', minWidth: '180px', maxWidth: '180px' }}
                            >
                                <Skeleton className="h-5 w-3/4" />
                            </TableCell>
                        )}
                        {isContactVisible && (
                            <TableCell 
                                className={cn(
                                    "sticky bg-background z-20",
                                    rightmostStickyColumn === 'contact' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                                )}
                                style={{ left: `${contactLeft}px`, width: `${contactWidth}px`, minWidth: `${contactWidth}px`, maxWidth: `${contactWidth}px` }}
                            >
                                <Skeleton className="h-5 w-24" />
                            </TableCell>
                        )}
                        {isSharedByVisible && (
                            <TableCell 
                                className={cn(
                                    "sticky bg-background z-20",
                                    rightmostStickyColumn === 'sharedBy' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                                )}
                                style={{ left: `${sharedByLeft}px`, width: '150px', minWidth: '150px', maxWidth: '150px' }}
                            >
                                <Skeleton className="h-5 w-24" />
                            </TableCell>
                        )}
                        {survey.scoringEnabled && !hiddenColumnIds.includes('score') && (
                            <TableCell><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
                        )}
                        {visibleQuestions.map(q => (
                            <TableCell key={q.id}><Skeleton className="h-5 w-full" /></TableCell>
                        ))}
                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                    ))
                ) : paginatedResponses && paginatedResponses.length > 0 ? (
                    paginatedResponses.map((response) => (
                    <TableRow key={response.id} className={cn("group hover:bg-muted/30 transition-colors", selectedIds.includes(response.id) && "bg-primary/5")}>
                        <TableCell 
                            className={cn(
                                "sticky left-0 sticky-cell-hover z-20 pl-6",
                                rightmostStickyColumn === 'checkbox' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                            )}
                            style={{ width: '50px', minWidth: '50px', maxWidth: '50px' }}
                        >
                            <Checkbox 
                                checked={selectedIds.includes(response.id)} 
                                onCheckedChange={() => toggleSelect(response.id)} 
                            />
                        </TableCell>
                        {isSubmittedAtVisible && (
                            <TableCell 
                                className={cn(
                                    "sticky sticky-cell-hover z-20 font-medium whitespace-nowrap",
                                    rightmostStickyColumn === 'submittedAt' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                                )}
                                style={{ left: `${submittedAtLeft}px`, width: '180px', minWidth: '180px', maxWidth: '180px' }}
                            >
                                <span className="text-xs">
                                    {(() => {
                                        const d = parseDateSafe(response.submittedAt);
                                        return d ? format(d, "MMM d, yyyy · p") : '—';
                                    })()}
                                </span>
                            </TableCell>
                        )}
                        {isContactVisible && (
                            <TableCell 
                                className={cn(
                                    "sticky sticky-cell-hover z-20",
                                    rightmostStickyColumn === 'contact' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                                )}
                                style={{ left: `${contactLeft}px`, width: `${contactWidth}px`, minWidth: `${contactWidth}px`, maxWidth: `${contactWidth}px` }}
                            >
                                <EntityInfo response={response} showFullDetails={showFullEntityDetails} />
                            </TableCell>
                        )}
                        {isSharedByVisible && (
                            <TableCell 
                                className={cn(
                                    "sticky sticky-cell-hover z-20",
                                    rightmostStickyColumn === 'sharedBy' && "border-r border-border/50 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                                )}
                                style={{ left: `${sharedByLeft}px`, width: '150px', minWidth: '150px', maxWidth: '150px' }}
                            >
                                <SharedByInfo userId={response.assignedUserId} />
                            </TableCell>
                        )}
                        {survey.scoringEnabled && !hiddenColumnIds.includes('score') && (
                            <TableCell className="text-center font-bold">
                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 flex items-center gap-1 w-fit mx-auto">
                                    <Trophy className="h-3 w-3" />
                                    {response.score || 0}
                                </Badge>
                            </TableCell>
                        )}
                        {visibleQuestions.map(q => {
                            const answer = getAnswerForQuestion(response, q.id);
                            const formattedAnswer = formatAnswer(answer);
                            return (
                                <TableCell 
                                    key={q.id} 
                                    title={formattedAnswer} 
                                    className="text-xs text-muted-foreground group-hover:text-foreground transition-colors break-words whitespace-normal py-3 align-top"
                                    style={{ width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px` }}
                                >
                                    {formattedAnswer}
                                </TableCell>
                            )
                        })}
                        <TableCell className="text-right pr-6">
                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" aria-label="Response options" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5 shadow-xl">
                                    {response.entityId ? (
                                        <>
                                            <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider px-2 py-1.5">
                                                Response & Entity
                                            </DropdownMenuLabel>
                                            <DropdownMenuItem 
                                                onClick={() => router.push(`/admin/surveys/${survey.id}/results/${response.id}`)}
                                                className="rounded-lg py-2 cursor-pointer gap-2 font-medium"
                                            >
                                                <Eye className="h-4 w-4 text-slate-500" /> View Detail
                                            </DropdownMenuItem>
                                            <DropdownMenuItem 
                                                onClick={() => window.open(`/admin/entities/${response.entityId}`, '_blank')}
                                                className="rounded-lg py-2 cursor-pointer gap-2 font-medium"
                                            >
                                                <Building2 className="h-4 w-4 text-primary" /> View in CRM Console
                                                <ExternalLink className="h-3 w-3 opacity-50 ml-auto" />
                                            </DropdownMenuItem>
                                            <DropdownMenuItem 
                                                onClick={() => setTaggingEntity({ id: response.entityId!, name: response.entityName || 'Identified Entity' })}
                                                className="rounded-lg py-2 cursor-pointer gap-2 font-medium"
                                            >
                                                <TagIcon className="h-4 w-4 text-primary" /> Apply Tags
                                            </DropdownMenuItem>
                                            <DropdownMenuItem 
                                                onClick={() => setMovingEntity({ id: response.entityId!, name: response.entityName || 'Identified Entity' })}
                                                className="rounded-lg py-2 cursor-pointer gap-2 font-medium"
                                            >
                                                <GitPullRequest className="h-4 w-4 text-emerald-500" /> Move Pipeline Stage
                                            </DropdownMenuItem>
                                            <DropdownMenuItem 
                                                onClick={() => router.push(`/admin/meetings/new?entityId=${response.entityId}`)}
                                                className="rounded-lg py-2 cursor-pointer gap-2 font-medium"
                                            >
                                                <CalendarDays className="h-4 w-4 text-blue-500" /> Schedule Meeting
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator className="my-1" />
                                            <DropdownMenuItem 
                                                className="text-destructive focus:bg-destructive/10 rounded-lg py-2 cursor-pointer gap-2 font-medium" 
                                                onClick={() => handleDeleteClick([response.id])}
                                            >
                                                <Trash2 className="h-4 w-4" /> Delete Response
                                            </DropdownMenuItem>
                                        </>
                                    ) : (
                                        <>
                                            <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider px-2 py-1.5">
                                                Response Options
                                            </DropdownMenuLabel>
                                            <DropdownMenuItem 
                                                onClick={() => router.push(`/admin/surveys/${survey.id}/results/${response.id}`)}
                                                className="rounded-lg py-2 cursor-pointer gap-2 font-medium"
                                            >
                                                <Eye className="h-4 w-4 text-slate-500" /> View Detail
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator className="my-1" />
                                            <DropdownMenuItem 
                                                className="text-destructive focus:bg-destructive/10 rounded-lg py-2 cursor-pointer gap-2 font-medium" 
                                                onClick={() => handleDeleteClick([response.id])}
                                            >
                                                <Trash2 className="h-4 w-4" /> Delete Response
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={visibleQuestions.length + 6} className="h-48 text-center text-muted-foreground italic">
                            {attributionFilter !== 'all' || Object.keys(columnFilters).length > 0 ? "No responses match this filter." : "No responses received for this survey yet."}
                        </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>

            {filteredResponses.length > 0 && (
                <BentoPagination
                    currentPage={currentPage}
                    totalPages={Math.ceil(filteredResponses.length / pageSize)}
                    totalRecords={filteredResponses.length}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setCurrentPage(1);
                    }}
                />
            )}

            {/* Password Protected Delete Confirmation */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <div className="mx-auto bg-destructive/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                            <AlertTriangle className="h-6 w-6 text-destructive" />
                        </div>
                        <DialogTitle className="text-center text-xl font-semibold">Verify Identity</DialogTitle>
                        <DialogDescription className="text-center">
                            You are about to permanently delete <strong>{selectedIds.length}</strong> record{selectedIds.length !== 1 ? 's' : ''}. Please enter your admin password to proceed.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5">
                                <Lock className="h-3 w-3" /> Confirm Password
                            </Label>
                            <Input 
                                type="password" 
                                placeholder="Your account password…" 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)}
                                className="h-11 rounded-xl"
                                onKeyDown={(e) => e.key === 'Enter' && handleConfirmDelete()}
                            />
                            {authError && <p className="text-xs font-bold text-destructive animate-pulse px-1">{authError}</p>}
                        </div>
                    </div>

                    <DialogFooter className="sm:justify-between gap-2">
                        <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
                            Cancel
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={handleConfirmDelete} 
                            disabled={isDeleting || !password}
                            className="font-semibold h-11 px-8 rounded-xl shadow-lg transition-all active:scale-95"
                        >
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Permanently Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Floating Bulk Actions Bar */}
            <SurveyAnalyticsBulkActionsBar
                selectedResponseIds={selectedIds}
                identifiedEntityIds={identifiedEntityIds}
                onClearSelection={() => setSelectedIds([])}
                onDeleteSelected={() => handleDeleteClick(selectedIds)}
                onActionComplete={() => setSelectedIds([])}
            />

            {/* Row-level Entity Tag & Stage Dialogs */}
            <SurveyEntityManageDialogs
                taggingEntity={taggingEntity}
                onCloseTagging={() => setTaggingEntity(null)}
                movingEntity={movingEntity}
                onCloseMoving={() => setMovingEntity(null)}
                onComplete={() => {
                    setTaggingEntity(null);
                    setMovingEntity(null);
                }}
            />
        </div>
    )
}

export default ResponsesListView;
