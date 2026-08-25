import React from 'react';
import { z } from 'zod';
import { FolderArchive, Download, FileText, FileSpreadsheet, FileCode, ArrowDownToLine } from 'lucide-react';
import { registerBlock } from '../../registry';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const resourceItemSchema = z.object({
  id: z.string(),
  title: z.string().default('Resource Template Name'),
  format: z.enum(['pdf', 'xlsx', 'docx', 'zip', 'csv']).default('pdf'),
  fileSize: z.string().default('2.4 MB'),
  category: z.string().default('Toolkits'),
  downloadCount: z.number().default(140),
  downloadUrl: z.string().default('#'),
});

const schema = z.object({
  heading: z.string().default('Resource Vault & Downloadable Toolkits'),
  subtitle: z.string().default('Ready-to-use worksheets, financial models, and operational policies.'),
  resources: z.array(resourceItemSchema).default([]),
}).catchall(z.unknown());

type ResourceVaultProps = z.infer<typeof schema>;

const FORMAT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  xlsx: FileSpreadsheet,
  docx: FileText,
  zip: FolderArchive,
  csv: FileSpreadsheet,
};

registerBlock({
  type: 'portal_resource_vault',
  label: 'Portal: Resource Vault',
  category: 'portal',
  icon: FolderArchive,
  fields: [
    { kind: 'text', key: 'heading', label: 'Section Heading' },
    { kind: 'textarea', key: 'subtitle', label: 'Subtitle' },
    {
      kind: 'list',
      key: 'resources',
      label: 'Downloadable Resources',
      itemFields: [
        { kind: 'text', key: 'title', label: 'Resource Title' },
        {
          kind: 'select',
          key: 'format',
          label: 'File Format',
          options: [
            { value: 'pdf', label: 'PDF Document' },
            { value: 'xlsx', label: 'Excel Spreadsheet' },
            { value: 'docx', label: 'Word Document' },
            { value: 'zip', label: 'ZIP Archive' },
            { value: 'csv', label: 'CSV File' },
          ],
        },
        { kind: 'text', key: 'fileSize', label: 'File Size' },
        { kind: 'text', key: 'category', label: 'Category' },
        { kind: 'number', key: 'downloadCount', label: 'Downloads' },
        { kind: 'text', key: 'downloadUrl', label: 'Download URL' },
      ],
    },
  ],
  defaults: schema.parse({
    heading: 'Resource Vault & Downloadable Toolkits',
    subtitle: 'Ready-to-use worksheets, financial models, and operational policies for your school.',
    resources: [
      { id: '1', title: 'Tuition Fee Recovery Spreadsheet Model (Auto-Formulas)', format: 'xlsx', fileSize: '1.8 MB', category: 'Finance', downloadCount: 320, downloadUrl: '#' },
      { id: '2', title: 'Standard Parent Enrollment Contract & Fee Agreement', format: 'pdf', fileSize: '850 KB', category: 'Legal', downloadCount: 540, downloadUrl: '#' },
      { id: '3', title: 'WhatsApp Parent Notification Sequence Templates', format: 'docx', fileSize: '420 KB', category: 'Communications', downloadCount: 680, downloadUrl: '#' },
    ],
  }),
  schema,
  render: (props: ResourceVaultProps, _block, ctx) => {
    const isDark = ctx.themeMode === 'dark';

    return (
      <section className="py-6 space-y-4 w-full">
        {(props.heading || props.subtitle) && (
          <div className="space-y-1">
            {props.heading && (
              <h3 className="text-xl font-bold tracking-tight text-foreground">{props.heading}</h3>
            )}
            {props.subtitle && (
              <p className="text-xs text-muted-foreground">{props.subtitle}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {props.resources.map(res => {
            const IconComp = FORMAT_ICONS[res.format] || FileText;

            return (
              <div
                key={res.id}
                className={`p-5 rounded-3xl border-2 transition-all flex flex-col justify-between space-y-4 ${
                  isDark ? 'border-white/10 bg-card/60' : 'border-black/10 bg-card shadow-xs'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                      <IconComp className="w-5 h-5" />
                    </div>
                    <Badge variant="outline" className="text-[9px] font-bold uppercase">
                      {res.category}
                    </Badge>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-foreground leading-snug">{res.title}</h4>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Format: <strong className="uppercase text-foreground">{res.format}</strong> • {res.fileSize}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Download className="w-3 h-3" /> {res.downloadCount} downloads
                  </span>

                  <a href={res.downloadUrl} download>
                    <Button size="sm" className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 min-h-[36px]">
                      <ArrowDownToLine className="w-3.5 h-3.5" /> Download
                    </Button>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  },
});
