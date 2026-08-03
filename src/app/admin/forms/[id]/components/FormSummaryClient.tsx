'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { doc, collection, query, orderBy, limit, getCountFromServer, where } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { usePermissions } from '@/hooks/use-permissions';
import type { Form, FormSubmission } from '@/lib/types';
import { PageContainer } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  BarChart3,
  Edit,
  Calendar,
  Activity,
  Loader2,
  ListPlus,
  ExternalLink,
  Copy,
  Check,
  FileText,
  LayoutGrid
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { stripHtml } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      ease: 'easeOut' as const,
    },
  }),
};

/**
 * PURPOSE: Render a comprehensive Form Summary Page displaying form details, field schema, quick metrics, recent submissions, and navigation to Studio Editor & Deep Analytics.
 * CAUTION: Validates workspace permissions (studios.forms.view and studios.forms.edit) before rendering administrative data.
 * TESTABILITY: Navigate to /admin/forms/[id]; verify summary details, quick field preview, and action button routes.
 */
export default function FormSummaryClient({ id }: { id: string }) {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { can } = usePermissions();
  const canView = can('studios', 'forms', 'view');
  const canEdit = can('studios', 'forms', 'edit');

  const [totalSubmissions, setTotalSubmissions] = React.useState<number | null>(null);
  const [isCounting, setIsCounting] = React.useState(true);
  const [copiedLink, setCopiedLink] = React.useState(false);

  const formDocRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'forms', id);
  }, [firestore, id]);

  const { data: form, isLoading: isFormLoading } = useDoc<Form>(formDocRef);

  useSetBreadcrumb(form?.internalName || form?.title || 'Form Summary', `/admin/forms/${id}`);

  const submissionsColRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return query(
      collection(firestore, 'form_submissions'),
      where('formId', '==', id),
      orderBy('submittedAt', 'desc'),
      limit(5)
    );
  }, [firestore, id]);

  const { data: recentSubmissions, isLoading: isSubmissionsLoading } = useCollection<FormSubmission>(submissionsColRef);

  React.useEffect(() => {
    let isMounted = true;
    const fetchCount = async () => {
      if (!firestore || !id) return;
      try {
        setIsCounting(true);
        const colRef = collection(firestore, 'form_submissions');
        const q = query(colRef, where('formId', '==', id));
        const snapshot = await getCountFromServer(q);
        if (isMounted) {
          setTotalSubmissions(snapshot.data().count);
        }
      } catch (err) {
        console.error('[FormSummaryClient] Failed to count submissions:', err);
        if (isMounted) setTotalSubmissions(0);
      } finally {
        if (isMounted) setIsCounting(false);
      }
    };

    fetchCount();
    return () => {
      isMounted = false;
    };
  }, [firestore, id]);

  if (!canView) {
    return (
      <PageContainer>
        <div className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">You do not have permission to view form summary data.</p>
        </div>
      </PageContainer>
    );
  }

  if (isFormLoading) {
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

  if (!form) {
    return (
      <PageContainer>
        <div className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">Form definition not found.</p>
        </div>
      </PageContainer>
    );
  }

  const isPublished = form.status === 'published';
  const publicFormUrl = form.slug ? `${window.location.origin}/p/${form.slug}` : `${window.location.origin}/f/${form.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicFormUrl);
    setCopiedLink(true);
    toast({ title: 'Copied Link!', description: 'Public form link copied to clipboard.' });
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <PageContainer>
      <div className="space-y-8 pb-32">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl shrink-0">
              <FileText className="h-8 w-8" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-3xl font-bold tracking-tight text-foreground truncate">
                  {form.internalName || form.title}
                </h1>
                <Badge variant={isPublished ? 'default' : 'secondary'} className="uppercase text-[10px] tracking-wider font-bold">
                  {form.status}
                </Badge>
                <Badge variant="outline" className="uppercase text-[10px] tracking-wider font-bold">
                  {form.formType}
                </Badge>
              </div>
              <p className="text-muted-foreground max-w-2xl text-sm truncate">
                {form.slug ? `/${form.slug}` : `ID: ${form.id}`}
                {form.description && ` — ${stripHtml(form.description).substring(0, 120)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {canEdit && (
              <Button
                variant="outline"
                className="h-11 px-6 rounded-xl font-semibold border-border bg-background hover:bg-muted transition-colors shadow-sm"
                onClick={() => router.push(`/admin/forms/${id}/edit`)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Design Studio
              </Button>
            )}
            <Button
              className="h-11 px-6 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
              onClick={() => router.push(`/admin/forms/${id}/submissions`)}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Submissions & Analytics
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
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Submissions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold tracking-tighter">
                    {isCounting ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mt-2" /> : (totalSubmissions?.toLocaleString() ?? (form.submissionCount || 0))}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div custom={1} initial="hidden" animate="visible" variants={cardVariants}>
            <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden relative h-full">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <ListPlus className="h-16 w-16" />
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Configured Fields</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold tracking-tighter">
                    {form.fields?.length || 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div custom={2} initial="hidden" animate="visible" variants={cardVariants}>
            <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden relative h-full">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Calendar className="h-16 w-16" />
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Created At</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight">
                    {form.createdAt ? format(new Date(form.createdAt), 'MMM d, yyyy') : '—'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Share & Embed Quick Strip */}
        <Card className="rounded-2xl border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Public Form URL & Integration</p>
                <p className="text-xs text-muted-foreground truncate max-w-md">{publicFormUrl}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" onClick={handleCopyLink} className="rounded-xl font-bold gap-2 w-full sm:w-auto">
                {copiedLink ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                {copiedLink ? 'Copied' : 'Copy Link'}
              </Button>
              <Button variant="outline" size="sm" asChild className="rounded-xl font-bold gap-2 w-full sm:w-auto">
                <a href={publicFormUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> Open Form
                </a>
              </Button>
            </div>
          </div>
        </Card>

        {/* Form Fields Schema Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-foreground">Form Structure & Field Schema</h2>
            <Badge variant="outline" className="font-mono text-xs">{form.fields?.length || 0} Fields</Badge>
          </div>

          <Card className="rounded-2xl border-border bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent bg-muted/20">
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground pl-6">Field Label</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground text-center">Type</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground text-center">App Field ID</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground text-right pr-6">Required</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {form.fields && form.fields.length > 0 ? (
                  form.fields.map((field) => (
                    <TableRow key={field.id} className="border-border hover:bg-muted/30 transition-colors">
                      <TableCell className="font-bold pl-6 text-sm">
                        {field.labelOverride || field.appFieldId || field.id}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs text-muted-foreground">
                        {field.appFieldId || '—'}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Badge variant={field.required ? 'default' : 'outline'} className="text-[9px] font-semibold">
                          {field.required ? 'REQUIRED' : 'OPTIONAL'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                      No form fields configured yet. Click "Design Studio" to add fields.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* Recent Submissions Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-foreground">Recent Submissions</h2>
            <Button variant="link" onClick={() => router.push(`/admin/forms/${id}/submissions`)} className="font-bold text-sm hover:text-primary">
              View All Submissions &rarr;
            </Button>
          </div>

          <Card className="rounded-2xl border-border bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent bg-muted/20">
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground pl-6">Submission ID</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground text-center">Entity ID</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground text-center">Date</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isSubmissionsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="pl-6"><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                      <TableCell className="text-right pr-6"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : recentSubmissions && recentSubmissions.length > 0 ? (
                  recentSubmissions.map((sub) => (
                    <TableRow key={sub.id} className="border-border hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-xs font-bold pl-6 text-foreground">
                        {sub.id}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs text-muted-foreground">
                        {sub.entityId || '—'}
                      </TableCell>
                      <TableCell className="text-center text-xs font-semibold text-muted-foreground">
                        {sub.submittedAt ? format(new Date(sub.submittedAt), 'MMM d, yyyy HH:mm') : '—'}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/admin/forms/${id}/submissions`)}
                          className="rounded-xl font-bold text-xs"
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                      No response submissions recorded yet for this form.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
