'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Upload, Library, FileText, Sparkles, Loader2, CheckCircle2, ShieldCheck, 
  Layers, FileCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { createPdfForm, createStarterPdfForm } from '@/lib/pdf-actions';
import PdfUploader from '../components/PdfUploader';
import MediaSelectorDialog from '@/app/admin/media/components/media-selector-dialog';
import type { MediaAsset } from '@/lib/types';

/**
 * Client component for initializing and onboarding new PDF signing documents.
 * Replaces the missing static route that previously caused 'Document not found' (404)
 * when navigating to /admin/pdfs/new.
 *
 * Caution: All mutations require at least one active workspace ID and an authenticated user.
 */
export default function NewPdfClient() {
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();
  const { activeWorkspaceId, allowedWorkspaces } = useWorkspace();

  const [documentTitle, setDocumentTitle] = React.useState('');
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = React.useState<string[]>(
    activeWorkspaceId ? [activeWorkspaceId] : []
  );
  const [isContractDocument, setIsContractDocument] = React.useState(true);
  const [selectedAsset, setSelectedAsset] = React.useState<MediaAsset | null>(null);
  const [isMediaDialogOpen, setIsMediaDialogOpen] = React.useState(false);
  const [isCreatingFromMedia, setIsCreatingFromMedia] = React.useState(false);
  const [isCreatingStarter, setIsCreatingStarter] = React.useState(false);

  // Sync workspace if selection was initially empty and activeWorkspaceId becomes available
  React.useEffect(() => {
    if (selectedWorkspaceIds.length === 0 && activeWorkspaceId) {
      setSelectedWorkspaceIds([activeWorkspaceId]);
    }
  }, [activeWorkspaceId, selectedWorkspaceIds.length]);

  const workspaceOptions: MultiSelectOption[] = React.useMemo(() => {
    return allowedWorkspaces.map((w) => ({
      label: w.name,
      value: w.id,
    }));
  }, [allowedWorkspaces]);

  const effectiveWorkspaceIds = selectedWorkspaceIds.length > 0 
    ? selectedWorkspaceIds 
    : (activeWorkspaceId ? [activeWorkspaceId] : []);

  const handleUploadSuccess = (newPdfId: string) => {
    toast({
      title: 'Template Created',
      description: 'Your document is ready. Opening Design Studio...',
    });
    router.push(`/admin/pdfs/${newPdfId}/edit`);
  };

  const handleMediaSelect = (asset: MediaAsset) => {
    setSelectedAsset(asset);
    setIsMediaDialogOpen(false);
    if (!documentTitle.trim()) {
      setDocumentTitle(asset.name.replace(/\.pdf$/i, ''));
    }
  };

  const handleCreateFromMedia = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Authentication Required', description: 'Please sign in to proceed.' });
      return;
    }

    if (!selectedAsset) {
      toast({ variant: 'destructive', title: 'File Missing', description: 'Please select a document from the media library.' });
      return;
    }

    if (effectiveWorkspaceIds.length === 0) {
      toast({ variant: 'destructive', title: 'Workspace Required', description: 'Please associate at least one workspace.' });
      return;
    }

    setIsCreatingFromMedia(true);
    try {
      const finalTitle = documentTitle.trim() || selectedAsset.name.replace(/\.pdf$/i, '');
      const result = await createPdfForm(
        {
          name: finalTitle,
          originalFileName: selectedAsset.name,
          storagePath: selectedAsset.fullPath || '',
          downloadUrl: selectedAsset.url,
          isContractDocument,
        },
        user.uid,
        effectiveWorkspaceIds
      );

      if (result.success && result.id) {
        toast({
          title: 'Document Initialized',
          description: `"${finalTitle}" added from media library. Opening Studio...`,
        });
        router.push(`/admin/pdfs/${result.id}/edit`);
      } else {
        toast({
          variant: 'destructive',
          title: 'Initialization Failed',
          description: result.error || 'Failed to create document record.',
        });
      }
    } catch (error: unknown) {
      console.error('[NewPdfClient] Failed to create from media:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred while linking media asset.',
      });
    } finally {
      setIsCreatingFromMedia(false);
    }
  };

  const handleCreateStarterBlueprint = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Authentication Required', description: 'Please sign in to proceed.' });
      return;
    }

    if (effectiveWorkspaceIds.length === 0) {
      toast({ variant: 'destructive', title: 'Workspace Required', description: 'Please associate at least one workspace.' });
      return;
    }

    setIsCreatingStarter(true);
    try {
      const finalTitle = documentTitle.trim() || 'Standard Agreement Blueprint';
      const result = await createStarterPdfForm({
        name: finalTitle,
        workspaceIds: effectiveWorkspaceIds,
        isContractDocument,
        userId: user.uid,
      });

      if (result.success && result.id) {
        toast({
          title: 'Blueprint Created',
          description: `"${finalTitle}" generated. Opening Design Studio...`,
        });
        router.push(`/admin/pdfs/${result.id}/edit`);
      } else {
        toast({
          variant: 'destructive',
          title: 'Generation Failed',
          description: result.error || 'Failed to create starter blueprint.',
        });
      }
    } catch (error: unknown) {
      console.error('[NewPdfClient] Failed to generate starter:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred while generating starter blueprint.',
      });
    } finally {
      setIsCreatingStarter(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto w-full bg-background">
      <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-8 pb-32">
        {/* Navigation Breadcrumb & Back */}
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="rounded-xl min-h-[44px] px-3 font-semibold text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all"
          >
            <Link href="/admin/pdfs">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Doc Signing Studio
            </Link>
          </Button>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              Document Onboarding
            </span>
          </div>
        </div>

        {/* Hero Header */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Create Signing Document
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Upload an agreement PDF, select an asset from your library, or start from a clean institutional blueprint. You can map interactive fields and signature zones on the next step.
          </p>
        </div>

        {/* Global Configuration Card */}
        <Card className="rounded-2xl border border-border bg-card shadow-xs">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Document Configuration
            </CardTitle>
            <CardDescription className="text-xs">
              Set default naming and hub associations for this document template.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Document Title */}
              <div className="space-y-2">
                <Label htmlFor="doc-title" className="text-xs font-semibold text-foreground">
                  Document Title (Optional)
                </Label>
                <Input
                  id="doc-title"
                  placeholder="e.g. Master Service Agreement 2026"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  className="rounded-xl min-h-[44px] text-base sm:text-sm bg-background border-border"
                />
                <p className="text-[11px] text-muted-foreground">
                  Leave blank to automatically use the uploaded file name.
                </p>
              </div>

              {/* Workspace Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">
                  Associated Workspaces
                </Label>
                <MultiSelect
                  options={workspaceOptions}
                  value={selectedWorkspaceIds}
                  onChange={setSelectedWorkspaceIds}
                  placeholder="Select workspaces..."
                  className="min-h-[44px] rounded-xl text-base sm:text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Controls which institutional workspaces have access to this document.
                </p>
              </div>
            </div>

            {/* Is Institutional Contract Switch */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-border/70 bg-muted/20">
              <div className="space-y-0.5 pr-4">
                <Label htmlFor="is-contract-switch" className="text-xs font-bold text-foreground cursor-pointer">
                  Institutional Legal Agreement
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Enables CRM Deal contract synchronization, multi-party signer routing, and cryptographic audit certificates.
                </p>
              </div>
              <Switch
                id="is-contract-switch"
                checked={isContractDocument}
                onCheckedChange={setIsContractDocument}
              />
            </div>
          </CardContent>
        </Card>

        {/* Creation Mode Tabs */}
        <Tabs defaultValue="upload" className="w-full space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-xl mx-auto h-12 p-1 rounded-2xl bg-muted/40 border border-border/60">
            <TabsTrigger
              value="upload"
              className="rounded-xl text-xs font-semibold min-h-[40px] data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs active:scale-[0.98] transition-all"
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Upload PDF
            </TabsTrigger>
            <TabsTrigger
              value="media"
              className="rounded-xl text-xs font-semibold min-h-[40px] data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs active:scale-[0.98] transition-all"
            >
              <Library className="w-4 h-4 mr-1.5" />
              Media Library
            </TabsTrigger>
            <TabsTrigger
              value="starter"
              className="rounded-xl text-xs font-semibold min-h-[40px] data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs active:scale-[0.98] transition-all"
            >
              <Sparkles className="w-4 h-4 mr-1.5 text-amber-500" />
              Starter Blueprint
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: UPLOAD FROM DEVICE */}
          <TabsContent value="upload" className="outline-none focus:outline-none">
            <Card className="rounded-2xl border border-border bg-card shadow-xs">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Upload className="w-4 h-4 text-primary" />
                  Upload PDF from Device
                </CardTitle>
                <CardDescription className="text-xs">
                  Drag and drop a PDF agreement (up to 10MB). Text and vector coordinates will be preserved.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <PdfUploader
                  onUploadSuccess={handleUploadSuccess}
                  workspaceIds={effectiveWorkspaceIds}
                  customName={documentTitle}
                  isContractDocument={isContractDocument}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: SELECT FROM MEDIA LIBRARY */}
          <TabsContent value="media" className="outline-none focus:outline-none">
            <Card className="rounded-2xl border border-border bg-card shadow-xs">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Library className="w-4 h-4 text-primary" />
                  Select from Media Assets
                </CardTitle>
                <CardDescription className="text-xs">
                  Choose an existing PDF document stored in your institutional workspace media vault.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-2">
                {!selectedAsset ? (
                  <div
                    onClick={() => setIsMediaDialogOpen(true)}
                    className="border-2 border-dashed border-border/80 hover:border-primary/50 hover:bg-muted/30 transition-all rounded-2xl p-8 sm:p-12 text-center cursor-pointer space-y-3 group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                      <Library className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-foreground">Click to Browse Media Vault</p>
                      <p className="text-xs text-muted-foreground">
                        Select any PDF document previously uploaded across your organization.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl min-h-[44px] px-5 font-semibold text-xs active:scale-[0.97]"
                    >
                      Browse Files
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-secondary/30">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <FileCheck className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">
                            {selectedAsset.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {selectedAsset.size ? `${Math.round(selectedAsset.size / 1024)} KB` : 'PDF Document'}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsMediaDialogOpen(true)}
                        className="rounded-xl min-h-[44px] text-xs font-semibold active:scale-[0.97]"
                      >
                        Change Asset
                      </Button>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        type="button"
                        onClick={handleCreateFromMedia}
                        disabled={isCreatingFromMedia}
                        className="w-full sm:w-auto min-h-[44px] px-6 rounded-xl font-bold shadow-md active:scale-[0.97] transition-all"
                      >
                        {isCreatingFromMedia ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Initializing Document...
                          </>
                        ) : (
                          <>
                            <FileText className="mr-2 h-4 w-4" />
                            Open Design Studio
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: STARTER BLUEPRINT */}
          <TabsContent value="starter" className="outline-none focus:outline-none">
            <Card className="rounded-2xl border border-border bg-card shadow-xs">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Instant Agreement Blueprint
                </CardTitle>
                <CardDescription className="text-xs">
                  Generate a clean 1-page institutional agreement template instantly without needing a pre-existing file.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-bold text-foreground">Standard Recitals</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Pre-formatted institutional clauses covering recitals, terms, and covenants.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-bold text-foreground">Dual Execution Boxes</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Clear signature and date lines mapped for Primary Signer and Countersigner.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-bold text-foreground">High-Resolution Vector</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Crisp A4 vector layout rendered directly on the server with pdf-lib.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    onClick={handleCreateStarterBlueprint}
                    disabled={isCreatingStarter}
                    className="w-full sm:w-auto min-h-[44px] px-6 rounded-xl font-bold shadow-md active:scale-[0.97] transition-all bg-primary text-primary-foreground"
                  >
                    {isCreatingStarter ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Blueprint...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate & Open Design Studio
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Media Selector Dialog */}
      <MediaSelectorDialog
        open={isMediaDialogOpen}
        onOpenChange={setIsMediaDialogOpen}
        onSelectAsset={handleMediaSelect}
        filterType="document"
        title="Select Agreement PDF"
        description="Choose a PDF file from your workspace repository to create a signing template."
      />
    </div>
  );
}
