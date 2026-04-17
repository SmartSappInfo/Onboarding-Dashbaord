'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, doc, addDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import type { Form } from '@/lib/types';
import { createFormAction, deleteFormAction, cloneFormAction, toggleFormStatusAction } from '@/lib/forms-actions';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipProvider,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  PlusCircle,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  CopyPlus,
  Loader2,
  ClipboardSignature,
  Hash,
  FileText,
  BarChart2,
  Archive,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function FormsClient() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const { activeWorkspaceId, activeOrganizationId } = useTenant();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formToDelete, setFormToDelete] = useState<Form | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { can } = usePermissions();
  const canCreate = can('studios', 'forms', 'create');
  const canEdit = can('studios', 'forms', 'edit');
  const canDelete = can('studios', 'forms', 'delete');

  // Live Firestore subscription
  const formsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'forms'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, activeWorkspaceId]);

  const { data: forms, isLoading } = useCollection<Form>(formsQuery);

  // Actions
  const handleDelete = async () => {
    if (!formToDelete || !user) return;
    const result = await deleteFormAction(formToDelete.id, user.uid);
    if (result.success) {
      toast({ title: 'Form Deleted', description: `"${formToDelete.internalName}" and ${result.deletedSubmissions} submissions removed.` });
      setFormToDelete(null);
    } else {
      toast({ variant: 'destructive', title: 'Delete Failed', description: result.error });
    }
  };

  const handleClone = async (form: Form) => {
    if (!user) return;
    setCloningId(form.id);
    const result = await cloneFormAction(form.id, user.uid);
    if (result.success) {
      toast({ title: 'Form Cloned', description: `"${form.internalName}" duplicated as a draft.` });
    } else {
      toast({ variant: 'destructive', title: 'Clone Failed', description: result.error });
    }
    setCloningId(null);
  };

  const handleStatusToggle = async (form: Form, status: 'published' | 'draft' | 'archived') => {
    if (!user) return;
    const result = await toggleFormStatusAction(form.id, status, user.uid);
    if (result.success) {
      toast({ title: 'Status Updated', description: `"${form.internalName}" is now ${status}.` });
    } else {
      toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
    }
  };

  const handleCreateNew = async () => {
    if (!user || !activeWorkspaceId || !activeOrganizationId) return;
    setIsCreating(true);

    const slug = `form-${Date.now().toString(36)}`;
    const newForm: Omit<Form, 'id' | 'createdAt' | 'updatedAt' | 'submissionCount'> = {
      workspaceId: activeWorkspaceId,
      organizationId: activeOrganizationId,
      internalName: 'Untitled Form',
      title: 'Untitled Form',
      slug,
      formType: 'global',
      fields: [],
      theme: {
        preset: 'professional',
        cardWidth: 'md',
        inputStyle: 'outline',
        labelPlacement: 'top',
        ctaLabel: 'Submit',
        ctaStyle: 'solid',
        ctaWidth: 'full',
        ctaAlignment: 'center',
        backgroundStyle: 'solid',
      },
      successBehavior: { type: 'message', value: 'Thank you for your submission!' },
      actions: { tags: [], automations: [], notifications: { internalUserIds: [] }, webhooks: [] },
      status: 'draft',
    };

    try {
      const result = await createFormAction(newForm, user.uid);
      if (result.success) {
        router.push(`/admin/forms/${result.id}/edit`);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = (form: Form) => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/p/f/${form.slug}`;
      navigator.clipboard.writeText(url);
      toast({ title: 'Link Copied', description: 'Public form URL copied to clipboard.' });
    }
  };

  // Filtering
  const filteredForms = useMemo(() => {
    let result = forms || [];
    if (statusFilter !== 'all') {
      result = result.filter(f => f.status === statusFilter);
    }
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(f =>
        f.internalName?.toLowerCase().includes(s) || f.title.toLowerCase().includes(s) || f.slug.toLowerCase().includes(s)
      );
    }
    return result;
  }, [forms, statusFilter, searchTerm]);

  const getStatusVariant = (status: Form['status']) => {
    switch (status) {
      case 'published': return 'default';
      case 'draft': return 'secondary';
      case 'archived': return 'outline';
      default: return 'secondary';
    }
  };

  // Row actions renderer
  const renderActions = (form: Form) => (
    <div className="flex items-center justify-end gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors" onClick={() => handleCopyLink(form)}>
              <Copy className="h-4 w-4" />
              <span className="sr-only">Copy link</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Copy Public Link</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors" asChild>
              <a href={`/p/f/${form.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                <span className="sr-only">Preview</span>
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Preview Public Form</p></TooltipContent>
        </Tooltip>
        {canEdit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors" onClick={() => router.push(`/admin/forms/${form.id}/edit`)}>
                <Edit className="h-4 w-4" />
                <span className="sr-only">Edit</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Edit Form</p></TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary transition-colors">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          {canEdit && (
            <DropdownMenuItem onClick={() => router.push(`/admin/forms/${form.id}/edit`)}>
              <Edit className="mr-2 h-4 w-4" /> Edit Builder
            </DropdownMenuItem>
          )}
          {canCreate && (
            <DropdownMenuItem onClick={() => handleClone(form)} disabled={cloningId !== null}>
              {cloningId === form.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CopyPlus className="mr-2 h-4 w-4" />}
              Clone Form
            </DropdownMenuItem>
          )}
          {canEdit && <DropdownMenuSeparator />}
          {canEdit && (
            <DropdownMenuItem onClick={() => handleStatusToggle(form, form.status === 'published' ? 'draft' : 'published')}>
              {form.status === 'published' ? (
                <><EyeOff className="mr-2 h-4 w-4" /> Unpublish</>
              ) : (
                <><Eye className="mr-2 h-4 w-4" /> Publish</>
              )}
            </DropdownMenuItem>
          )}
          {canEdit && form.status !== 'archived' && (
            <DropdownMenuItem onClick={() => handleStatusToggle(form, 'archived')}>
              <Archive className="mr-2 h-4 w-4" /> Archive
            </DropdownMenuItem>
          )}
          {canDelete && <DropdownMenuSeparator />}
          {canDelete && (
            <DropdownMenuItem className="text-destructive focus:bg-destructive/10" onClick={() => setFormToDelete(form)}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="h-full overflow-y-auto bg-background">
        <div className="space-y-8 text-left">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex flex-col">
              <h1 className="text-3xl font-semibold tracking-tight">Form Builder</h1>
              <p className="text-xs font-bold text-muted-foreground mt-1">Design and deploy data capture forms</p>
            </div>
            <div className="flex justify-end items-center gap-3 shrink-0">
              {canCreate && (
                <Button onClick={handleCreateNew} disabled={isCreating} className="h-11 rounded-xl font-bold shadow-lg">
                  {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  New Form
                </Button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-none shadow-sm rounded-2xl bg-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl"><ClipboardSignature className="h-4 w-4 text-primary" /></div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground">Total Forms</p>
                    <p className="text-2xl font-semibold tabular-nums">{isLoading ? '—' : (forms?.length || 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm rounded-2xl bg-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-xl"><Eye className="h-4 w-4 text-emerald-600" /></div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground">Published</p>
                    <p className="text-2xl font-semibold tabular-nums">{isLoading ? '—' : forms?.filter(f => f.status === 'published').length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm rounded-2xl bg-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-xl"><FileText className="h-4 w-4 text-amber-600" /></div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground">Drafts</p>
                    <p className="text-2xl font-semibold tabular-nums">{isLoading ? '—' : forms?.filter(f => f.status === 'draft').length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm rounded-2xl bg-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-xl"><Hash className="h-4 w-4 text-blue-600" /></div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground">Total Submissions</p>
                    <p className="text-2xl font-semibold tabular-nums">{isLoading ? '—' : forms?.reduce((s, f) => s + (f.submissionCount || 0), 0) || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-3xl border shadow-sm ring-1 ring-border">
            <div className="relative flex-grow w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
              <Input
                placeholder="Search forms by name or slug..."
                className="pl-11 h-12 rounded-2xl bg-card border-none font-bold ring-1 ring-border focus:ring-primary/20"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-12 w-full md:w-[200px] rounded-2xl bg-card border-none font-semibold text-[10px] transition-all hover:bg-accent/10 ring-1 ring-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Forms</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Drafts</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-border/50 bg-card text-card-foreground shadow-sm overflow-hidden ring-1 ring-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-card/20 border-b border-border/50">
                  <TableHead className="text-[10px] font-semibold py-4 pl-6">Form Name</TableHead>
                  <TableHead className="w-[100px] text-[10px] font-semibold py-4 text-center">Type</TableHead>
                  <TableHead className="w-[120px] text-[10px] font-semibold py-4 text-center">Status</TableHead>
                  <TableHead className="w-[100px] text-center text-[10px] font-semibold py-4">Fields</TableHead>
                  <TableHead className="w-[120px] text-center text-[10px] font-semibold py-4">Submissions</TableHead>
                  <TableHead className="w-[180px] hidden md:table-cell text-[10px] font-semibold py-4">Created</TableHead>
                  <TableHead className="w-[160px] text-right text-[10px] font-semibold py-4 pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="pl-6"><Skeleton className="h-5 w-3/4" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-16 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-full" /></TableCell>
                      <TableCell className="text-right pr-6"><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredForms.length > 0 ? (
                  filteredForms.map(form => (
                    <TableRow key={form.id} className="group hover:bg-accent/5 transition-colors border-border/30">
                      <TableCell className="font-bold pl-6">
                        <div className="flex flex-col gap-0.5">
                          <Link href={`/admin/forms/${form.id}/edit`} className="hover:underline hover:text-primary transition-colors text-sm">
                            {form.internalName || form.title}
                          </Link>
                          <code className="text-[10px] text-muted-foreground font-mono opacity-50">/{form.slug}</code>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-[9px] font-semibold uppercase h-5 px-2 capitalize">
                          {form.formType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={getStatusVariant(form.status)} className="capitalize text-[9px] font-semibold uppercase rounded-full px-2.5">
                          {form.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-semibold text-sm tabular-nums">{form.fields?.length || 0}</TableCell>
                      <TableCell className="text-center font-semibold text-sm tabular-nums">{form.submissionCount || 0}</TableCell>
                      <TableCell className="hidden md:table-cell text-[10px] font-bold text-muted-foreground">
                        {form.createdAt ? format(new Date(form.createdAt), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-right pr-6">{renderActions(form)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center gap-3 opacity-30">
                        <ClipboardSignature className="h-12 w-12" />
                        <p className="font-semibold text-xs">
                          {searchTerm || statusFilter !== 'all' ? 'No forms match your filters' : 'No forms created yet'}
                        </p>
                        {!searchTerm && statusFilter === 'all' && (
                          <Button variant="outline" size="sm" onClick={handleCreateNew} className="mt-2 rounded-xl font-bold">
                            <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Form
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!formToDelete} onOpenChange={open => !open && setFormToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-semibold">Delete Form?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium">
              This will permanently remove <span className="font-bold text-foreground">&quot;{formToDelete?.internalName}&quot;</span> and all {formToDelete?.submissionCount || 0} submissions. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold">
              Confirm Deletion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
