import React from 'react';
import { z } from 'zod';
import { Calendar, Video, Clock, User, ArrowRight } from 'lucide-react';
import { registerBlock } from '../../registry';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const eventItemSchema = z.object({
  id: z.string(),
  title: z.string().default('Live Session Title'),
  host: z.string().default('Dr. Sarah Mensah'),
  date: z.string().default('Friday, March 20, 2026'),
  time: z.string().default('3:00 PM GMT'),
  platform: z.enum(['zoom', 'google_meet', 'webinar']).default('zoom'),
  badge: z.string().default('Live Q&A'),
  joinUrl: z.string().default('#'),
});

const schema = z.object({
  heading: z.string().default('Live Classes & Executive Coaching'),
  subtitle: z.string().default('Interactive Zoom and Google Meet sessions with educational leaders.'),
  events: z.array(eventItemSchema).default([]),
}).catchall(z.unknown());

type UpcomingEventsProps = z.infer<typeof schema>;

registerBlock({
  type: 'portal_upcoming_events',
  label: 'Portal: Upcoming Live Events',
  category: 'portal',
  icon: Calendar,
  fields: [
    { kind: 'text', key: 'heading', label: 'Section Heading' },
    { kind: 'textarea', key: 'subtitle', label: 'Subtitle' },
    {
      kind: 'list',
      key: 'events',
      label: 'Live Events',
      itemFields: [
        { kind: 'text', key: 'title', label: 'Event Title' },
        { kind: 'text', key: 'host', label: 'Host Name' },
        { kind: 'text', key: 'date', label: 'Date' },
        { kind: 'text', key: 'time', label: 'Time' },
        {
          kind: 'select',
          key: 'platform',
          label: 'Platform',
          options: [
            { value: 'zoom', label: 'Zoom Meeting' },
            { value: 'google_meet', label: 'Google Meet' },
            { value: 'webinar', label: 'Live Webinar' },
          ],
        },
        { kind: 'text', key: 'badge', label: 'Badge' },
        { kind: 'text', key: 'joinUrl', label: 'Join / Register Link' },
      ],
    },
  ],
  defaults: schema.parse({
    heading: 'Live Classes & Executive Coaching',
    subtitle: 'Interactive Zoom and Google Meet sessions with senior educational strategists.',
    events: [
      {
        id: '1',
        title: 'Mastering Term 2 Tuition Debt Recovery',
        host: 'Joseph Aidoo & Chief Revenue Team',
        date: 'Thursday, March 26, 2026',
        time: '4:00 PM GMT',
        platform: 'zoom',
        badge: 'Live Workshop',
        joinUrl: '#',
      },
      {
        id: '2',
        title: 'Digital Admissions & Marketing Office Hours',
        host: 'Sarah Mensah, Head of Growth',
        date: 'Tuesday, March 31, 2026',
        time: '2:30 PM GMT',
        platform: 'google_meet',
        badge: 'Coaching Call',
        joinUrl: '#',
      },
    ],
  }),
  schema,
  render: (props: UpcomingEventsProps, _block, ctx) => {
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {props.events.map(event => (
            <div
              key={event.id}
              className={`p-5 rounded-3xl border-2 transition-all flex flex-col justify-between space-y-4 ${
                isDark ? 'border-white/10 bg-card/60' : 'border-black/10 bg-card shadow-xs'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] font-bold uppercase rounded-full">
                    {event.badge}
                  </Badge>
                  <span className="text-[10px] font-semibold text-primary uppercase flex items-center gap-1">
                    <Video className="w-3 h-3" /> {event.platform.replace('_', ' ')}
                  </span>
                </div>

                <h4 className="font-bold text-base text-foreground leading-snug">{event.title}</h4>

                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-muted-foreground" /> Host: {event.host}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/60">
                <div className="text-[11px] text-muted-foreground">
                  <p className="font-bold text-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-primary" /> {event.date}
                  </p>
                  <p className="flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" /> {event.time}
                  </p>
                </div>

                <a href={event.joinUrl}>
                  <Button size="sm" className="rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 gap-1.5 min-h-[38px]">
                    Join Room <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  },
});
