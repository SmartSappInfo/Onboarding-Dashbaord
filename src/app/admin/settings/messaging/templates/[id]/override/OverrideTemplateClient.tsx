'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { PageContainer } from '@/components/ui/page-container';
import { ArrowLeft, Save, Copy, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/firebase/provider';
import TemplateEditor from '@/components/messaging/TemplateEditor';
import { createOrgOverride, updateOrgTemplate, listTemplates, getTemplateById } from '@/lib/template-actions';
import { getVariablesForContext } from '@/lib/template-variable-utils';
import type { MessageTemplate, TemplateVariable } from '@/lib/types';

// ── Schema ─────────────────────────────────────────────────────────────────

const overrideSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  subject: z.string().optional(),
  body: z.string().min(1, 'Body is required'),
});

type OverrideFormData = z.infer<typeof overrideSchema>;

// ── Diff View Component ────────────────────────────────────────────────────

interface DiffViewProps {
  globalContent: string;
  orgContent: string;
  label: string;
}

function DiffView({ globalContent, orgContent, label }: DiffViewProps) {
  return (
    <div className="space-y-3">
      <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-2 gap-4">
        {/* Global template */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px] uppercase font-bold px-1.5 h-4 bg-blue-500/15 text-blue-400 border-blue-500/20">
              Global
            </Badge>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3 min-h-[120px]">
            <pre className="font-mono text-xs text-foreground/80 whitespace-pre-wrap break-words">
              {globalContent || '(empty)'}
            </pre>
          </div>
        </div>

        {/* Organization override */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px] uppercase font-bold px-1.5 h-4 bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
              Your Override
            </Badge>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3 min-h-[120px]">
            <pre className="font-mono text-xs text-foreground/80 whitespace-pre-wrap break-words">
              {orgContent || '(empty)'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface Props {
  templateId: string;
}

export default function OverrideTemplateClient({ templateId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const { activeOrganization } = useTenant();
  const { user } = useUser();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [globalTemplate, setGlobalTemplate] = React.useState<MessageTemplate | null>(null);
  const [existingOverride, setExistingOverride] = React.useState<MessageTemplate | null>(null);
  const [variables, setVariables] = React.useState<TemplateVariable[]>([]);
  const [activeTab, setActiveTab] = React.useState<string>('edit');

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<OverrideFormData>({
    resolver: zodResolver(overrideSchema),
    defaultValues: {
      name: '',
      subject: '',
      body: '',
    },
  });

  const watchedBody = watch('body');
  const watchedSubject = watch('subject');

  // Load template data
  React.useEffect(() => {
    if (!activeOrganization?.id) return;

    async function load() {
      try {
        setLoading(true);

        // Fetch all templates for this org
        const allTemplates = await listTemplates(activeOrganization!.id);

        // Find the template by ID (could be global or existing override)
        const template = allTemplates.find((t) => t.id === templateId);
        if (!template) {
          throw new Error('Template not found');
        }

        // If it's an org override, fetch the global template it's based on
        if (template.scope === 'organization' && template.globalTemplateId) {
          const globalTpl = await getTemplateById(template.globalTemplateId);
          if (globalTpl) {
            setGlobalTemplate(globalTpl);
          }
          setExistingOverride(template);
        } else {
          // It's a global template, so we're creating a new override
          setGlobalTemplate(template);
          setExistingOverride(null);
        }

        // Load variables for this context
        const vars = await getVariablesForContext(template.variableContext);
        setVariables(vars);
      } catch (error) {
        console.error('Failed to load template:', error);
        toast({
          title: 'Error',
          description: 'Failed to load template',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [templateId, activeOrganization, toast]);

  // Populate form when data loads
  React.useEffect(() => {
    if (existingOverride) {
      // Editing existing override
      control._reset({
        name: existingOverride.name,
        subject: existingOverride.subject ?? '',
        body: existingOverride.body,
      });
    } else if (globalTemplate) {
      // Creating new override from global
      control._reset({
        name: globalTemplate.name,
        subject: globalTemplate.subject ?? '',
        body: globalTemplate.body,
      });
    }
  }, [existingOverride, globalTemplate, control]);

  // Submit handler
  const onSubmit = async (data: OverrideFormData) => {
    if (!activeOrganization?.id || !user?.uid) return;

    try {
      setSaving(true);

      if (existingOverride) {
        // Update existing override
        await updateOrgTemplate(
          existingOverride.id,
          activeOrganization.id,
          {
            name: data.name,
            subject: data.subject,
            body: data.body,
            declaredVariables: extractVariables(data.body),
          },
          user.uid,
        );
        toast({
          title: 'Success',
          description: 'Template override updated',
        });
      } else if (globalTemplate) {
        // Create new override
        await createOrgOverride(
          globalTemplate.id,
          activeOrganization.id,
          {
            name: data.name,
            subject: data.subject,
            body: data.body,
            declaredVariables: extractVariables(data.body),
          },
          user.uid,
        );
        toast({
          title: 'Success',
          description: 'Template override created',
        });
      }

      router.push('/admin/settings/messaging/templates');
    } catch (error) {
      console.error('Failed to save override:', error);
      toast({
        title: 'Error',
        description: 'Failed to save template override',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Extract variables from body
  function extractVariables(body: string): string[] {
    const matches = body.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '').trim()))];
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">Loading template...</div>
      </div>
    );
  }

  if (!globalTemplate) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">Template not found</p>
        <Button variant="ghost" onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6 pb-24">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9 rounded-xl active:scale-[0.97]">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {existingOverride ? 'Edit Override' : 'Create Override'}
                </h1>
                <CardInfoTooltip text={existingOverride ? 'Update your organization template override.' : 'Customize this template for your organization.'} />
                <Badge variant="outline" className="text-[9px] uppercase font-bold px-2 h-5 bg-emerald-500/15 text-emerald-400 border-emerald-500/20 flex items-center gap-1">
                  <Copy className="h-2.5 w-2.5" />
                  Overriding Global
                </Badge>
              </div>
            </div>

            {/* Standard Segmented Pill Navigation on Top-Right */}
            <div className="flex items-center gap-2 shrink-0">
              <TabsList className="bg-muted/30 dark:bg-muted/40 p-1 rounded-xl border border-border/60 shadow-inner h-auto inline-flex items-center gap-1">
                <TabsTrigger 
                  value="edit"
                  className="h-8.5 rounded-lg text-xs font-semibold px-3.5 transition-all flex items-center gap-1.5 active:scale-[0.97] data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:font-bold data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground hover:bg-transparent"
                >
                  Edit
                </TabsTrigger>
                <TabsTrigger 
                  value="diff"
                  className="h-8.5 rounded-lg text-xs font-semibold px-3.5 transition-all flex items-center gap-1.5 active:scale-[0.97] data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:font-bold data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground hover:bg-transparent"
                >
                  Compare
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-6">

          <TabsContent value="edit" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Template Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name</Label>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="name"
                        placeholder="Enter template name"
                        className="bg-muted/30 border-border"
                      />
                    )}
                  />
                  {errors.name && (
                    <p className="text-xs text-red-400">{errors.name.message}</p>
                  )}
                </div>

                {/* Subject (email only) */}
                {globalTemplate.channel === 'email' && (
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject Line</Label>
                    <Controller
                      name="subject"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="subject"
                          placeholder="Enter email subject"
                          className="bg-muted/30 border-border"
                        />
                      )}
                    />
                    {errors.subject && (
                      <p className="text-xs text-red-400">{errors.subject.message}</p>
                    )}
                  </div>
                )}

                {/* Body */}
                <div className="space-y-2">
                  <Label htmlFor="body">Message Body</Label>
                  <Controller
                    name="body"
                    control={control}
                    render={({ field }) => (
                      <TemplateEditor
                        value={field.value}
                        onChange={field.onChange}
                        channel={globalTemplate.channel}
                        variables={variables}
                      />
                    )}
                  />
                  {errors.body && (
                    <p className="text-xs text-red-400">{errors.body.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="diff" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Compare Changes</CardTitle>
                <p className="text-xs text-muted-foreground">
                  View the differences between the global template and your override
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Subject diff (email only) */}
                {globalTemplate.channel === 'email' && (
                  <DiffView
                    label="Subject Line"
                    globalContent={globalTemplate.subject ?? ''}
                    orgContent={watchedSubject ?? ''}
                  />
                )}

                {/* Body diff */}
                <DiffView
                  label="Message Body"
                  globalContent={globalTemplate.body}
                  orgContent={watchedBody}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {existingOverride ? 'Update Override' : 'Create Override'}
                </>
              )}
            </Button>
          </div>
        </form>
      </Tabs>
    </div>
  </PageContainer>
);
}
