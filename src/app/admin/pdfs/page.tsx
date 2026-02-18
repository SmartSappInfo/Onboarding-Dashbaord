'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { format } from 'date-fns';
import Link from 'next/link';

import type { PDFForm } from '@/lib/types';
import { deletePdfForm, updatePdfFormStatus } from '@/lib/pdf-actions';

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
import { MoreHorizontal, Edit, Trash2, Loader2, FileText, Copy, ExternalLink, Eye, EyeOff, BarChart2 } from 'lucide-react';
import UploadPDFButton from './components/UploadPDFButton';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import SubmissionCount from './components/SubmissionCount';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function PdfFormsPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();

  const [formToDelete, setFormToDelete] = useState<PDFForm | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const pdfsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'pdfs'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: pdfs, isLoading } = useCollection<PDFForm>(pdfsQuery);
  
  const handleDelete = async () => {
    if (!formToDelete || !user) return;
    
    setIsDeleting(true);
    const result = await deletePdfForm(formToDelete.id, formToDelete.storagePath, user.uid);
    
    if (result.success) {
      toast({ title: 'Document Deleted' });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    
    setFormToDelete(null);
    setIsDeleting(false);
  }

  const handleStatusChange = async (pdf: PDFForm, status: PDFForm['status']) => {
    if (!user) {
        toast({ variant: 'destructive', title: 'You must be logged in.' });
        return;
    }
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
  }

  const renderActions = (pdf: PDFForm) => (
    <div className="flex items-center justify-end gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              if (typeof window !== 'undefined') {
                const url = `${window.location.origin}/forms/${pdf.id}`;
                navigator.clipboard.writeText(url);
                toast({
                  title: "Link Copied",
                  description: "Public form URL copied to clipboard.",
                });
              }
            }}
          >
            <Copy className="h-4 w-4" />
            <span className="sr-only">Copy link</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Copy Public Link</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <a href={`/forms/${pdf.id}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              <span className="sr-only">View public page</span>
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>View Public Page</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => router.push(`/admin/pdfs/${pdf.id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            <span>Map Fields</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(`/admin/pdfs/${pdf.id}/submissions`)}>
            <BarChart2 className="mr-2 h-4 w-4" />
            <span>View Responses</span>
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
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-between gap-4 mb-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Doc Signing</h1>
                <p className="text-muted-foreground">Manage your documents for signing and filling.</p>
            </div>
            <UploadPDFButton />
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block rounded-lg border bg-card text-card-foreground shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[100px] text-center">Fields</TableHead>
                <TableHead className="w-[120px] text-center">Responses</TableHead>
                <TableHead className="w-[180px] hidden md:table-cell">Created At</TableHead>
                <TableHead className="w-[160px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : pdfs && pdfs.length > 0 ? (
                pdfs.map((pdf) => (
                  <TableRow key={pdf.id}>
                    <TableCell className="font-medium">{pdf.name}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(pdf.status)} className="capitalize">{pdf.status}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium">{pdf.fields?.length || 0}</TableCell>
                    <TableCell className="text-center">
                        <Button variant="link" asChild className="h-auto p-0 font-semibold">
                            <Link href={`/admin/pdfs/${pdf.id}/submissions`}>
                                <SubmissionCount pdfId={pdf.id} />
                            </Link>
                        </Button>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{format(new Date(pdf.createdAt), "PPP")}</TableCell>
                    <TableCell className="text-right">
                       {renderActions(pdf)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No Documents Yet</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Upload your first document to get started.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="grid gap-4 md:hidden">
            {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)
            ) : pdfs && pdfs.length > 0 ? (
                pdfs.map((pdf) => (
                    <Card key={pdf.id}>
                        <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <CardTitle className="text-lg">{pdf.name}</CardTitle>
                                    <CardDescription>
                                        Created: {format(new Date(pdf.createdAt), "MMM d, yyyy")}
                                    </CardDescription>
                                </div>
                                <Badge variant={getStatusVariant(pdf.status)} className="capitalize">
                                    {pdf.status}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pb-4">
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex flex-col items-center p-2 rounded-lg bg-muted/50 flex-1 mr-2">
                                    <span className="text-muted-foreground text-xs uppercase font-semibold">Fields</span>
                                    <span className="text-lg font-bold">{pdf.fields?.length || 0}</span>
                                </div>
                                <div className="flex flex-col items-center p-2 rounded-lg bg-muted/50 flex-1 ml-2">
                                    <span className="text-muted-foreground text-xs uppercase font-semibold">Responses</span>
                                    <Button variant="link" asChild className="h-auto p-0 font-bold text-lg">
                                        <Link href={`/admin/pdfs/${pdf.id}/submissions`}>
                                            <SubmissionCount pdfId={pdf.id} />
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end pt-0">
                            {renderActions(pdf)}
                        </CardFooter>
                    </Card>
                ))
            ) : (
                <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/20">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No Documents Yet</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Upload your first document to get started.</p>
                </div>
            )}
        </div>
      </div>
       <AlertDialog open={!!formToDelete} onOpenChange={(open) => !open && setFormToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the document <span className="font-bold">"{formToDelete?.name}"</span> and its associated file.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
