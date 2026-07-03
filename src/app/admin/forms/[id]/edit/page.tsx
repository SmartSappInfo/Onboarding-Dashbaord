'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, collection, query, where, orderBy, updateDoc, addDoc } from 'firebase/firestore';
import { useDoc, useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import type { Form, FormFieldInstance, AppField, FieldGroup, FormThemeConfig, FormSubmissionActions, SeoConfig, UserProfile } from '@/lib/types';
import { SeoSettingsCard } from '@/components/seo/SeoSettingsCard';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import CreateQRButton from '@/components/qr-studio/create-qr-button';
import { FormNotificationSettings } from '../../components/form-notification-settings';
import SaveStatusIndicator, { type SaveStatus } from './components/SaveStatusIndicator';
import { updateFormAction } from '@/lib/forms-actions';
import { useFormHistory } from '@/hooks/use-form-history';
import FieldsSidebar, { SYSTEM_CONSTANT_FIELDS } from './components/FieldsSidebar';
import PropertiesSidebar from './components/PropertiesSidebar';
import { MultiSelect } from '@/components/ui/multi-select';
import { createTagAction } from '@/lib/tag-actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PlusCircle, Search as SearchIcon, Tags, ZapOff, Trash2, Globe, AlertCircle, RotateCcw, Users } from 'lucide-react';
import BuilderCanvas from './components/BuilderCanvas';
import ViewportToggle, { type ViewportSize } from './components/ViewportToggle';
import ShareEmbedDialog from '@/components/share-embed-dialog';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Save,
  Loader2,
  Settings2,
  Layout,
  Zap,
  Share2,
  Copy,
  ExternalLink,
  Code,
  Eye,
  Undo2,
  Redo2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// ────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────

const THEME_PRESETS: { value: FormThemeConfig['preset']; label: string; desc: string }[] = [
  { value: 'minimal', label: 'Minimal', desc: 'Clean and borderless' },
  { value: 'professional', label: 'Professional', desc: 'Subtle borders and spacing' },
  { value: 'card', label: 'Card', desc: 'Elevated card container' },
  { value: 'embedded', label: 'Embedded', desc: 'Transparent, inline-friendly' },
];

// ────────────────────────────────────────────
// Stepper Component
// ────────────────────────────────────────────

function Stepper({ currentStep, onStepClick }: { currentStep: number; onStepClick: (s: number) => void }) {
  const steps = [
    { n: 1, label: 'Details', icon: Settings2 },
    { n: 2, label: 'Builder', icon: Layout },
    { n: 3, label: 'Actions', icon: Zap },
    { n: 4, label: 'Share', icon: Share2 },
  ];

  return (
    <div className="flex justify-center items-center mb-12 max-w-2xl mx-auto px-4">
      {steps.map((step, index) => {
        const isActive = currentStep === step.n;
        const isCompleted = currentStep > step.n;
        const Icon = step.icon;

        return (
          <React.Fragment key={step.label}>
            <button type="button" onClick={() => onStepClick(step.n)} className="flex flex-col items-center group outline-none">
              <div className={cn(
                'flex items-center justify-center w-9 h-9 rounded-2xl border-2 transition-all duration-300 shadow-sm',
                isCompleted ? 'bg-primary border-primary text-white' :
                isActive ? 'bg-primary/10 border-primary text-primary shadow-lg shadow-primary/10' :
                'bg-background border-border text-muted-foreground',
              )}>
                {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-5 h-5" />}
              </div>
              <p className={cn(
                'mt-3 text-[10px] font-semibold uppercase transition-colors',
                isActive || isCompleted ? 'text-primary' : 'text-muted-foreground opacity-60 group-hover:opacity-100'
              )}>
                {step.label}
              </p>
            </button>
            {index < steps.length - 1 && (
              <div className="flex-1 mx-4 h-[2px] bg-muted rounded-full overflow-hidden relative">
                <motion.div
                  initial={false}
                  animate={{ width: isCompleted ? '100%' : '0%' }}
                  className="absolute inset-0 bg-primary"
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}



// ────────────────────────────────────────────
// Main Editor Component
// ────────────────────────────────────────────

export default function EditFormPage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const formId = params.id as string;
  const { toast } = useToast();
  const { activeWorkspaceId, activeOrganizationId, allowedWorkspaces = [] } = useTenant();
  const { user } = useUser();

  // State
  const [step, setStep] = React.useState(1);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('idle');
  const [hasInitialized, setHasInitialized] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);
  const [selectedFieldId, setSelectedFieldId] = React.useState<string | null>(null);
  const [viewportSize, setViewportSize] = React.useState<ViewportSize>('desktop');
  const [sandboxMode, setSandboxMode] = React.useState<'edit' | 'sandbox'>('edit');
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const revisionRef = React.useRef<number>(0);
  const lastSavedRevisionRef = React.useRef<number>(0);
  const [isPendingSave, startSaveTransition] = React.useTransition();
  const [isShareOpen, setIsShareOpen] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Form document history state tracker (enabling Undo/Redo)
  const {
    state: formData,
    update: setFormData,
    undo,
    redo,
    reset: resetFormHistory,
    canUndo,
    canRedo,
  } = useFormHistory<Partial<Form>>({});

  // Firestore subscriptions
  const formDocRef = useMemoFirebase(() => {
    if (!firestore || !formId) return null;
    return doc(firestore, 'forms', formId);
  }, [firestore, formId]);

  const { data: formDoc, isLoading: isFormLoading } = useDoc<Form>(formDocRef);

  // Available fields from registry
  const availableFieldsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'app_fields'),
      where('workspaceId', '==', activeWorkspaceId),
      where('status', '==', 'active'),
      orderBy('section', 'asc')
    );
  }, [firestore, activeWorkspaceId]);

  const { data: availableFields } = useCollection<AppField>(availableFieldsQuery);

  // Tags Query
  const tagsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'tags'), where('workspaceId', '==', activeWorkspaceId), orderBy('name', 'asc'));
  }, [firestore, activeWorkspaceId]);
  const { data: workspaceTags } = useCollection<any>(tagsQuery);

  // Webhooks Query
  const webhooksQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(collection(firestore, 'webhooks'), where('workspaceId', '==', activeWorkspaceId), orderBy('name', 'asc'));
  }, [firestore, activeWorkspaceId]);
  const { data: workspaceWebhooks } = useCollection<any>(webhooksQuery);

  // Users Query for Leads Assignment
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !activeOrganizationId) return null;
    return query(
      collection(firestore, 'users'), 
      where('organizationId', '==', activeOrganizationId),
      where('isAuthorized', '==', true), 
      orderBy('name', 'asc')
    );
  }, [firestore, activeOrganizationId]);
  const { data: users } = useCollection<UserProfile>(usersQuery);

  const userOptions = React.useMemo(() => 
    users?.map(u => ({ label: u.name || u.email, value: u.id })) || [], 
  [users]);

  // Dialog & Form states for dynamic tag and webhook creation
  const [isTagDialogOpen, setIsTagDialogOpen] = React.useState(false);
  const [newTagName, setNewTagName] = React.useState('');
  const [isTagSaving, setIsTagSaving] = React.useState(false);

  const [isWebhookDialogOpen, setIsWebhookDialogOpen] = React.useState(false);
  const [newWebhookName, setNewWebhookName] = React.useState('');
  const [newWebhookUrl, setNewWebhookUrl] = React.useState('');
  const [isWebhookSaving, setIsWebhookSaving] = React.useState(false);

  // Action handlers
  const handleCreateTag = async () => {
    if (!user || !activeWorkspaceId || !newTagName.trim() || !firestore) return;
    
    // Check locally if a tag with the same name already exists
    const trimmedTagName = newTagName.trim();
    const existingTag = workspaceTags?.find(
      (t: any) => t.name.toLowerCase() === trimmedTagName.toLowerCase()
    );

    if (existingTag) {
      toast({ 
        title: 'Tag Auto-Selected', 
        description: `Tag "${existingTag.name}" already exists and has been selected.` 
      });
      setIsTagDialogOpen(false);
      setNewTagName('');
      
      const currentActions = (formData.actions || {}) as FormSubmissionActions;
      const currentTags = currentActions.tags || [];
      if (!currentTags.includes(existingTag.id)) {
        updateField('actions', {
          ...currentActions,
          tags: [...currentTags, existingTag.id]
        });
      }
      return;
    }

    setIsTagSaving(true);
    try {
      const res = await createTagAction({
        workspaceId: activeWorkspaceId,
        organizationId: activeOrganizationId || '',
        name: trimmedTagName,
        category: 'custom',
        color: '#3B82F6',
        userId: user?.uid || '',
        userName: user?.displayName || 'System'
      });
      if (res.success && res.data) {
        toast({ title: 'Tag Created', description: `Tag "${trimmedTagName}" added to registry.` });
        setIsTagDialogOpen(false);
        setNewTagName('');
        
        // Auto-select the newly created tag
        const currentActions = (formData.actions || {}) as FormSubmissionActions;
        const currentTags = currentActions.tags || [];
        updateField('actions', {
          ...currentActions,
          tags: [...currentTags, res.data.id]
        });
      } else {
        toast({ variant: 'destructive', title: 'Action Failed', description: res.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsTagSaving(false);
    }
  };

  const handleCreateWebhook = async () => {
    if (!firestore || !user || !activeWorkspaceId || !newWebhookName.trim() || !newWebhookUrl.trim()) return;
    setIsWebhookSaving(true);
    try {
      const data = {
        name: newWebhookName.trim(),
        url: newWebhookUrl.trim(),
        workspaceId: activeWorkspaceId,
        type: 'outbound',
        status: 'active',
        trigger: 'FORM_SUBMITTED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user.uid
      };
      const docRef = await addDoc(collection(firestore, 'webhooks'), data);
      toast({ title: 'Webhook Saved', description: 'The new endpoint is now available in your library.' });
      setIsWebhookDialogOpen(false);
      setNewWebhookName('');
      setNewWebhookUrl('');
      
      // Auto-select the newly created webhook ID
      const currentActions = (formData.actions || {}) as FormSubmissionActions;
      const currentWebhooks = currentActions.webhooks || [];
      updateField('actions', {
        ...currentActions,
        webhooks: [...currentWebhooks, docRef.id]
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error Saving Webhook', description: e.message });
    } finally {
      setIsWebhookSaving(false);
    }
  };

  // Field Groups
  const fieldGroupsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'field_groups'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('order', 'asc')
    );
  }, [firestore, activeWorkspaceId]);

  const { data: fieldGroups } = useCollection<FieldGroup>(fieldGroupsQuery);

  // Initialize from Firestore
  React.useEffect(() => {
    if (formDoc && !hasInitialized) {
      resetFormHistory(formDoc);
      revisionRef.current = 0;
      lastSavedRevisionRef.current = 0;
      setHasInitialized(true);
    }
  }, [formDoc, hasInitialized, resetFormHistory]);

  // Keyboard listeners for Undo/Redo shortcuts (Ctrl+Z / Meta+Z, Ctrl+Shift+Z / Meta+Shift+Z)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isInput) return;

      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Debounced autosave with revision tracking — fires 2 seconds after any formData change
  React.useEffect(() => {
    if (!hasInitialized) return;

    // Increment revision because formData changed
    revisionRef.current += 1;

    if (revisionRef.current === lastSavedRevisionRef.current) return; // Not dirty

    setSaveStatus('dirty');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      startSaveTransition(async () => {
        setSaveStatus('saving');
        const uid = user?.uid;
        if (!uid || !formId) { setSaveStatus('error'); return; }
        
        const expectedVersion = formData.version;
        const currentSavingRevision = revisionRef.current;
        const res = await updateFormAction(formId, formData as Partial<Form>, uid, expectedVersion);
        
        if (res.conflict) {
          setSaveStatus('conflict');
          toast({
            variant: 'destructive',
            title: 'Version Conflict Detected',
            description: 'Another user has edited this form. Please refresh to load the latest changes and avoid overwriting them.',
          });
        } else if (res.success) {
          const nextVersion = res.version !== undefined ? res.version : (expectedVersion || 0) + 1;
          const updatedFormData = { ...formData, version: nextVersion };
          
          // Sync revision numbers. The setFormData(updatedFormData) below will trigger this useEffect next.
          // Setting lastSavedRevisionRef to currentSavingRevision + 1 pre-matches the increment that will happen in that render.
          lastSavedRevisionRef.current = currentSavingRevision + 1;
          
          setFormData(updatedFormData);
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 3000);
        } else {
          setSaveStatus('error');
          toast({
            variant: 'destructive',
            title: 'Autosave Failed',
            description: res.error || 'Could not autosave changes.',
          });
        }
      });
    }, 2000);

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [formData, hasInitialized]);

  // Tab exit guard to warn users of unsaved changes
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === 'dirty' || saveStatus === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus]);

  // Helpers
  const updateFields = (updates: Partial<Form>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const updateField = <K extends keyof Form>(key: K, value: Form[K]) => {
    updateFields({ [key]: value });
  };

  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 60);

  // Save handler
  const handleSave = async () => {
    if (!firestore || !formId) return;
    setIsSaving(true);
    try {
      const ref = doc(firestore, 'forms', formId);
      await updateDoc(ref, {
        ...formData,
        updatedAt: new Date().toISOString(),
      });
      toast({ title: '✓ Changes Saved', description: 'Form updated successfully.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save form changes.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!firestore || !formId) return;
    setIsSaving(true);
    try {
      const ref = doc(firestore, 'forms', formId);
      await updateDoc(ref, {
        ...formData,
        status: 'published',
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      toast({ title: '🚀 Form Published!', description: 'Your form is now live.' });
      router.push('/admin/forms');
    } catch (err) {
      toast({ variant: 'destructive', title: 'Publish Failed' });
    } finally {
      setIsSaving(false);
    }
  };

  // Navigation
  const handleStepChange = (target: number) => {
    if (target === step) return;
    setStep(target);
  };

  // ────────────────────────────────────────
  // Field Management (Step 2)
  // ────────────────────────────────────────

  const fields = (formData.fields || []) as FormFieldInstance[];

  const addFieldFromRegistry = (appField: AppField) => {
    const newInstance: FormFieldInstance = {
      id: `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      appFieldId: appField.id,
      required: appField.validationRules?.required || false,
      hidden: false,
      order: fields.length,
      width: 'full',
    };
    updateField('fields', [...fields, newInstance]);
  };

  const addStandardFieldByType = (type: string) => {
    const found = availableFields?.find(f => f.type === type);
    if (found) {
      addFieldFromRegistry(found);
    } else {
      toast({
        variant: 'destructive',
        title: 'Field Type Not Found',
        description: `No field of type ${type} is available in your blueprints.`,
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();

    // 1. Sidebar dragging drop resolution
    if (activeId.startsWith('sidebar-')) {
      const fieldId = activeId.replace('sidebar-', '');
      const appField = fieldId.startsWith('sc_')
        ? SYSTEM_CONSTANT_FIELDS.find(f => f.id === fieldId)
        : availableFields?.find(f => f.id === fieldId);
      if (!appField) return;

      let insertIndex = fields.length;
      if (overId !== 'canvas-empty-dropzone') {
        const targetIndex = fields.findIndex(f => f.id === overId);
        if (targetIndex >= 0) {
          insertIndex = targetIndex;
        }
      }

      const newInstance: FormFieldInstance = {
        id: `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        appFieldId: appField.id,
        required: appField.validationRules?.required || false,
        hidden: false,
        order: insertIndex,
        width: 'full',
      };

      const newFields = [...fields];
      newFields.splice(insertIndex, 0, newInstance);
      
      const orderedFields = newFields.map((f, i) => ({ ...f, order: i }));
      updateField('fields', orderedFields);
      setSelectedFieldId(newInstance.id);
      return;
    }

    // 2. Existing canvas field item reordering
    if (activeId === overId) return;

    const oldIndex = fields.findIndex(f => f.id === activeId);
    const newIndex = fields.findIndex(f => f.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(fields, oldIndex, newIndex);
    updateField('fields', reordered.map((f, i) => ({ ...f, order: i })));
  };

  const removeField = (instanceId: string) => {
    updateField('fields', fields.filter(f => f.id !== instanceId).map((f, i) => ({ ...f, order: i })));
  };

  const moveField = (instanceId: string, direction: 'up' | 'down') => {
    const idx = fields.findIndex(f => f.id === instanceId);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= fields.length) return;
    const newFields = [...fields];
    [newFields[idx], newFields[newIdx]] = [newFields[newIdx], newFields[idx]];
    updateField('fields', newFields.map((f, i) => ({ ...f, order: i })));
  };

  const updateFieldInstance = (instanceId: string, updates: Partial<FormFieldInstance>) => {
    updateField('fields', fields.map(f => f.id === instanceId ? { ...f, ...updates } : f));
  };

  const getAppField = (appFieldId: string) => {
    if (appFieldId?.startsWith('sc_')) {
      return SYSTEM_CONSTANT_FIELDS.find(f => f.id === appFieldId);
    }
    return availableFields?.find(f => f.id === appFieldId);
  };

  const formFieldOptions = React.useMemo(() => {
    return fields.map(f => {
      const appField = getAppField(f.appFieldId);
      return {
        label: f.labelOverride || appField?.label || f.id,
        value: appField?.variableName || f.id,
        type: appField?.type || 'short_text'
      };
    });
  }, [fields, availableFields]);

  // ────────────────────────────────────────
  // Render
  // ────────────────────────────────────────

  if (isFormLoading || !hasInitialized) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b px-8 h-16 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 text-left">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => router.push('/admin/forms')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-semibold text-sm tracking-tight leading-none mb-1 truncate max-w-[200px]">
              {formData.internalName || 'Untitled Form'}
            </h1>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[8px] h-4 font-semibold uppercase border-primary/20 text-primary bg-primary/5">
                Form Studio
              </Badge>
              <Badge variant={formData.status === 'published' ? 'default' : 'secondary'} className="text-[8px] h-4 font-semibold uppercase">
                {formData.status}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SaveStatusIndicator status={saveStatus} />

          <div className="flex items-center gap-1 border-r pr-3 border-border/60">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg"
              onClick={undo}
              disabled={!canUndo}
              title="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg"
              onClick={redo}
              disabled={!canRedo}
              title="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>

          <Button
            disabled={isSaving || isPendingSave || saveStatus === 'saving'}
            onClick={handleSave}
            variant="outline"
            className="rounded-xl font-semibold gap-2 px-5 h-10 text-[10px] active:scale-95 transition-all"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className={cn("flex-1", step === 2 ? "flex flex-col min-h-0 overflow-hidden" : "overflow-y-auto")}>
        <div className={cn(step === 2 ? "flex-1 flex flex-col min-h-0 w-full" : "max-w-5xl mx-auto py-8 px-4 p-8")}>
          {step !== 2 && <Stepper currentStep={step} onStepClick={handleStepChange} />}

          <AnimatePresence mode="wait">
            {/* ── Step 1: Details ── */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column */}
                  <div className="space-y-6">
                    <Card className="rounded-2xl border border-border shadow-sm bg-card">
                      <CardHeader>
                        <CardTitle className="text-base font-semibold">Form Identity</CardTitle>
                        <CardDescription className="text-xs">Basic information about your form.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="space-y-2 text-left">
                          <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Internal Name *</Label>
                          <Input
                            value={formData.internalName || ''}
                            onChange={e => {
                              const val = e.target.value;
                              updateFields({
                                internalName: val,
                                slug: slugify(val),
                              });
                            }}
                            placeholder="e.g. Parent Enrollment Form"
                            className="h-11 rounded-xl bg-background border border-border shadow-sm focus:ring-1 focus:ring-primary/20 transition-all"
                          />
                        </div>
                        <div className="space-y-2 text-left">
                          <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Public Title</Label>
                          <Input
                            value={formData.title || ''}
                            onChange={e => updateField('title', e.target.value)}
                            placeholder="e.g. Enrollment Application"
                            className="h-11 rounded-xl bg-background border border-border shadow-sm focus:ring-1 focus:ring-primary/20 transition-all"
                          />
                        </div>
                        <div className="space-y-2 text-left">
                          <Label className="text-[10px] font-semibold text-muted-foreground ml-1">URL Slug</Label>
                          <div className="flex h-11 border border-border/50 rounded-xl overflow-hidden bg-background/50">
                            <div className="bg-muted px-3 flex items-center text-[10px] font-semibold text-muted-foreground/60 border-r">/p/f/</div>
                            <Input
                              value={formData.slug || ''}
                              onChange={e => updateField('slug', slugify(e.target.value))}
                              className="border-none rounded-none shadow-none focus-visible:ring-0 bg-transparent font-mono font-semibold"
                            />
                          </div>
                        </div>
                        <div className="space-y-2 text-left">
                          <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Description</Label>
                          <Textarea
                            value={formData.description || ''}
                            onChange={e => updateField('description', e.target.value)}
                            placeholder="Brief description shown to respondents..."
                            className="rounded-xl min-h-[60px] resize-none bg-background border border-border shadow-sm focus:ring-1 focus:ring-primary/20 transition-all"
                            rows={2}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border border-border shadow-sm bg-card">
                      <CardHeader>
                        <CardTitle className="text-base font-semibold">Form Type</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 text-left">
                        <Select value={formData.formType || 'global'} onValueChange={v => updateField('formType', v as Form['formType'])}>
                          <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="global">Global (standalone form)</SelectItem>
                            <SelectItem value="bound">Bound (linked to an entity)</SelectItem>
                          </SelectContent>
                        </Select>
                        {formData.formType === 'bound' && (
                          <Select value={formData.contactScope || 'institution'} onValueChange={v => updateField('contactScope', v as Form['contactScope'])}>
                            <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="institution">Institution</SelectItem>
                              <SelectItem value="family">Family</SelectItem>
                              <SelectItem value="person">Person</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Right Column: Theme */}
                  <div className="space-y-6">
                    <Card className="rounded-2xl border border-border shadow-sm bg-card">
                      <CardHeader>
                        <CardTitle className="text-base font-semibold">Theme & Style</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-5 text-left">
                        <div className="grid grid-cols-2 gap-3">
                          {THEME_PRESETS.map(preset => (
                            <button
                              key={preset.value}
                              type="button"
                              onClick={() => updateField('theme', { ...formData.theme!, preset: preset.value })}
                              className={cn(
                                'p-4 rounded-xl border-2 text-left transition-all hover:shadow-md bg-card',
                                formData.theme?.preset === preset.value
                                  ? 'border-primary bg-primary/5 shadow-md'
                                  : 'border-border/30 hover:border-primary/30'
                              )}
                            >
                              <p className="text-sm font-bold">{preset.label}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{preset.desc}</p>
                            </button>
                          ))}
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Card Width</Label>
                            <Select value={formData.theme?.cardWidth || 'md'} onValueChange={v => updateField('theme', { ...formData.theme!, cardWidth: v as any })}>
                              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="sm">Small (480px)</SelectItem>
                                <SelectItem value="md">Medium (640px)</SelectItem>
                                <SelectItem value="lg">Large (800px)</SelectItem>
                                <SelectItem value="full">Full Width</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Input Style</Label>
                            <Select value={formData.theme?.inputStyle || 'outline'} onValueChange={v => updateField('theme', { ...formData.theme!, inputStyle: v as any })}>
                              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="outline">Outline</SelectItem>
                                <SelectItem value="filled">Filled</SelectItem>
                                <SelectItem value="flushed">Flushed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">CTA Label</Label>
                            <Input
                              value={formData.theme?.ctaLabel || 'Submit'}
                              onChange={e => updateField('theme', { ...formData.theme!, ctaLabel: e.target.value })}
                              className="h-11 rounded-xl bg-muted/20 border-none"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-semibold text-muted-foreground ml-1">CTA Width</Label>
                            <Select value={formData.theme?.ctaWidth || 'full'} onValueChange={v => updateField('theme', { ...formData.theme!, ctaWidth: v as any })}>
                              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="auto">Auto</SelectItem>
                                <SelectItem value="full">Full Width</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Accent Color</Label>
                          <div className="flex gap-3">
                            <Input
                              type="color"
                              value={formData.theme?.accentColor || '#3b82f6'}
                              onChange={e => updateField('theme', { ...formData.theme!, accentColor: e.target.value })}
                              className="w-12 h-11 p-1 rounded-xl bg-muted/20 border-none cursor-pointer"
                            />
                            <Input
                              value={formData.theme?.accentColor || '#3b82f6'}
                              onChange={e => updateField('theme', { ...formData.theme!, accentColor: e.target.value })}
                              placeholder="#3b82f6"
                              className="flex-1 h-11 rounded-xl bg-muted/20 border-none font-mono"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Success Behavior */}
                    <Card className="rounded-2xl border border-border shadow-sm bg-card">
                      <CardHeader>
                        <CardTitle className="text-base font-semibold">After Submission</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 text-left">
                        <Select
                          value={formData.successBehavior?.type || 'message'}
                          onValueChange={v => updateField('successBehavior', { type: v as any, value: formData.successBehavior?.value || '' })}
                        >
                          <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="message">Show Thank You Message</SelectItem>
                            <SelectItem value="redirect">Redirect to URL</SelectItem>
                          </SelectContent>
                        </Select>
                        {formData.successBehavior?.type === 'message' ? (
                          <Textarea
                            value={formData.successBehavior?.value || ''}
                            onChange={e => updateField('successBehavior', { ...formData.successBehavior!, value: e.target.value })}
                            placeholder="Thank you for your submission!"
                            className="rounded-xl min-h-[60px] resize-none bg-muted/20 border-none"
                          />
                        ) : (
                          <Input
                            value={formData.successBehavior?.value || ''}
                            onChange={e => updateField('successBehavior', { ...formData.successBehavior!, value: e.target.value })}
                            placeholder="https://example.com/thank-you"
                            className="h-11 rounded-xl bg-muted/20 border-none"
                          />
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Builder Canvas ── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="flex-1 flex flex-col min-h-0 bg-background"
              >
                {/* Viewport & Options Toolbar */}
                <div className="h-12 border-b bg-card/20 px-8 flex items-center justify-between shrink-0 select-none">
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Device Viewport Simulation:
                    </span>
                    <ViewportToggle currentSize={viewportSize} onChange={setViewportSize} />
                  </div>

                  {/* Mode Selector (Edit vs Sandbox) */}
                  <div className="flex items-center bg-muted/40 p-1 rounded-xl h-9 border border-border/10">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSandboxMode('edit')}
                      className={cn(
                        "h-7 rounded-lg px-3 text-[10px] uppercase font-bold tracking-wider transition-all",
                        sandboxMode === 'edit' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Edit Mode
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSandboxMode('sandbox')}
                      className={cn(
                        "h-7 rounded-lg px-3 text-[10px] uppercase font-bold tracking-wider transition-all",
                        sandboxMode === 'sandbox' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Sandbox Mode
                    </Button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {sandboxMode === 'edit' && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          onClick={undo}
                          disabled={!canUndo}
                          title="Undo"
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          onClick={redo}
                          disabled={!canRedo}
                          title="Redo"
                        >
                          <Redo2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <div className="flex-1 flex min-h-0 overflow-hidden">
                    {/* Left Sidebar: Fields Registry */}
                    {sandboxMode === 'edit' && (
                      <FieldsSidebar
                        availableFields={availableFields || undefined}
                        fieldGroups={fieldGroups || undefined}
                        addedFields={fields}
                        formType={formData.formType || 'global'}
                        contactScope={formData.contactScope}
                        onAddField={addFieldFromRegistry}
                      />
                    )}

                    {/* Center Canvas: Interactive Sandbox Simulator */}
                    <BuilderCanvas
                      form={formData}
                      fields={fields}
                      selectedFieldId={selectedFieldId}
                      viewportSize={viewportSize}
                      getAppField={getAppField}
                      onSelectField={(instance) => setSelectedFieldId(instance.id)}
                      onUpdateFieldInstance={updateFieldInstance}
                      onMoveField={moveField}
                      onRemoveField={removeField}
                      onReorderFields={(reordered) => updateField('fields', reordered)}
                      onAddStandardField={addStandardFieldByType}
                      sandboxMode={sandboxMode}
                    />

                    {/* Right Sidebar: Selected Field Properties configuration */}
                    {sandboxMode === 'edit' && (
                      <PropertiesSidebar
                        selectedInstance={fields.find(f => f.id === selectedFieldId) || null}
                        appField={fields.find(f => f.id === selectedFieldId) ? getAppField(fields.find(f => f.id === selectedFieldId)!.appFieldId) : undefined}
                        allFields={fields}
                        getAppField={getAppField}
                        onUpdate={updateFieldInstance}
                        onRemove={(id) => {
                          removeField(id);
                          setSelectedFieldId(null);
                        }}
                        onClose={() => setSelectedFieldId(null)}
                      />
                    )}
                  </div>
                </DndContext>
              </motion.div>
            )}

            {/* ── Step 3: Actions ── */}
            {/* ── Step 3: Actions ── */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <Card className="rounded-2xl border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">Post-Submission Actions</CardTitle>
                    <CardDescription className="text-xs">Configure what happens after someone submits this form.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 text-left">
                    {/* Tags */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          <Tags className="h-4 w-4 text-primary" /> Auto-Apply Registry Tags
                        </Label>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-primary hover:bg-primary/10 rounded-full px-2 gap-1 text-[10px] font-bold uppercase tracking-wider"
                          onClick={() => setIsTagDialogOpen(true)}
                        >
                          <PlusCircle className="h-3 w-3" /> New Tag
                        </Button>
                      </div>
                      <MultiSelect
                        options={(workspaceTags || []).map((t: any) => ({ label: t.name, value: t.id }))}
                        value={formData.actions?.tags || []}
                        onChange={(val) => {
                          const currentActions = (formData.actions || {}) as FormSubmissionActions;
                          updateField('actions', { ...currentActions, tags: val });
                        }}
                        placeholder="Deploy tags..."
                        className="rounded-xl bg-background border border-border/50 shadow-sm font-bold min-h-[44px] transition-all"
                      />
                      <p className="text-[9px] font-bold text-muted-foreground/50 italic leading-relaxed">
                        Respondents will automatically be tagged with these labels in the CRM upon submission.
                      </p>
                    </div>

                    {/* Webhooks */}
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          <PlusCircle className="h-4 w-4 text-indigo-600" /> Outbound Webhook Integrations
                        </Label>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-primary hover:bg-primary/10 rounded-full px-2 gap-1 text-[10px] font-bold uppercase tracking-wider"
                          onClick={() => setIsWebhookDialogOpen(true)}
                        >
                          <PlusCircle className="h-3 w-3" /> New Endpoint
                        </Button>
                      </div>
                      <MultiSelect
                        options={(workspaceWebhooks || []).map((w: any) => ({ label: w.name, value: w.id }))}
                        value={formData.actions?.webhooks || []}
                        onChange={(val) => {
                          const currentActions = (formData.actions || {}) as FormSubmissionActions;
                          updateField('actions', { ...currentActions, webhooks: val });
                        }}
                        placeholder="Select active webhook endpoints..."
                        className="rounded-xl bg-background"
                      />
                      <p className="text-[9px] font-bold text-muted-foreground/50 italic leading-relaxed">
                        Data will be pushed to these external webhooks immediately after each form submission.
                      </p>
                    </div>

                    {/* Notifications */}
                    <div className="space-y-4 pt-4">
                      <FormNotificationSettings
                        internalAlerts={formData.actions?.notifications?.internalAlerts}
                        respondentAlerts={formData.actions?.notifications?.respondentAlerts}
                        externalAlerts={formData.actions?.notifications?.externalAlerts}
                        availableFields={formFieldOptions}
                        onChangeInternal={(val: any) => {
                          const currentActions = (formData.actions || {}) as FormSubmissionActions;
                          const currentNotifications = currentActions.notifications || {};
                          updateField('actions', {
                            ...currentActions,
                            notifications: { ...currentNotifications, internalAlerts: val as any }
                          });
                        }}
                        onChangeRespondent={(val: any) => {
                          const currentActions = (formData.actions || {}) as FormSubmissionActions;
                          const currentNotifications = currentActions.notifications || {};
                          updateField('actions', {
                            ...currentActions,
                            notifications: { ...currentNotifications, respondentAlerts: val as any }
                          });
                        }}
                        onChangeExternal={(val: any) => {
                          const currentActions = (formData.actions || {}) as FormSubmissionActions;
                          const currentNotifications = currentActions.notifications || {};
                          updateField('actions', {
                            ...currentActions,
                            notifications: { ...currentNotifications, externalAlerts: val as any }
                          });
                        }}
                      />
                    </div>

                    {/* Entity Handling (only for bound forms) */}
                    {formData.formType === 'bound' && (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Entity Handling</Label>
                        <Select
                          value={formData.actions?.entityHandling || 'create_new'}
                          onValueChange={v => updateField('actions', { ...formData.actions!, entityHandling: v as any })}
                        >
                          <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="create_new">Create New Entity</SelectItem>
                            <SelectItem value="update_matching">Update Matching Entity</SelectItem>
                            <SelectItem value="create_or_update">Create or Update</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ── Step 4: Share ── */}
            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                  {/* Left Column: Connectivity & Access */}
                  <Card className="rounded-2xl border border-border bg-card overflow-hidden">
                    <CardHeader className="bg-muted/10 border-b py-5 px-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                          <Globe className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-sm font-semibold tracking-tight">Endpoint Connectivity</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8 text-left">
                      {/* Workspaces */}
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          <Layout className="h-3.5 w-3.5" /> Shared Context (Workspaces)
                        </Label>
                        <MultiSelect
                          options={allowedWorkspaces.map(w => ({ label: w.name, value: w.id }))}
                          value={formData.workspaceIds || [activeWorkspaceId]}
                          onChange={val => updateField('workspaceIds', val)}
                          placeholder="Select workspaces..."
                        />
                        <p className="text-[9px] font-bold text-muted-foreground tracking-tight leading-relaxed">
                          Determines which workspace directories this form blueprint is visible in.
                        </p>
                      </div>

                      <Separator className="bg-border/50" />

                      {/* Status & Slug */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">Lifecycle State</Label>
                          <Select 
                            value={formData.status || 'draft'} 
                            onValueChange={v => updateField('status', v as any)}
                          >
                            <SelectTrigger className="h-11 rounded-xl bg-card border border-border/50 shadow-sm transition-all focus-visible:ring-1 focus-visible:ring-primary/30">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="draft">Draft (Internal)</SelectItem>
                              <SelectItem value="published">Published (Live)</SelectItem>
                              <SelectItem value="archived">Archived</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">Portal URL Backhalf</Label>
                          <div className="flex h-11 border border-border rounded-xl overflow-hidden bg-muted/30 transition-all">
                            <div className="bg-muted px-3 flex items-center text-[10px] font-semibold text-muted-foreground/60 border-r">/p/f/</div>
                            <Input 
                              value={formData.slug || ''} 
                              onChange={e => updateField('slug', slugify(e.target.value))} 
                              className="border-none rounded-none shadow-none focus-visible:ring-0 h-full bg-transparent flex-1" 
                            />
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-full w-11 rounded-none border-l hover:bg-primary/5 hover:text-primary shrink-0"
                              onClick={() => {
                                if (typeof window !== 'undefined') {
                                  navigator.clipboard.writeText(`${window.location.origin}/p/f/${formData.slug}`);
                                  toast({ title: 'URL Copied!' });
                                }
                              }}
                            >
                              <Copy className="h-4 w-4 text-muted-foreground hover:text-primary" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Embed / Copy options */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button
                          variant="outline"
                          className="h-11 rounded-xl font-bold gap-2"
                          onClick={() => setIsShareOpen(true)}
                        >
                          <Code className="h-4 w-4" /> Share & Embed
                        </Button>
                        <Button variant="outline" className="h-11 rounded-xl font-bold gap-2" asChild>
                          <a href={`/p/f/${formData.slug}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" /> Preview
                          </a>
                        </Button>
                        {typeof window !== 'undefined' && (
                          <CreateQRButton
                            resourceType="form"
                            resourceId={formId}
                            resourceName={formData.internalName || formData.title || 'Form'}
                            destinationUrl={`${window.location.origin}/p/f/${formData.slug}`}
                            variant="icon"
                          />
                        )}
                      </div>

                      <Separator className="bg-border/50" />

                      {/* Technical Diagnostics */}
                      <div className={cn(
                        "rounded-2xl border-2 transition-all duration-300",
                        formData.showDebugProcessingModal ? "border-primary/20 bg-primary/5" : "border-border/50 bg-background"
                      )}>
                        <div className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3 text-left">
                            <div className={cn("p-2 rounded-lg transition-colors", formData.showDebugProcessingModal ? "bg-primary text-white shadow-lg" : "bg-muted text-muted-foreground")}>
                              <AlertCircle className="h-4 w-4" />
                            </div>
                            <div className="space-y-0.5">
                              <Label className="text-xs font-semibold tracking-tight">Technical Diagnostics</Label>
                              <p className="text-[9px] text-muted-foreground font-medium tracking-tighter">Surface real-time automation status to the public user</p>
                            </div>
                          </div>
                          <Switch 
                            checked={!!formData.showDebugProcessingModal} 
                            onCheckedChange={val => updateField('showDebugProcessingModal', val)} 
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Right Column: Settings & Assignment */}
                  <div className="space-y-8">
                    {/* Cross-Visibility Toggle */}
                    <div className={cn(
                      "rounded-2xl border-2 transition-all duration-300",
                      formData.allowCrossVisibility ? "border-blue-500/20 bg-blue-500/5" : "border-border/50 bg-background"
                    )}>
                      <div className="flex items-center justify-between p-5">
                        <div className="flex items-center gap-3 text-left">
                          <div className={cn("p-2 rounded-lg transition-colors", formData.allowCrossVisibility ? "bg-blue-500 text-white shadow-lg" : "bg-muted text-muted-foreground")}>
                            <Eye className="h-4 w-4" />
                          </div>
                          <div className="space-y-0.5">
                            <Label className="text-xs font-semibold tracking-tight">Cross-Visibility</Label>
                            <p className="text-[9px] text-muted-foreground font-medium tracking-tighter">Allow assigned users to view all team submissions, not just their own</p>
                          </div>
                        </div>
                        <Switch 
                          checked={!!formData.allowCrossVisibility} 
                          onCheckedChange={val => updateField('allowCrossVisibility', val)} 
                        />
                      </div>
                    </div>

                    {/* Allow Resubmission Toggle */}
                    <div className={cn(
                      "rounded-2xl border-2 transition-all duration-300",
                      formData.allowResubmission ? "border-emerald-500/20 bg-emerald-500/5" : "border-border/50 bg-background"
                    )}>
                      <div className="flex items-center justify-between p-5">
                        <div className="flex items-center gap-3 text-left">
                          <div className={cn("p-2 rounded-lg transition-colors", formData.allowResubmission ? "bg-emerald-500 text-white shadow-lg" : "bg-muted text-muted-foreground")}>
                            <RotateCcw className="h-4 w-4" />
                          </div>
                          <div className="space-y-0.5">
                            <Label className="text-xs font-semibold tracking-tight">Allow Resubmission</Label>
                            <p className="text-[9px] text-muted-foreground font-medium tracking-tighter">Allow respondents to fill and submit the form multiple times</p>
                          </div>
                        </div>
                        <Switch 
                          checked={!!formData.allowResubmission} 
                          onCheckedChange={val => updateField('allowResubmission', val)} 
                        />
                      </div>
                    </div>

                    {/* Lead Handlers / Assignment Card */}
                    <Card className="rounded-2xl border border-border bg-card overflow-hidden">
                      <CardHeader className="bg-muted/10 border-b py-5 px-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-500/10 rounded-xl">
                            <Users className="h-5 w-5 text-indigo-600" />
                          </div>
                          <CardTitle className="text-sm font-semibold tracking-tight">Lead Handlers / Assignments</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 space-y-6 text-left">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Switch 
                                checked={!!formData.assignmentEnabled} 
                                onCheckedChange={val => updateField('assignmentEnabled', val)} 
                              />
                              <Label className="text-xs font-semibold">Enable Submissions Router</Label>
                            </div>
                          </div>
                          {formData.assignmentEnabled && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                              <div className="space-y-2">
                                <Label className="text-[10px] font-semibold text-primary">Assign Team Members</Label>
                                <MultiSelect
                                  options={userOptions}
                                  value={formData.assignedUsers || []}
                                  onChange={val => updateField('assignedUsers', val)}
                                  placeholder="Search team members..."
                                />
                              </div>
                              <div className="flex flex-col gap-3 pt-2">
                                <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border">
                                  <span className="text-[10px] font-semibold">Notify via Email</span>
                                  <Switch 
                                    checked={!!formData.notifyAssignedUsers?.email} 
                                    onCheckedChange={val => {
                                      const currentNotify = formData.notifyAssignedUsers || { email: false, sms: false };
                                      updateField('notifyAssignedUsers', { ...currentNotify, email: val });
                                    }} 
                                  />
                                </div>
                                <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border">
                                  <span className="text-[10px] font-semibold">Notify via SMS</span>
                                  <Switch 
                                    checked={!!formData.notifyAssignedUsers?.sms} 
                                    onCheckedChange={val => {
                                      const currentNotify = formData.notifyAssignedUsers || { email: false, sms: false };
                                      updateField('notifyAssignedUsers', { ...currentNotify, sms: val });
                                    }} 
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* SEO Card */}
                <SeoSettingsCard
                  value={formData.seo || {}}
                  onChange={(next: SeoConfig) => updateField('seo', next)}
                  assetLabel="Cover Image"
                  contentTitle={formData.title}
                  contentDescription={formData.description}
                  previewUrl={`smartsapp.com/p/f/${formData.slug || ''}`}
                  description="Configure how this form appears in search engines and when shared."
                />

                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-primary/5 rounded-xl text-center">
                    <p className="text-2xl font-bold tabular-nums">{fields.length}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground mt-1">Fields</p>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-xl text-center">
                    <p className="text-2xl font-bold tabular-nums">{formData.actions?.tags?.length || 0}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground mt-1">Auto Tags</p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-xl text-center">
                    <p className="text-2xl font-bold tabular-nums">{formData.actions?.webhooks?.length || 0}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground mt-1">Webhooks</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl text-center">
                    <p className="text-2xl font-bold tabular-nums capitalize">{formData.theme?.preset || 'professional'}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground mt-1">Theme</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer Navigation */}
          <div className={cn("p-4 sm:p-6 bg-background border-t shrink-0", step === 2 ? "mt-0" : "mt-8")}>
            <div className="flex items-center justify-between text-left">
              <Button type="button" variant="ghost" onClick={() => router.push('/admin/forms')} className="font-bold text-muted-foreground rounded-xl px-6 h-12">
                Cancel
              </Button>
              <div className="flex items-center gap-4 text-left">
                {step > 1 && (
                  <Button type="button" variant="outline" onClick={() => handleStepChange(step - 1)} className="font-bold border-border/50 rounded-xl px-6 h-12 gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                )}
                {step < 4 ? (
                  <Button type="button" onClick={() => handleStepChange(step + 1)} className="gap-2 px-10 h-12 font-semibold shadow-xl rounded-xl transition-all active:scale-95 group">
                    Next Phase <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                ) : (
                  <Button
                    disabled={isSaving}
                    onClick={handlePublish}
                    className="gap-2 px-12 h-14 font-semibold shadow-2xl bg-primary text-white hover:bg-primary/90 rounded-[1.25rem] transition-all active:scale-95 text-lg"
                  >
                    {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-4 w-4" />}
                    Finalize & Publish
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {isShareOpen && (
        <ShareEmbedDialog
          isOpen={isShareOpen}
          onOpenChange={setIsShareOpen}
          title="Share & Embed Form"
          resourceName="Form"
          publicUrl={typeof window !== 'undefined' ? `${window.location.origin}/p/f/${formData.slug}` : `/p/f/${formData.slug}`}
          embedUrl={typeof window !== 'undefined' ? `${window.location.origin}/f/${formId}` : `/f/${formId}`}
        />
      )}

      {/* Create Tag Dialog */}
      <Dialog open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-sm border border-border bg-card shadow-2xl">
          <DialogHeader className="pt-4 px-2">
            <DialogTitle className="font-black text-2xl tracking-tighter text-primary">New Registry Tag</DialogTitle>
            <DialogDescription className="text-[11px] font-bold text-muted-foreground/60 leading-relaxed italic">
              Add an organizational label to your CRM taxonomy.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 space-y-4">
            <div className="space-y-2 px-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tag Name</Label>
              <Input 
                value={newTagName} 
                onChange={e => setNewTagName(e.target.value)} 
                placeholder="e.g. High Intent" 
                className="h-12 rounded-2xl border-none bg-muted/20 px-5 font-bold shadow-inner"
              />
            </div>
          </div>
          <DialogFooter className="px-4 pb-8">
            <Button 
              onClick={handleCreateTag} 
              disabled={isTagSaving || !newTagName.trim()} 
              className="w-full h-14 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/30"
            >
              {isTagSaving ? 'Registering...' : 'Add to Registry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Webhook Dialog */}
      <Dialog open={isWebhookDialogOpen} onOpenChange={setIsWebhookDialogOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-sm border border-border bg-card shadow-2xl">
          <DialogHeader className="pt-4 px-2">
            <DialogTitle className="font-black text-2xl tracking-tighter text-primary">New Webhook Endpoint</DialogTitle>
            <DialogDescription className="text-[11px] font-bold text-muted-foreground/60 leading-relaxed italic">
              Define a target URL to push form submission data.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 space-y-4">
            <div className="space-y-2 px-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Webhook Name</Label>
              <Input 
                value={newWebhookName} 
                onChange={e => setNewWebhookName(e.target.value)} 
                placeholder="e.g. Zapier Integration" 
                className="h-12 rounded-2xl border-none bg-muted/20 px-5 font-bold shadow-inner"
              />
            </div>
            <div className="space-y-2 px-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Target URL</Label>
              <Input 
                value={newWebhookUrl} 
                onChange={e => setNewWebhookUrl(e.target.value)} 
                placeholder="https://hooks.example.com/..." 
                className="h-12 rounded-2xl border-none bg-muted/20 px-5 font-bold shadow-inner"
              />
            </div>
          </div>
          <DialogFooter className="px-4 pb-8">
            <Button 
              onClick={handleCreateWebhook} 
              disabled={isWebhookSaving || !newWebhookName.trim() || !newWebhookUrl.trim()} 
              className="w-full h-14 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/30"
            >
              {isWebhookSaving ? 'Creating...' : 'Register Webhook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
