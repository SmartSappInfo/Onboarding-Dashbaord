import React from 'react';
import { z } from 'zod';
import { Sparkles, Send, Bot, User } from 'lucide-react';
import { registerBlock } from '../../registry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const schema = z.object({
  title: z.string().default('AI Academy Learning Assistant'),
  tagline: z.string().default('Ask questions about lessons, fee recovery strategies, or school policies.'),
  suggestedPrompts: z.array(z.string()).default([]),
  placeholder: z.string().default('How do I configure automatic payment receipts?'),
}).catchall(z.unknown());

type AiTutorProps = z.infer<typeof schema>;

registerBlock({
  type: 'portal_ai_tutor',
  label: 'Portal: AI Learning Assistant',
  category: 'portal',
  icon: Sparkles,
  fields: [
    { kind: 'text', key: 'title', label: 'Assistant Title' },
    { kind: 'textarea', key: 'tagline', label: 'Tagline' },
    {
      kind: 'list',
      key: 'suggestedPrompts',
      label: 'Suggested Questions',
      itemFields: [{ kind: 'text', key: 'prompt', label: 'Question' }],
    },
    { kind: 'text', key: 'placeholder', label: 'Input Placeholder' },
  ],
  defaults: schema.parse({
    title: 'AI Academy Learning Assistant',
    tagline: 'Grounded in our official course material, guidelines, and templates.',
    suggestedPrompts: [
      'What is the recommended WhatsApp cadence for tuition reminders?',
      'How do I calculate mid-term fee recovery rates?',
      'Show me the parent agreement clause for installment payments',
    ],
    placeholder: 'Ask any question about this portal...',
  }),
  schema,
  render: (props: AiTutorProps, _block, ctx) => {
    const isDark = ctx.themeMode === 'dark';

    return (
      <div
        className={`p-6 rounded-3xl border-2 transition-all space-y-4 max-w-xl mx-auto ${
          isDark ? 'border-primary/30 bg-card/80' : 'border-primary/20 bg-card shadow-md'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-xs shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-extrabold text-base text-foreground leading-tight flex items-center gap-1.5">
              {props.title}
              <Sparkles className="w-4 h-4 text-primary" />
            </h4>
            <p className="text-xs text-muted-foreground">{props.tagline}</p>
          </div>
        </div>

        <div className="space-y-1.5 pt-2">
          <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">
            Suggested Queries:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {props.suggestedPrompts.map((p, idx) => {
              const text = typeof p === 'string' ? p : (p as any).prompt;
              return (
                <button
                  key={idx}
                  type="button"
                  className="text-left text-[11px] px-3 py-1.5 rounded-xl border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                >
                  "{text}"
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Input
            placeholder={props.placeholder}
            className="h-11 rounded-xl text-xs bg-background"
            disabled={ctx.mode === 'edit'}
          />
          <Button
            size="icon"
            className="h-11 w-11 rounded-xl bg-primary text-white hover:bg-primary/90 shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  },
});
