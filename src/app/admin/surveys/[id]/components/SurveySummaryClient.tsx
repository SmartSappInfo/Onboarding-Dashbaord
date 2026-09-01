'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { doc, collection, query, orderBy, limit, getCountFromServer } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { usePermissions } from '@/hooks/use-permissions';
import { Survey, SurveyResponse, ResolvedContact } from '@/lib/types';
import { PageContainer } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, Edit, Calendar, Activity, Loader2, ListPlus, ExternalLink, Building2, User as UserIcon, ShieldCheck, Phone, Mail, Copy, Check, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { stripHtml } from '@/lib/utils';
import { AsyncEntityAvatar } from '@/app/admin/components/AsyncEntityAvatar';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { resolveContact } from '@/lib/contact-adapter';
import { extractResponseContactDetails } from '@/lib/survey-response-utils';

/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * High-performance reconciled respondent cell for Survey Recent Activity overview.
 * Automatically cascades through:
 * 1. Live CRM Entity linkage (linked to /admin/entities/[id] with Live CRM badge)
 * 2. Response top-level snapshot fields
 * 3. Lead form capture details (leadDetails.company, leadDetails.name, phone, email)
 * 4. Response dynamic variables map
 * 5. Response answers heuristic scan
 */
function SummaryRespondentCell({ 
    response, 
    surveyElements 
}: { 
    response: SurveyResponse; 
    surveyElements?: Survey['elements'];
}) {
    const { activeWorkspaceId } = useWorkspace();
    const { toast } = useToast();
    const [contact, setContact] = React.useState<ResolvedContact | null>(null);
    const [isLoading, setIsLoading] = React.useState(Boolean(response.entityId));
    const [copiedField, setCopiedField] = React.useState<'phone' | 'email' | null>(null);
    const copyTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    React.useEffect(() => {
        return () => {
            if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        };
    }, []);

    React.useEffect(() => {
        let active = true;
        async function load() {
            if (!response.entityId) {
                if (active) setIsLoading(false);
                return;
            }
            try {
                const resolved = await resolveContact(response.entityId, activeWorkspaceId);
                if (active) setContact(resolved);
            } catch (err) {
                console.error("Failed to load contact in summary cell:", err);
            } finally {
                if (active) setIsLoading(false);
            }
        }
        load();
        return () => { active = false; };
    }, [response.entityId, activeWorkspaceId]);

    const details = React.useMemo(() => {
        return extractResponseContactDetails(response, contact, surveyElements);
    }, [response, contact, surveyElements]);

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
            toast({ variant: "destructive", title: "Copy Failed", description: "Could not access clipboard." });
        }
    };

    if (isLoading) {
        return <Skeleton className="h-5 w-28" />;
    }

    const hasAnyDetails = Boolean(
        details.entityName || 
        details.primaryContactName || 
        details.primaryContactPhone || 
        details.primaryContactEmail
    );

    if (!hasAnyDetails) {
        return (
            <span className="text-muted-foreground/70 italic text-xs font-normal">
                Anonymous
            </span>
        );
    }

    return (
        <div className="flex flex-col gap-1 py-0.5 max-w-[240px]">
            {/* Entity / School Name Header */}
            {details.entityName ? (
                <div className="flex items-center gap-1.5 min-w-0">
                    <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    {details.entityId ? (
                        <a
                            href={`/admin/entities/${details.entityId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-sm hover:underline hover:text-primary transition-colors truncate"
                            title={details.entityName}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {details.entityName}
                        </a>
                    ) : (
                        <span className="font-bold text-sm text-foreground truncate" title={details.entityName}>
                            {details.entityName}
                        </span>
                    )}
                    {details.isLiveCrm && (
                        <Badge variant="outline" className="h-4 px-1 text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shrink-0 gap-0.5">
                            <ShieldCheck className="h-2.5 w-2.5" /> Live
                        </Badge>
                    )}
                </div>
            ) : null}

            {/* Primary Contact Person / Subtext */}
            {details.primaryContactName && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                    <UserIcon className="h-3 w-3 shrink-0 opacity-70" />
                    <span className="truncate font-medium">{details.primaryContactName}</span>
                    {details.roleOrTitle && (
                        <span className="text-[9px] bg-muted px-1.5 py-0.2 rounded shrink-0">
                            {details.roleOrTitle}
                        </span>
                    )}
                </div>
            )}

            {/* Quick Contact Actions (Phone & Email) */}
            {(details.primaryContactPhone || details.primaryContactEmail) && (
                <div className="flex items-center gap-2 pt-0.5">
                    {details.primaryContactPhone && (
                        <div className="flex items-center gap-0.5">
                            <a
                                href={`tel:${details.primaryContactPhone.replace(/[^0-9+]/g, '')}`}
                                aria-label={`Call ${details.primaryContactPhone}`}
                                title={`Click to call ${details.primaryContactPhone}`}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline active:scale-[0.97] transition-all"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Phone className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate max-w-[90px]">{details.primaryContactPhone}</span>
                            </a>
                            <button
                                type="button"
                                onClick={(e) => handleCopy(details.primaryContactPhone, 'phone', e)}
                                aria-label="Copy phone"
                                title="Copy phone"
                                className="h-6 w-6 sm:h-4 sm:w-4 min-h-[28px] min-w-[28px] sm:min-h-0 sm:min-w-0 flex items-center justify-center p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground active:scale-[0.95]"
                            >
                                {copiedField === 'phone' ? <Check className="h-2.5 w-2.5 text-emerald-600" /> : <Copy className="h-2.5 w-2.5" />}
                            </button>
                        </div>
                    )}
                    {details.primaryContactEmail && (
                        <div className="flex items-center gap-0.5">
                            <a
                                href={`mailto:${encodeURIComponent(details.primaryContactEmail.trim())}`}
                                aria-label={`Email ${details.primaryContactEmail}`}
                                title={`Click to email ${details.primaryContactEmail}`}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-700 hover:underline active:scale-[0.97] transition-all"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Mail className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate max-w-[90px]">{details.primaryContactEmail}</span>
                            </a>
                            <button
                                type="button"
                                onClick={(e) => handleCopy(details.primaryContactEmail, 'email', e)}
                                aria-label="Copy email"
                                title="Copy email"
                                className="h-6 w-6 sm:h-4 sm:w-4 min-h-[28px] min-w-[28px] sm:min-h-0 sm:min-w-0 flex items-center justify-center p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground active:scale-[0.95]"
                            >
                                {copiedField === 'email' ? <Check className="h-2.5 w-2.5 text-blue-600" /> : <Copy className="h-2.5 w-2.5" />}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      ease: "easeOut" as const,
    },
  }),
};

// Helper to format answers for the preview table
function extractFirstMeaningfulAnswer(answers: { questionId: string; value: unknown }[] | undefined): string {
    if (!answers || !Array.isArray(answers) || answers.length === 0) return '—';
    for (const ans of answers) {
        const val = ans.value;
        if (!val) continue;
        if (typeof val === 'string' || typeof val === 'number') {
            const stripped = stripHtml(String(val)).trim();
            if (stripped.length > 0) return stripped.substring(0, 100) + (stripped.length > 100 ? '...' : '');
        }
        if (Array.isArray(val) && val.length > 0) {
            return val.map(String).join(', ').substring(0, 100);
        }
        if (typeof val === 'object' && val !== null) {
            const valObj = val as { option?: string; other?: string; options?: string[] };
            if (valObj.options && Array.isArray(valObj.options)) {
                const combined = [...valObj.options, valObj.other].filter(Boolean).join(', ');
                if (combined) return combined.substring(0, 100);
            }
            if (valObj.option === '__other__') {
                return valObj.other ? `Other: ${valObj.other.substring(0, 80)}` : 'Other';
            }
            if (valObj.option) return String(valObj.option).substring(0, 100);
            if (valObj.other) return String(valObj.other).substring(0, 100);
        }
    }
    return 'Data Submitted';
}

export default function SurveySummaryClient({ id }: { id: string }) {
    const firestore = useFirestore();
    const router = useRouter();
    const { can } = usePermissions();
    const canView = can('studios', 'surveys', 'view');
    const canEdit = can('studios', 'surveys', 'edit');

    const [totalResponses, setTotalResponses] = React.useState<number | null>(null);
    const [isCounting, setIsCounting] = React.useState(true);

    const surveyDocRef = useMemoFirebase(() => {
        if (!firestore || !id) return null;
        return doc(firestore, "surveys", id);
    }, [firestore, id]);

    const { data: survey, isLoading: isSurveyLoading } = useDoc<Survey>(surveyDocRef);

    useSetBreadcrumb(survey?.internalName || survey?.title || 'Survey Summary', `/admin/surveys/${id}`);

    const responsesColRef = useMemoFirebase(() => {
        if (!firestore || !id) return null;
        return query(collection(firestore, `surveys/${id}/responses`), orderBy("submittedAt", "desc"), limit(5));
    }, [firestore, id]);

    const { data: recentResponses, isLoading: isResponsesLoading } = useCollection<SurveyResponse>(responsesColRef);

    React.useEffect(() => {
        let isMounted = true;
        const fetchCount = async () => {
            if (!firestore || !id) return;
            try {
                setIsCounting(true);
                const q = collection(firestore, `surveys/${id}/responses`);
                const snapshot = await getCountFromServer(q);
                if (isMounted) {
                    setTotalResponses(snapshot.data().count);
                }
            } catch (err) {
                console.error("Failed to count responses:", err);
                if (isMounted) setTotalResponses(0);
            } finally {
                if (isMounted) setIsCounting(false);
            }
        };
        fetchCount();
        return () => { isMounted = false; };
    }, [firestore, id]);

    if (!canView) {
        return <PageContainer><div className="flex justify-center items-center h-64"><p className="text-muted-foreground">You do not have permission to view survey analytics.</p></div></PageContainer>;
    }

    if (isSurveyLoading) {
        return (
            <PageContainer>
                <div className="space-y-6">
                    <Skeleton className="h-10 w-1/3" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-32 w-full" />
                    </div>
                </div>
            </PageContainer>
        );
    }

    if (!survey) {
        return <PageContainer><div className="flex justify-center items-center h-64"><p className="text-muted-foreground">Survey not found.</p></div></PageContainer>;
    }

    const isPublished = survey.status === 'published';

    return (
        <PageContainer>
            <div className="space-y-8 pb-32">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex items-center gap-4">
                         {survey.entityId && (
                            <div className="hidden sm:block">
                                <AsyncEntityAvatar
                                    entityId={survey.entityId}
                                    src={survey.logoUrl || ''}
                                    name={survey.internalName || survey.title}
                                    className="h-16 w-16 shadow-sm ring-1 ring-border rounded-xl"
                                />
                            </div>
                        )}
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl font-bold tracking-tight text-foreground">{survey.internalName || survey.title}</h1>
                                <Badge variant={isPublished ? 'default' : 'secondary'} className="uppercase text-[10px] tracking-wider font-bold">
                                    {survey.status}
                                </Badge>
                            </div>
                            <p className="text-muted-foreground max-w-2xl">{stripHtml(survey.description || '').substring(0, 150)}{survey.description && survey.description.length > 150 ? '...' : ''}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        <Button 
                            variant="outline" 
                            className="h-11 px-5 rounded-xl font-semibold border-border bg-background hover:bg-muted transition-colors shadow-sm active:scale-[0.97]"
                            onClick={() => router.push(`/admin/surveys/${id}/distribution`)}
                        >
                            <Share2 className="mr-2 h-4 w-4 text-primary" />
                            Distribution Center
                        </Button>
                        {canEdit && (
                            <Button 
                                variant="outline" 
                                className="h-11 px-5 rounded-xl font-semibold border-border bg-background hover:bg-muted transition-colors shadow-sm active:scale-[0.97]"
                                onClick={() => router.push(`/admin/surveys/${id}/edit`)}
                            >
                                <Edit className="mr-2 h-4 w-4" />
                                Design Studio
                            </Button>
                        )}
                        <Button 
                            className="h-11 px-6 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-[0.97]"
                            onClick={() => router.push(`/admin/surveys/${id}/results`)}
                        >
                            <BarChart3 className="mr-2 h-4 w-4" />
                            Deep Analytics
                        </Button>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <motion.div custom={0} initial="hidden" animate="visible" variants={cardVariants}>
                        <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden relative h-full">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Activity className="h-16 w-16" />
                            </div>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Responses</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-bold tracking-tighter">
                                        {isCounting ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mt-2" /> : (totalResponses?.toLocaleString() || 0)}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div custom={1} initial="hidden" animate="visible" variants={cardVariants}>
                        <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden relative h-full">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Calendar className="h-16 w-16" />
                            </div>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Created At</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold tracking-tight mt-1">
                                    {survey.createdAt ? format(new Date(survey.createdAt), "MMM d, yyyy") : '—'}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                     {survey.createdAt ? format(new Date(survey.createdAt), "h:mm a") : ''}
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>

                     <motion.div custom={2} initial="hidden" animate="visible" variants={cardVariants}>
                        <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden relative h-full">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <ListPlus className="h-16 w-16" />
                            </div>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Status & Features</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <Badge variant="outline" className="bg-background text-xs">{survey.elements?.length || 0} Elements</Badge>
                                    {survey.scoringEnabled && <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs">Scoring Enabled</Badge>}
                                    {survey.webhookEnabled && <Badge variant="outline" className="bg-background text-xs">Webhooks</Badge>}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>

                {/* Recent Responses Table */}
                <motion.div custom={3} initial="hidden" animate="visible" variants={cardVariants}>
                    <Card className="rounded-2xl border-border bg-card shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg font-bold">Recent Activity</CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">The 5 most recent submissions for this blueprint.</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/surveys/${id}/results`)} className="hidden sm:flex text-muted-foreground hover:text-foreground">
                                View All <ExternalLink className="ml-2 h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-xl border border-border overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow className="border-border">
                                            <TableHead className="text-xs uppercase font-bold tracking-widest pl-6">Respondent</TableHead>
                                            <TableHead className="text-xs uppercase font-bold tracking-widest">Summary Preview</TableHead>
                                            <TableHead className="text-xs uppercase font-bold tracking-widest text-right pr-6">Submitted</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isResponsesLoading ? (
                                            Array.from({ length: 3 }).map((_, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="pl-6"><Skeleton className="h-5 w-24" /></TableCell>
                                                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                                    <TableCell className="text-right pr-6"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                                                </TableRow>
                                            ))
                                        ) : recentResponses && recentResponses.length > 0 ? (
                                            recentResponses.map((res) => (
                                                <TableRow key={res.id} className="border-border hover:bg-muted/30 transition-colors">
                                                    <TableCell className="pl-6 font-medium text-sm">
                                                        <SummaryRespondentCell response={res} surveyElements={survey.elements} />
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground truncate max-w-[200px] md:max-w-md">
                                                        {extractFirstMeaningfulAnswer(res.answers)}
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6 text-sm whitespace-nowrap">
                                                        {res.submittedAt ? format(new Date(res.submittedAt), "MMM d, h:mm a") : '—'}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                                                    No responses collected yet.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

            </div>
        </PageContainer>
    );
}
