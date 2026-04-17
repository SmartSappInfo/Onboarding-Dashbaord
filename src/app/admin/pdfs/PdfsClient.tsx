
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, doc, updateDoc, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser } from '@/firebase';
import { format } from 'date-fns';
import Link from 'next/link';

import type { PDFForm } from '@/lib/types';
import { deletePdfForm, updatePdfFormStatus, clonePdfForm } from '@/lib/pdf-actions';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { MoreHorizontal, Edit, Trash2, Loader2, FileText, Copy, ExternalLink, Eye, EyeOff, BarChart2, Search, CopyPlus } from 'lucide-react';
import UploadPDFButton from './components/UploadPDFButton';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import SubmissionCount from './components/SubmissionCount';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkspace } from '@/context/WorkspaceContext';

export default function PdfsClient() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();

  const [formToDelete, setFormToDelete] = useState<PDFForm | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const pdfsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    // Apply Workspace Filter via array-contains
    return query(
        collection(firestore, 'pdfs'), 
        where('workspaceIds', 'array-contains', activeWorkspaceId),
        orderBy('createdAt', 'desc')
    );
  }, [firestore, activeWorkspaceId]);

  const { data: pdfs, isLoading } = useCollection<PDFForm>(pdfsQuery);

  const handleDelete = async () => {
    if (!formToDelete || !user) return;
    
    setIsDeleting(true);
    try {
      const result = await deletePdfForm(formToDelete.id, formToDelete.storagePath, user.uid);
      
      if (result.success) {
        toast({ title: 'Document Deleted' });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to delete document' });
    }
    
    setFormToDelete(null);
    setIsDeleting(false);
  };

  const handleClone = async (pdf: PDFForm) => {
    if (!user) return;
    setCloningId(pdf.id);
    toast({ title: 'Cloning Document...', description: `Creating replica of "${pdf.name}".` });
    
    try {
        const result = await clonePdfForm(pdf.id, user.uid);
        if (result.success) {
            toast({ title: 'Document Cloned', description: 'Duplicated successfully. Opening Design Studio...' });
            router.push(`/admin/pdfs/${result.id}/edit`);
        } else {
            toast({ variant: 'destructive', title: 'Clone Failed', description: result.error });
        }
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to complete duplication.' });
    } finally {
        setCloningId(null);
    }
  };

  const handleStatusChange = async (pdf: PDFForm, status: PDFForm['status']) => {
    if (!user) return;
    const result = await updatePdfFormStatus(pdf.id, status, user.uid);
    if (result.success) {
        toast({ title: 'Status Updated', description: `"${pdf.name}" status set to ${status}.` });
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  const getStatusVariant = (status: PDFForm['status']) => {
    switch(status) {
      case 'published': return 'default';
      case 'archived': return 'outline';
      case 'draft':
      default:
        return 'secondary';
    }
  };

  const filteredPdfs = useMemo(() => {
    if (!pdfs) return [];
    return pdfs.filter(p => 
      (statusFilter === 'all' || p.status === statusFilter) &&
      (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.publicTitle?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [pdfs, searchTerm, statusFilter]);

  const renderActions = (pdf: PDFForm) => (
 <div className="flex items-center justify-end gap-1">
        <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
 className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors rounded-lg"
              onClick={(e) => {
                e.stopPropagation();
                if (typeof window !== 'undefined') {
                  const url = `${window.location.origin}/forms/${pdf.slug || pdf.id}`;
                  navigator.clipboard.writeText(url);
                  toast({ title: "Link Copied" });
                }
              }}
            >
 <Copy className="h-4 w-4" />
 <span className="sr-only">Copy link</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy Public Link</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
 <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors rounded-lg" asChild>
              <a href={`/forms/${pdf.slug || pdf.id}`} target="_blank" rel="noopener noreferrer">
 <ExternalLink className="h-4 w-4" />
 <span className="sr-only">View public page</span>
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>View Public Page</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
 className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors rounded-lg"
              onClick={() => router.push(`/admin/pdfs/${pdf.id}/edit`)}
            >
 <Edit className="h-4 w-4" />
 <span className="sr-only">Edit fields</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Map Fields</TooltipContent>
        </Tooltip>
        </TooltipProvider>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
 <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary transition-colors rounded-lg">
 <span className="sr-only">Open menu</span>
 <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="rounded-xl w-48">
 <DropdownMenuLabel className="text-[10px] font-semibold px-3 py-2 text-muted-foreground ">Management</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => router.push(`/admin/pdfs/${pdf.id}/edit`)}>
 <Edit className="mr-2 h-4 w-4" />
            <span>Design Studio</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(`/admin/pdfs/${pdf.id}/submissions`)}>
 <BarChart2 className="mr-2 h-4 w-4" />
            <span>Submission Records</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleClone(pdf)} disabled={cloningId !== null}>
            {cloningId === pdf.id ? (
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
 <CopyPlus className="mr-2 h-4 w-4" />
            )}
            <span>Clone Document</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleStatusChange(pdf, pdf.status === 'published' ? 'draft' : 'published')}>
              {pdf.status === 'published' ? (
 <><EyeOff className="mr-2 h-4 w-4" /><span>Unpublish</span></>
              ) : (
 <><Eye className="mr-2 h-4 w-4" /><span>Publish</span></>
              )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
 className="text-destructive focus:bg-destructive/10"
            onClick={() => setFormToDelete(pdf)}
          >
 <Trash2 className="mr-2 h-4 w-4" />
            <span>Delete Document</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <TooltipProvider>
 <div className="space-y-6 text-left">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <h1 className="text-2xl font-bold text-foreground tracking-tight">Doc Signing Studio</h1>
 <p className="text-sm text-muted-foreground mt-1">Manage interactive institutional agreements and tracking.</p>
                </div>
 <div className="flex justify-end items-center shrink-0">
                    <UploadPDFButton />
                </div>
            </div>
            <div className="flex flex-col md:flex-row gap-3 items-center">
                <div className="relative flex-1 w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search document titles..." 
                        className="pl-10 h-10 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:border-primary/50 focus:ring-primary/20 font-medium" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px] h-10 bg-muted/50 border-border text-foreground rounded-xl">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border bg-card">
                        <SelectItem value="all">Global Hub</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="draft">Drafts</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                </Select>
            </div>

 <div className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
            <Table>
                <TableHeader>
 <TableRow className="bg-muted/30 border-b border-border">
 <TableHead className="pl-6 text-[10px] font-semibold py-4 text-muted-foreground uppercase tracking-widest">Document Title</TableHead>
 <TableHead className="w-[120px] text-center text-[10px] font-semibold py-4 text-muted-foreground uppercase tracking-widest">Status</TableHead>
 <TableHead className="w-[100px] text-center text-[10px] font-semibold py-4 text-muted-foreground uppercase tracking-widest">Fields</TableHead>
 <TableHead className="w-[120px] text-center text-[10px] font-semibold py-4 text-muted-foreground uppercase tracking-widest">Signed Recs</TableHead>
 <TableHead className="w-[180px] hidden md:table-cell text-[10px] font-semibold py-4 text-muted-foreground uppercase tracking-widest">Created At</TableHead>
 <TableHead className="w-[160px] text-right text-[10px] font-semibold py-4 pr-6 text-muted-foreground uppercase tracking-widest">Management</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
 <TableCell className="pl-6"><Skeleton className="h-5 w-3/4" /></TableCell>
 <TableCell><Skeleton className="h-6 w-20 mx-auto rounded-full" /></TableCell>
 <TableCell><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
 <TableCell><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
 <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-full" /></TableCell>
 <TableCell className="text-right pr-6"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                    ))
                ) : filteredPdfs.length > 0 ? (
                    filteredPdfs.map((pdf) => (
 <TableRow key={pdf.id} className="group hover:bg-muted/30 transition-colors border-border">
 <TableCell className="font-bold pl-6">
 <Link href={`/admin/pdfs/${pdf.id}/edit`} className="hover:underline hover:text-primary transition-colors text-sm">
                            {pdf.name}
                        </Link>
                        </TableCell>
 <TableCell className="text-center">
                        <Badge variant={getStatusVariant(pdf.status)} className="capitalize text-[9px] font-semibold rounded-full px-2.5">{pdf.status}</Badge>
                        </TableCell>
 <TableCell className="text-center font-semibold text-sm tabular-nums opacity-60">{pdf.fields?.length || 0}</TableCell>
 <TableCell className="text-center">
 <Button variant="link" asChild className="h-auto p-0 font-semibold text-sm hover:text-primary">
                                <Link href={`/admin/pdfs/${pdf.id}/submissions`}>
                                    <SubmissionCount pdfId={pdf.id} />
                                </Link>
                            </Button>
                        </TableCell>
 <TableCell className="hidden md:table-cell text-[10px] font-bold text-muted-foreground ">{pdf.createdAt ? format(new Date(pdf.createdAt), "MMM d, yyyy") : '—'}</TableCell>
 <TableCell className="text-right pr-6">
                        {renderActions(pdf)}
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
 <TableCell colSpan={6} className="h-64 text-center">
 <div className="flex flex-col items-center justify-center gap-3 opacity-30">
 <FileText className="h-12 w-12" />
 <p className="font-semibold text-xs">No document templates found in this workspace hub</p>
                        </div>
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
            </div>
        </div>
      <AlertDialog open={!!formToDelete} onOpenChange={(isOpen) => !isOpen && setFormToDelete(null)}>
        <AlertDialogContent className="rounded-2xl border-border shadow-lg">
          <AlertDialogHeader>
 <AlertDialogTitle className="font-semibold">Delete Document?</AlertDialogTitle>
 <AlertDialogDescription className="text-sm font-medium">
 This will permanently remove the document <span className="font-bold text-foreground">"{formToDelete?.name}"</span> and its associated file. Public signing links will be broken.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
 <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
 <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold">
 {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Confirm Deletion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
