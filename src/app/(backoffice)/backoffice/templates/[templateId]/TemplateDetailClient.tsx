'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FileStack,
  Settings,
  History,
  Code as CodeIcon,
  CheckCircle,
  Archive,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getTemplateDetail, publishTemplate, deprecateTemplate } from '@/lib/backoffice/backoffice-template-actions';
import { useBackoffice } from '../../context/BackofficeProvider';
import type { PlatformTemplate } from '@/lib/backoffice/backoffice-types';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  published: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  deprecated: 'bg-red-500/15 text-red-400 border-red-500/20',
  archived: 'bg-slate-500/15 text-muted-foreground border-slate-500/20',
};

const TYPE_COLORS: Record<string, string> = {
  messaging: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  form: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  survey: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
  automation: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
};

export default function TemplateDetailClient({ templateId }: { templateId: string }) {
  const { profile, can } = useBackoffice();
  const [template, setTemplate] = React.useState<PlatformTemplate | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isActionLoading, setIsActionLoading] = React.useState(false);

  const loadTemplate = React.useCallback(async () => {
    setIsLoading(true);
    const result = await getTemplateDetail(templateId);
    if (result.success && result.data) {
      setTemplate(result.data);
    }
    setIsLoading(false);
  }, [templateId]);

  React.useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const handlePublish = async () => {
    if (!profile || !template) return;
    if (!confirm('Publishing will make this version available to all allowed organizations immediately. Proceed?')) return;
    
    setIsActionLoading(true);
    const result = await publishTemplate(template.id, {
      userId: profile.id,
      name: profile.name,
      email: profile.email,
      role: 'super_admin',
    });
    
    if (result.success) loadTemplate();
    setIsActionLoading(false);
  };

  const handleDeprecate = async () => {
    if (!profile || !template) return;
    if (!confirm('Deprecating this template will hide it from the selection screen for any orgs not currently using it. Proceed?')) return;
    
    setIsActionLoading(true);
    const result = await deprecateTemplate(template.id, {
      userId: profile.id,
      name: profile.name,
      email: profile.email,
      role: 'super_admin',
    });
    
    if (result.success) loadTemplate();
    setIsActionLoading(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-accent rounded-lg animate-pulse" />
        <div className="h-64 bg-muted/50 rounded-2xl border border-border animate-pulse" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <FileStack className="h-12 w-12 text-slate-700 mb-4" />
        <p className="text-sm text-muted-foreground">Template not found.</p>
        <Link href="/backoffice/templates">
          <Button variant="ghost" className="mt-4 text-emerald-400">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Templates
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/backoffice/templates">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Back to templates"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {template.name}
              </h1>
              <Badge
                variant="outline"
                className={`text-[9px] uppercase font-bold px-2 h-5 ${STATUS_COLORS[template.status] || STATUS_COLORS.draft}`}
              >
                {template.status}
              </Badge>
              <Badge
                variant="outline"
                className={`text-[9px] uppercase font-bold px-2 h-5 ${TYPE_COLORS[template.type] || 'bg-slate-500/15 text-muted-foreground border-slate-500/20'}`}
              >
                {template.type}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
          </div>
        </div>
        
        {/* Action Header */}
        <div className="flex items-center gap-3">
           {can('templates', 'edit') && (
              <>
                 {template.status === 'draft' && (
                    <Button
                      onClick={handlePublish}
                      disabled={isActionLoading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-foreground rounded-xl h-10 px-4"
                    >
                       <CheckCircle className="h-4 w-4 mr-2" /> Publish Template
                    </Button>
                 )}
                 {template.status === 'published' && (
                    <Button
                      onClick={handleDeprecate}
                      disabled={isActionLoading}
                      className="bg-amber-600 hover:bg-amber-700 text-foreground rounded-xl h-10 px-4"
                    >
                       <Archive className="h-4 w-4 mr-2" /> Deprecate Template
                    </Button>
                 )}
              </>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Properties */}
        <div className="md:col-span-1 space-y-6">
           <div className="rounded-2xl border border-border bg-muted/50 p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                 <Settings className="h-4 w-4 text-emerald-400" />
                 Template Properties
              </h3>
              <div className="space-y-4 text-sm">
                 <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">Category</span>
                    <span className="text-foreground">{template.category}</span>
                 </div>
                 <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">Scope</span>
                    <span className="text-foreground capitalize">{template.scope}</span>
                 </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">Default for New Orgs</span>
                    <Badge variant="outline" className={template.defaultForNewOrgs ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] uppercase h-4' : 'bg-slate-500/10 text-muted-foreground border-slate-500/20 text-[9px] uppercase h-4'}>
                        {template.defaultForNewOrgs ? 'YES' : 'NO'}
                    </Badge>
                 </div>
                 <div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">Total Usage Instances</span>
                    <span className="text-foreground font-mono">{template.usageCount}</span>
                 </div>
                 <div className="pt-2 border-t border-border">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold block mb-1">Last Updated</span>
                    <span className="text-foreground/80 text-xs">{template.updatedAt ? new Date(template.updatedAt).toLocaleString() : '—'}</span>
                 </div>
              </div>
           </div>
        </div>

        {/* Right Column: JSON Metadata / History Viewer */}
        <div className="md:col-span-2">
           <Tabs defaultValue="metadata" className="h-full flex flex-col">
              <TabsList className="bg-muted/50 border border-border rounded-xl p-1 h-auto flex flex-wrap gap-1">
                 <TabsTrigger
                    value="metadata"
                    className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 cursor-pointer flex-1 sm:flex-none"
                  >
                    <CodeIcon className="h-3.5 w-3.5 mr-2" /> Template Payload
                  </TabsTrigger>
                  <TabsTrigger
                    value="history"
                    className="rounded-lg text-xs font-semibold data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 cursor-pointer flex-1 sm:flex-none"
                  >
                    <History className="h-3.5 w-3.5 mr-2" /> Version History
                  </TabsTrigger>
              </TabsList>
              
              <TabsContent value="metadata" className="flex-1 mt-4">
                 <div className="rounded-2xl border border-border bg-background p-4 h-full relative overflow-hidden group">
                     <span className="absolute top-4 right-4 bg-accent/80 text-foreground text-[10px] font-mono px-2 py-0.5 rounded text-foreground/50 group-hover:text-foreground/80 transition-colors">v{template.version}</span>
                     <pre className="text-xs font-mono text-emerald-400/80 overflow-auto h-[400px]">
                        {JSON.stringify(template.content, null, 2)}
                     </pre>
                 </div>
              </TabsContent>
              
              <TabsContent value="history" className="flex-1 mt-4">
                 <div className="rounded-2xl border border-border bg-muted/50 p-6 h-[400px] overflow-auto">
                    {template.versionHistory && template.versionHistory.length > 0 ? (
                       <ol className="relative border-l border-border ml-3">
                          {template.versionHistory.slice().reverse().map((hist, idx) => (
                             <li key={idx} className="mb-6 ml-6">            
                                <span className="absolute flex items-center justify-center w-6 h-6 bg-muted rounded-full -left-3 ring-4 ring-slate-950 border border-border">
                                   <History className="w-3 h-3 text-muted-foreground" />
                                </span>
                                <h3 className="flex items-center mb-1 text-sm font-semibold text-foreground">
                                   Version {hist.version} 
                                   {idx === 0 && <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-medium mr-2 px-2.5 py-0.5 rounded ml-3 border border-emerald-500/20">Current</span>}
                                </h3>
                                <time className="block mb-2 text-xs font-normal leading-none text-muted-foreground">Published {new Date(hist.publishedAt).toLocaleString()} by {hist.publishedBy}</time>
                                <p className="mb-4 text-xs font-normal text-muted-foreground">{hist.changelog || 'No changelog provided.'}</p>
                             </li>
                          ))}
                       </ol>
                    ) : (
                       <div className="text-center py-12">
                           <History className="h-8 w-8 text-slate-600 mx-auto mb-3" />
                           <p className="text-sm text-muted-foreground">No version history found.</p>
                       </div>
                    )}
                 </div>
              </TabsContent>
           </Tabs>
        </div>
      </div>
    </div>
  );
}
