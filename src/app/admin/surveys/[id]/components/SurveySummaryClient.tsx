'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { doc, collection, query, orderBy, limit, getCountFromServer } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { usePermissions } from '@/hooks/use-permissions';
import { Survey, SurveyResponse } from '@/lib/types';
import { PageContainer } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, Edit, Calendar, Activity, Loader2, ListPlus, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { stripHtml } from '@/lib/utils';
import { AsyncEntityAvatar } from '@/app/admin/components/AsyncEntityAvatar';

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
function extractFirstMeaningfulAnswer(answers: { questionId: string; value: any }[] | undefined): string {
    if (!answers || !Array.isArray(answers) || answers.length === 0) return '—';
    for (const ans of answers) {
        const val = ans.value;
        if (!val) continue;
        if (typeof val === 'string' || typeof val === 'number') {
            const stripped = stripHtml(String(val)).trim();
            if (stripped.length > 0) return stripped.substring(0, 100) + (stripped.length > 100 ? '...' : '');
        }
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
             if (val.option) return String(val.option);
             if (val.other) return String(val.other);
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

                    <div className="flex items-center gap-3 shrink-0">
                        {canEdit && (
                            <Button 
                                variant="outline" 
                                className="h-11 px-6 rounded-xl font-semibold border-border bg-background hover:bg-muted transition-colors shadow-sm"
                                onClick={() => router.push(`/admin/surveys/${id}/edit`)}
                            >
                                <Edit className="mr-2 h-4 w-4" />
                                Design Studio
                            </Button>
                        )}
                        <Button 
                            className="h-11 px-6 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
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
                                                        {res.respondentName || 'Anonymous'}
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
