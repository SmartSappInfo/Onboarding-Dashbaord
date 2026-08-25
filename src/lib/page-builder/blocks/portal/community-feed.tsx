import React from 'react';
import { z } from 'zod';
import { Users, MessageSquare, ThumbsUp, Sparkles, ArrowRight } from 'lucide-react';
import { registerBlock } from '../../registry';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

const postSchema = z.object({
  id: z.string(),
  authorName: z.string().default('Author'),
  authorRole: z.string().default('Member'),
  avatarUrl: z.string().default(''),
  topic: z.string().default('Discussion'),
  title: z.string().default('Post Title'),
  preview: z.string().default('Post snippet preview.'),
  likesCount: z.number().default(12),
  commentsCount: z.number().default(4),
  timeAgo: z.string().default('2h ago'),
});

const schema = z.object({
  heading: z.string().default('Community Discussions & Q&A'),
  subtitle: z.string().default('Collaborate and exchange strategies with fellow administrators.'),
  posts: z.array(postSchema).default([]),
  ctaText: z.string().default('Join the Community Feed'),
  ctaHref: z.string().default('#'),
}).catchall(z.unknown());

type CommunityFeedProps = z.infer<typeof schema>;

registerBlock({
  type: 'portal_community_feed',
  label: 'Portal: Community Feed Teaser',
  category: 'portal',
  icon: Users,
  fields: [
    { kind: 'text', key: 'heading', label: 'Section Heading' },
    { kind: 'textarea', key: 'subtitle', label: 'Subtitle' },
    {
      kind: 'list',
      key: 'posts',
      label: 'Sample Posts',
      itemFields: [
        { kind: 'text', key: 'authorName', label: 'Author Name' },
        { kind: 'text', key: 'authorRole', label: 'Author Role' },
        { kind: 'image', key: 'avatarUrl', label: 'Avatar URL' },
        { kind: 'text', key: 'topic', label: 'Topic Tag' },
        { kind: 'text', key: 'title', label: 'Post Title' },
        { kind: 'textarea', key: 'preview', label: 'Preview Content' },
        { kind: 'number', key: 'likesCount', label: 'Likes' },
        { kind: 'number', key: 'commentsCount', label: 'Comments' },
        { kind: 'text', key: 'timeAgo', label: 'Time Ago' },
      ],
    },
    { kind: 'text', key: 'ctaText', label: 'CTA Button Text' },
    { kind: 'text', key: 'ctaHref', label: 'CTA Button Link' },
  ],
  defaults: schema.parse({
    heading: 'Community Discussions & Peer Support',
    subtitle: 'Engage directly with school directors, bursars, and educational leaders.',
    posts: [
      {
        id: '1',
        authorName: 'Emmanuel Osei',
        authorRole: 'Headmaster, Ridgecrest Academy',
        avatarUrl: '',
        topic: 'Tuition Policies',
        title: 'How we achieved 94% fee recovery before mid-term exams',
        preview: 'By switching our reminder cadence to automated WhatsApp templates 7 days prior to due dates, parent payment compliance surged...',
        likesCount: 28,
        commentsCount: 9,
        timeAgo: '3h ago',
      },
      {
        id: '2',
        authorName: 'Abena Mensah',
        authorRole: 'Finance Director, Morning Star',
        avatarUrl: '',
        topic: 'Momo Automation',
        title: 'Best practice: Linking USSD codes to parent student IDs',
        preview: 'Here is our step-by-step procedure for ensuring every MoMo transaction automatically reconciles with the student profile...',
        likesCount: 42,
        commentsCount: 15,
        timeAgo: '1d ago',
      },
    ],
  }),
  schema,
  render: (props: CommunityFeedProps, _block, ctx) => {
    const isDark = ctx.themeMode === 'dark';

    return (
      <section className="py-6 space-y-4 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-foreground">{props.heading}</h3>
            {props.subtitle && <p className="text-xs text-muted-foreground">{props.subtitle}</p>}
          </div>

          {props.ctaText && (
            <a href={props.ctaHref} className="self-start sm:self-auto">
              <Button variant="outline" size="sm" className="rounded-xl font-bold text-xs gap-1.5 min-h-[38px]">
                <Users className="w-3.5 h-3.5" /> {props.ctaText}
              </Button>
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {props.posts.map(post => (
            <div
              key={post.id}
              className={`p-5 rounded-3xl border-2 transition-all space-y-3 ${
                isDark ? 'border-white/10 bg-card/60' : 'border-black/10 bg-card shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="w-9 h-9 border border-border">
                    <AvatarImage src={post.avatarUrl} alt={post.authorName} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                      {post.authorName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h5 className="font-bold text-xs text-foreground leading-none">{post.authorName}</h5>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{post.authorRole}</p>
                  </div>
                </div>

                <Badge variant="secondary" className="text-[9px] uppercase font-bold">
                  {post.topic}
                </Badge>
              </div>

              <div>
                <h4 className="font-bold text-sm text-foreground leading-snug">{post.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                  {post.preview}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
                <span className="text-[10px]">{post.timeAgo}</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 font-semibold">
                    <ThumbsUp className="w-3 h-3 text-primary" /> {post.likesCount}
                  </span>
                  <span className="flex items-center gap-1 font-semibold">
                    <MessageSquare className="w-3 h-3 text-muted-foreground" /> {post.commentsCount}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  },
});
