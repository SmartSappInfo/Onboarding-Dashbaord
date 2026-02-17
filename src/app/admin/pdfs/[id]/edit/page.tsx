'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Pencil } from 'lucide-react';
import { type PDFForm, type PDFFormField } from '@/lib/types';
import { updatePdfFormMapping, updatePdfFormStatus, updatePdfFormName } from '@/lib/pdf-actions';
import { useToast } from '@/hooks/use-toast';
import FieldMapper from './components/FieldMapper';
import PdfPreviewDialog from './components/PdfPreviewDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


export default function EditPdfPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const pdfId = params.id as string;
  const firestore = useFirestore();
  const { user } = useUser();

  const [fields, setFields] = React.useState<PDFFormField[]>([]);
  const [password, setPassword] = React.useState('');
  const [passwordProtected, setPasswordProtected] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isStatusChanging, setIsStatusChanging] = React.useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [editableTitle, setEditableTitle] = React.useState('');

  const pdfDocRef = useMemoFirebase(() => {
    if (!firestore || !pdfId) return null;
    return doc(firestore, 'pdfs', pdfId);
  }, [firestore, pdfId]);

  const { data: pdf, isLoading } = useDoc<PDFForm>(pdfDocRef);
  
  React.useEffect(() => {
    if (pdf) {
      // Deep copy to avoid direct mutation of props and ensure editor state is independent
      setFields(JSON.parse(JSON.stringify(pdf.fields || [])));
      setPassword(pdf.password || '');
      setPasswordProtected(pdf.passwordProtected || false);
      setEditableTitle(pdf.name);
    }
  }, [pdf]);

  const handleSave = async () => {
    setIsSaving(true);
    const result = await updatePdfFormMapping(pdfId, {
      fields,
      password: passwordProtected ? password : '',
      passwordProtected,
    });
    if (result.success) {
      toast({ title: 'Field map saved successfully!' });
    } else {
      toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
    }
    setIsSaving(false);
  };
  
  const handleStatusChange = async (newStatus: PDFForm['status']) => {
    if (!user) {
        toast({ variant: 'destructive', title: 'You must be logged in.' });
        return;
    }
    setIsStatusChanging(true);
    const result = await updatePdfFormStatus(pdf.id, newStatus, user.uid);
    if (result.success) {
        toast({ title: 'Status Updated' });
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setIsStatusChanging(false);
  };

  const handleTitleSave = async () => {
    if (!pdf || editableTitle.trim() === '' || editableTitle.trim() === pdf.name) {
      setIsEditingTitle(false);
      return;
    }
    const result = await updatePdfFormName(pdf.id, editableTitle);
    if (result.success) {
      toast({ title: 'Title updated successfully!' });
    } else {
      toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
      setEditableTitle(pdf.name); // Revert on failure
    }
    setIsEditingTitle(false);
  };


  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 flex flex-col">
        <div className="flex-shrink-0">
          <Skeleton className="h-8 w-1/4" />
        </div>
        <div className="flex-grow min-h-0 mt-4">
          <Skeleton className="h-[calc(100%-4rem)] w-full" />
        </div>
      </div>
    )
  }

  if (!pdf) {
      return (
        <div className="text-center py-20">
            <p>Document not found.</p>
        </div>
      );
  }

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="flex-shrink-0 border-b p-2 flex items-center justify-between bg-card">
        <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" onClick={() => router.push('/admin/pdfs')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
            </Button>
            {isEditingTitle ? (
              <Input
                value={editableTitle}
                onChange={(e) => setEditableTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setIsEditingTitle(false);}}
                className="text-lg font-semibold h-9"
                autoFocus
              />
            ) : (
              <div className="flex items-center gap-1 group min-w-0">
                <h1 className="text-lg font-semibold truncate" title={pdf.name}>{pdf.name}</h1>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 flex-shrink-0" onClick={() => setIsEditingTitle(true)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            )}
        </div>
        <div className="flex items-center gap-2">
            <Select
                value={pdf.status}
                onValueChange={(value: PDFForm['status']) => handleStatusChange(value)}
                disabled={isStatusChanging}
            >
                <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </div>

      <div className="flex-grow min-h-0">
        <FieldMapper
            pdf={pdf}
            fields={fields}
            setFields={setFields}
            password={password}
            setPassword={setPassword}
            passwordProtected={passwordProtected}
            setPasswordProtected={setPasswordProtected}
            onSave={handleSave}
            isSaving={isSaving}
            onPreview={() => setIsPreviewOpen(true)}
        />
      </div>

      <PdfPreviewDialog
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        pdfForm={{ ...pdf, fields: fields, password, passwordProtected }}
      />
    </div>
  );
}
