import React from 'react';
import { z } from 'zod';
import { Sparkles, ArrowRight, BookOpen, FileText, Newspaper } from 'lucide-react';
import { registerBlock } from '../../registry';
import { Badge } from '@/components/ui/badge';

const relatedItemSchema = z.object({
  id: z.string(),
  type: z.enum(['article', 'documentation', 'lesson', 'resource']).default('article'),
  title: z.string().default('Related Article Title'),
  category: z.string().default('Operations'),
  readingTime: z.string().default('5 min read'),
  href: z.string().default('#'),
});

const schema = z.object({
  heading: z.string().default('Recommended Next Steps & Reading'),
  items: z.array(relatedItemSchema).default([]),
}).catchall(z.unknown());

type RelatedContentProps = z.infer<typeof schema>;

registerBlock({
  type: 'portal_related_content',
  label: 'Portal: Related Content Recommendations',
  category: 'portal',
  icon: Sparkles,
  fields: [
    { kind: 'text', key: 'heading', label: 'Section Heading' },
    {
      kind: 'list',
      key: 'items',
      label: 'Recommended Items',
      itemFields: [
        {
          kind: 'select',
          key: 'type',
          label: 'Type',
          options: [
            { value: 'article', label: 'Article / Blog' },
            { value: 'documentation', label: 'Documentation' },
            { value: 'lesson', label: 'Course Lesson' },
            { value: 'resource', label: 'Downloadable Resource' },
          ],
        },
        { kind: 'text', key: 'title', label: 'Title' },
        { kind: 'text', key: 'category', label: 'Category' },
        { kind: 'text', key: 'readingTime', label: 'Reading Time / Format' },
        { kind: 'text', key: 'href', label: 'Link URL' },
      ],
    },
  ],
  defaults: schema.parse({
    heading: 'Recommended Next Steps & Reading',
    items: [
      { id: '1', type: 'article', title: '5 Automated WhatsApp Templates for Fee Recovery', category: 'Case Study', readingTime: '4 min read', href: '#' },
      { id: '2', type: 'documentation', title: 'Step-by-step Setup Guide for MoMo Instant Reconciliation', category: 'Technical Guide', readingTime: '8 min read', href: '#' },
      { id: '3', type: 'resource', title: 'Parent Tuition Agreement Contract Template (PDF & Docx)', category: 'Download', readingTime: 'PDF Toolkit', href: '#' },
    ],
  }),
  schema,
  render: (props: RelatedContentProps, _block, ctx) => {
    const isDark = ctx.themeMode === 'dark';

    return (
      <section className="py-6 space-y-4 w-full">
        {props.heading && (
          <h4 className="text-base font-bold tracking-tight text-foreground">{props.heading}</h4>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {props.items.map(item => (
            <a
              key={item.id}
              href={item.href}
              className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between space-y-3 hover:border-primary/40 hover:shadow-md ${
                isDark ? 'border-white/10 bg-card/60' : 'border-black/10 bg-card shadow-xs'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[9px] font-bold uppercase">
                    {item.category}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{item.readingTime}</span>
                </div>
                <h5 className="font-bold text-xs text-foreground line-clamp-2 leading-snug">
                  {item.title}
                </h5>
              </div>

              <div className="text-[11px] font-bold text-primary flex items-center gap-1 pt-2 border-t border-border/40">
                Explore Now <ArrowRight className="w-3 h-3" />
              </div>
            </a>
          ))}
        </div>
      </section>
    );
  },
});
