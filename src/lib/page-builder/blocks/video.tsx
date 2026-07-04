import { z } from 'zod';
import { Film } from 'lucide-react';
import VideoEmbed from '@/components/video-embed';
import { registerBlock } from '../registry';

const schema = z.object({
  url: z.string().default(''),
  provider: z.enum(['youtube', 'vimeo', 'loom']).default('youtube'),
  thumbnailUrl: z.string().default(''),
});
type VideoProps = z.infer<typeof schema>;

registerBlock({
  type: 'video',
  label: 'Video',
  category: 'content',
  icon: Film,
  fields: [
    { kind: 'url', key: 'url', label: 'Video URL', placeholder: 'https://youtube.com/watch?v=…' },
    { kind: 'select', key: 'provider', label: 'Provider', options: [
      { value: 'youtube', label: 'YouTube' },
      { value: 'vimeo', label: 'Vimeo' },
      { value: 'loom', label: 'Loom' },
    ] },
    { kind: 'image', key: 'thumbnailUrl', label: 'Thumbnail URL' },
  ],
  defaults: schema.parse({}),
  schema,
  render: (props: VideoProps, _block, ctx) => {
    if (!props.url) {
      if (ctx.mode !== 'edit') return <></>;
      return (
        <div className="h-40 bg-slate-900 rounded-xl flex flex-col items-center justify-center gap-2">
          <Film className="w-8 h-8 text-slate-600" />
          <span className="text-xs text-slate-500 font-medium">Add a video URL</span>
        </div>
      );
    }
    return (
      <div className="rounded-2xl overflow-hidden border border-black/10 shadow-sm aspect-video bg-black relative">
        <VideoEmbed url={props.url} thumbnailUrl={props.thumbnailUrl || undefined} />
      </div>
    );
  },
});
