import * as React from 'react';
import { 
    Heading1, 
    Type, 
    Image as ImageIcon, 
    Video, 
    MousePointer2, 
    Quote, 
    List, 
    Trophy,
    Layout,
    Square,
    CalendarCheck,
    Volume2,
    Layers2
} from 'lucide-react';

/**
 * PURPOSE: Central registry mapping MessageBlock type keys to Lucide icons.
 * Used in template workshop sidebar, canvas block wrappers, and block selector menus.
 *
 * CAUTION: When adding a new block type to MessageBlock in types.ts, add its icon here too.
 * RELATED SURFACES: template-workshop.tsx, visual-block.tsx, block-inspector.tsx.
 */
export const blockIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    heading: Heading1,
    text: Type,
    list: List,
    image: ImageIcon,
    video: Video,
    audio: Volume2,
    button: MousePointer2,
    'dual-button': Layers2,
    quote: Quote,
    divider: Square,
    header: Layout,
    footer: Layout,
    logo: Trophy,
    'score-card': Trophy,
    columns: Layout,
    rsvp: CalendarCheck
};
