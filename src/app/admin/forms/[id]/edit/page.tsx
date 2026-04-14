'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, collection, query, where, orderBy, updateDoc } from 'firebase/firestore';
import { useDoc, useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import type { Form, FormFieldInstance, AppField, FormThemeConfig, FormSubmissionActions } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
  Plus,
  Trash2,
  GripVertical,
  Copy,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Link as LinkIcon,
  Code,
  Eye,
  Lock,
  CaseSensitive,
  Hash,
  Calendar,
  Mail,
  Phone,
  ListFilter,
  ToggleLeft,
  MapPin,
  FileText,
  EyeOff,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// ────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────

const FIELD_TYPE_ICONS: Record<string, React.ElementType> = {
  short_text: CaseSensitive,
  long_text: FileText,
  email: Mail,
  phone: Phone,
  number: Hash,
  currency: Hash,
  date: Calendar,
  datetime: Calendar,
  select: ListFilter,
  multi_select: ListFilter,
  radio: ToggleLeft,
  checkbox: ToggleLeft,
  yes_no: ToggleLeft,
  address: MapPin,
  url: LinkIcon,
  hidden: EyeOff,
};

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
  const { activeWorkspaceId } = useTenant();

  // State
  const [step, setStep] = React.useState(1);
  const [isSaving, setIsSaving] = React.useState(false);
  const [hasInitialized, setHasInitialized] = React.useState(false);

  // Form document data stored in local state for editing
  const [formData, setFormData] = React.useState<Partial<Form>>({});

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

  // Initialize from Firestore
  React.useEffect(() => {
    if (formDoc && !hasInitialized) {
      setFormData(formDoc);
      setHasInitialized(true);
    }
  }, [formDoc, hasInitialized]);

  // Helpers
  const updateField = <K extends keyof Form>(key: K, value: Form[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
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

  const getAppField = (appFieldId: string) => availableFields?.find(f => f.id === appFieldId);

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
    <div className="h-full flex flex-col bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b px-8 h-16 flex items-center justify-between shrink-0">
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
          <Button
            disabled={isSaving}
            onClick={handleSave}
            className="rounded-xl font-semibold shadow-lg gap-2 px-6 h-10 text-[10px] active:scale-95 transition-all"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto py-8 px-4">
          <Stepper currentStep={step} onStepClick={handleStepChange} />

          <AnimatePresence mode="wait">
            {/* ── Step 1: Details ── */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column */}
                  <div className="space-y-6">
                    <Card className="rounded-2xl border-none shadow-sm">
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
                              updateField('internalName', e.target.value);
                              updateField('slug', slugify(e.target.value));
                            }}
                            placeholder="e.g. Parent Enrollment Form"
                            className="h-11 rounded-xl bg-muted/20 border-none"
                          />
                        </div>
                        <div className="space-y-2 text-left">
                          <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Public Title</Label>
                          <Input
                            value={formData.title || ''}
                            onChange={e => updateField('title', e.target.value)}
                            placeholder="e.g. Enrollment Application"
                            className="h-11 rounded-xl bg-muted/20 border-none"
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
                            className="rounded-xl min-h-[60px] resize-none bg-muted/20 border-none"
                            rows={2}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-none shadow-sm">
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
                    <Card className="rounded-2xl border-none shadow-sm">
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
                                'p-4 rounded-xl border-2 text-left transition-all hover:shadow-md',
                                formData.theme?.preset === preset.value
                                  ? 'border-primary bg-primary/5 shadow-sm'
                                  : 'border-border/50 hover:border-primary/30'
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
                    <Card className="rounded-2xl border-none shadow-sm">
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
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left: Available Fields Palette */}
                  <Card className="rounded-2xl border-none shadow-sm lg:col-span-1">
                    <CardHeader>
                      <CardTitle className="text-base font-semibold">Field Registry</CardTitle>
                      <CardDescription className="text-xs">Click a field to add it to your form.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
                      {!availableFields || availableFields.length === 0 ? (
                        <div className="py-8 text-center">
                          <p className="text-[10px] text-muted-foreground font-semibold">No fields available. Seed native fields first.</p>
                          <Button variant="link" size="sm" className="mt-2" onClick={() => router.push('/admin/settings/fields')}>
                            Go to Fields Manager →
                          </Button>
                        </div>
                      ) : (
                        availableFields.map(af => {
                          const isAlreadyAdded = fields.some(f => f.appFieldId === af.id);
                          const Icon = FIELD_TYPE_ICONS[af.type] || CaseSensitive;
                          return (
                            <button
                              key={af.id}
                              type="button"
                              disabled={isAlreadyAdded}
                              onClick={() => addFieldFromRegistry(af)}
                              className={cn(
                                'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all border group/item',
                                isAlreadyAdded
                                  ? 'opacity-40 cursor-not-allowed border-border/30 bg-muted/20'
                                  : 'hover:bg-accent/10 hover:border-primary/30 border-border/50 cursor-pointer'
                              )}
                            >
                              <div className="p-1.5 bg-primary/10 rounded-lg group-hover/item:scale-110 transition-transform">
                                <Icon className="h-3.5 w-3.5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <p className="text-xs font-bold truncate">{af.label}</p>
                                    {af.isNative && (
                                        <Badge variant="secondary" className="h-3 text-[7px] uppercase px-1 font-extrabold tracking-tighter bg-primary/10 text-primary border-none">
                                            Native
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-[9px] text-muted-foreground font-mono truncate">{'{{' + af.variableName + '}}'}</p>
                              </div>
                              {isAlreadyAdded ? (
                                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              ) : (
                                <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>

                  {/* Right: Canvas (field list) */}
                  <Card className="rounded-2xl border-none shadow-sm lg:col-span-2">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base font-semibold">Form Canvas</CardTitle>
                          <CardDescription className="text-xs">{fields.length} fields added. Drag to reorder.</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {fields.length === 0 ? (
                        <div className="py-16 text-center border-2 border-dashed rounded-2xl bg-background">
                          <Layout className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                          <p className="text-xs font-semibold text-muted-foreground">No fields yet. Pick from the registry to start building.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {fields.sort((a, b) => a.order - b.order).map((instance, idx) => {
                            const appField = getAppField(instance.appFieldId);
                            const Icon = FIELD_TYPE_ICONS[appField?.type || 'short_text'] || CaseSensitive;
                            return (
                              <div
                                key={instance.id}
                                className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-background hover:shadow-sm transition-all group"
                              >
                                <GripVertical className="h-4 w-4 text-muted-foreground/30 cursor-grab shrink-0" />
                                <div className="p-1.5 bg-primary/10 rounded-lg shrink-0">
                                  <Icon className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                  <p className="text-sm font-bold truncate">{instance.labelOverride || appField?.label || 'Unknown Field'}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <code className="text-[9px] font-mono text-primary/60">{'{{' + (appField?.variableName || '?') + '}}'}</code>
                                    {appField?.isNative && (
                                      <Badge variant="secondary" className="h-3.5 text-[7px] uppercase px-1 gap-0.5"><Lock className="h-2 w-2" /> Native</Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Select
                                    value={instance.width || 'full'}
                                    onValueChange={v => updateFieldInstance(instance.id, { width: v as any })}
                                  >
                                    <SelectTrigger className="h-7 w-16 rounded-lg text-[9px] border-none bg-muted/30"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-lg">
                                      <SelectItem value="full">Full</SelectItem>
                                      <SelectItem value="half">Half</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <div className="flex items-center gap-0.5 bg-muted/30 rounded-lg p-0.5">
                                    <Switch
                                      checked={instance.required}
                                      onCheckedChange={v => updateFieldInstance(instance.id, { required: v })}
                                      className="scale-[0.65]"
                                    />
                                    <span className="text-[8px] font-semibold text-muted-foreground pr-1">Req</span>
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveField(instance.id, 'up')} disabled={idx === 0}>
                                    <ChevronUp className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveField(instance.id, 'down')} disabled={idx === fields.length - 1}>
                                    <ChevronDown className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeField(instance.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            )}

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
                    <div className="space-y-2">
                      <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Apply Tags (comma-separated)</Label>
                      <Input
                        value={formData.actions?.tags?.join(', ') || ''}
                        onChange={e => updateField('actions', { ...formData.actions!, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                        placeholder="e.g. lead, enrolled, form-submitted"
                        className="h-11 rounded-xl bg-muted/20 border-none"
                      />
                    </div>

                    {/* Webhooks */}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Webhook URLs (one per line)</Label>
                      <Textarea
                        value={formData.actions?.webhooks?.join('\n') || ''}
                        onChange={e => updateField('actions', { ...formData.actions!, webhooks: e.target.value.split('\n').map(w => w.trim()).filter(Boolean) })}
                        placeholder="https://hooks.example.com/form-submit"
                        className="rounded-xl min-h-[80px] resize-none bg-muted/20 border-none font-mono text-xs"
                        rows={3}
                      />
                    </div>

                    {/* Notifications */}
                    <div className="space-y-4 p-4 bg-muted/30 rounded-xl">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">Send Confirmation Email to Respondent</Label>
                        <Switch
                          checked={formData.actions?.notifications?.sendConfirmationEmail || false}
                          onCheckedChange={v => {
                            const currentActions = (formData.actions || {}) as FormSubmissionActions;
                            const currentNotifications = currentActions.notifications || {} as FormSubmissionActions['notifications'];
                            updateField('actions', {
                              ...currentActions,
                              notifications: { ...currentNotifications, sendConfirmationEmail: v }
                            });
                          }}
                        />
                      </div>
                      {formData.actions?.notifications?.sendConfirmationEmail && (
                        <div className="space-y-2">
                          <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Email Field Variable</Label>
                          <Input
                            value={formData.actions?.notifications?.respondentEmailField || ''}
                            onChange={e => {
                              const currentActions = (formData.actions || {}) as FormSubmissionActions;
                              const currentNotifications = currentActions.notifications || {} as FormSubmissionActions['notifications'];
                              updateField('actions', {
                                ...currentActions,
                                notifications: { ...currentNotifications, respondentEmailField: e.target.value }
                              });
                            }}
                            placeholder="e.g. contact_email"
                            className="h-11 rounded-xl bg-background border-none"
                          />
                        </div>
                      )}
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
              <motion.div key="step4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                <Card className="rounded-2xl border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">Distribution</CardTitle>
                    <CardDescription className="text-xs">Share your form or embed it on external pages.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 text-left">
                    {/* Public URL */}
                    <div className="space-y-3">
                      <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Public URL</Label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-11 bg-muted/30 rounded-xl border border-border/50 flex items-center px-4">
                          <code className="text-xs font-mono text-foreground truncate">
                            {typeof window !== 'undefined' ? `${window.location.origin}/p/f/${formData.slug}` : `/p/f/${formData.slug}`}
                          </code>
                        </div>
                        <Button
                          variant="outline"
                          className="h-11 rounded-xl font-bold gap-2"
                          onClick={() => {
                            if (typeof window !== 'undefined') {
                              navigator.clipboard.writeText(`${window.location.origin}/p/f/${formData.slug}`);
                              toast({ title: 'URL Copied!' });
                            }
                          }}
                        >
                          <Copy className="h-4 w-4" /> Copy
                        </Button>
                        <Button variant="outline" className="h-11 rounded-xl font-bold gap-2" asChild>
                          <a href={`/p/f/${formData.slug}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" /> Preview
                          </a>
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    {/* Embed Code */}
                    <div className="space-y-3">
                      <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Embed Code</Label>
                      <div className="relative">
                        <pre className="p-4 rounded-xl bg-muted/30 border border-border/50 text-[10px] font-mono overflow-x-auto">
                          {`<iframe src="${typeof window !== 'undefined' ? window.location.origin : ''}/p/f/${formData.slug}?embed=true" width="100%" height="600" frameborder="0" style="border:none;border-radius:16px;"></iframe>`}
                        </pre>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8 rounded-lg"
                          onClick={() => {
                            const code = `<iframe src="${typeof window !== 'undefined' ? window.location.origin : ''}/p/f/${formData.slug}?embed=true" width="100%" height="600" frameborder="0" style="border:none;border-radius:16px;"></iframe>`;
                            navigator.clipboard.writeText(code);
                            toast({ title: 'Embed Code Copied!' });
                          }}
                        >
                          <Code className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    {/* Summary */}
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
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer Navigation */}
          <div className="mt-8 p-4 sm:p-6 bg-background border-t">
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
    </div>
  );
}
