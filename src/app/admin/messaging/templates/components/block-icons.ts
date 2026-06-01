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
    CalendarCheck
} from 'lucide-react';

export const blockIcons: Record<string, React.ComponentType<any>> = {
    heading: Heading1,
    text: Type,
    list: List,
    image: ImageIcon,
    video: Video,
    button: MousePointer2,
    quote: Quote,
    divider: Square,
    header: Layout,
    footer: Layout,
    logo: Trophy,
    'score-card': Trophy,
    columns: Layout,
    rsvp: CalendarCheck
};
