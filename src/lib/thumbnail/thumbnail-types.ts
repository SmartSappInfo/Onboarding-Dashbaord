// Canvas element types and templates for the thumbnail designer

export interface ElementShadow {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface CanvasElement {
  id: string;
  type: 'text' | 'image' | 'rect' | 'circle' | 'arrow' | 'icon' | 'emoji' | 'svg';
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  width: number; // percentage (0 - 100)
  height: number; // percentage (0 - 100)
  zIndex: number;
  rotation?: number; // degrees
  opacity?: number; // 0 - 1
  isLocked?: boolean;
  isHidden?: boolean;
  groupId?: string;
  iconName?: string;
  maskShape?: 'none' | 'circle' | 'hexagon' | 'squircle';
  
  // Text Specific
  text?: string;
  fontSize?: number; // in relative px or pt
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  fill?: string; // color hex
  textAlign?: 'left' | 'center' | 'right';
  textStrokeColor?: string;
  textStrokeWidth?: number; // in px
  textShadow?: ElementShadow;
  badgeColor?: string; // background banner behind text
  badgeOpacity?: number;
  
  // Image Specific
  imageSrc?: string;
  imageOutlineColor?: string;
  imageOutlineWidth?: number;
  imageShadow?: ElementShadow;
  
  // Shape Specific
  shapeFill?: string;
  shapeStroke?: string;
  shapeStrokeWidth?: number;
  borderRadius?: number;
  textEffect?: 'none' | 'neon' | '3d' | 'gradient' | 'metallic';
  svgPath?: string;
  brightness?: number;
  contrast?: number;
  blurRadius?: number;
  hueRotate?: number;
  saturate?: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'difference';
}

export interface ThumbnailDesign {
  id?: string;
  workspaceId: string;
  name: string;
  backgroundColor: string;
  backgroundGradient?: {
    type: 'linear' | 'radial';
    angle?: number;
    colors: string[]; // e.g. ['#3b0764', '#0f172a']
  };
  backgroundImage?: string;
  elements: CanvasElement[];
  thumbnailUrl?: string; // rendered image link in Firebase Storage
  explanation?: string;
  alternativeCopies?: string[];
  createdAt: string;
  updatedAt: string;
}

export const THUMBNAIL_FONT_OPTIONS: string[] = [
  'Inter', 
  'Impact', 
  'Montserrat', 
  'Outfit', 
  'Arial Black', 
  'Georgia', 
  'Playfair Display'
];

export interface CTRTemplate {
  id: string;
  name: string;
  description: string;
  category: 'business' | 'gaming' | 'finance' | 'podcast' | 'education' | 'general';
  baselineCtr: number;
  backgroundColor: string;
  backgroundGradient?: {
    type: 'linear' | 'radial';
    angle?: number;
    colors: string[];
  };
  backgroundImage?: string;
  elements: CanvasElement[];
}

export const CTR_TEMPLATES: CTRTemplate[] = [
  {
    id: 'reaction-surprise',
    name: 'Reaction / Shock Formula',
    description: 'High CTR: Expressive subject on one side, shocking focal object/chart on the other, bold outlined text.',
    category: 'general',
    baselineCtr: 89,
    backgroundColor: '#0f172a',
    backgroundGradient: {
      type: 'linear' as const,
      angle: 135,
      colors: ['#0f172a', '#3b0764', '#1e1b4b']
    },
    elements: [
      {
        id: 'bg-spotlight',
        type: 'circle' as const,
        x: 65,
        y: 20,
        width: 30,
        height: 50,
        zIndex: 1,
        shapeFill: '#facc15',
        opacity: 0.15,
        borderRadius: 9999
      },
      {
        id: 'subject-face',
        type: 'image' as const,
        x: 60,
        y: 10,
        width: 35,
        height: 80,
        zIndex: 2,
        imageSrc: 'https://picsum.photos/id/1025/400/600',
        imageOutlineColor: '#facc15',
        imageOutlineWidth: 6
      },
      {
        id: 'bold-hook-title',
        type: 'text' as const,
        x: 5,
        y: 20,
        width: 50,
        height: 25,
        zIndex: 3,
        text: 'NEVER DO THIS!',
        fontSize: 48,
        fontFamily: 'Impact',
        fill: '#facc15',
        textAlign: 'center' as const,
        textStrokeColor: '#000000',
        textStrokeWidth: 4
      },
      {
        id: 'sub-hook-tag',
        type: 'text' as const,
        x: 10,
        y: 50,
        width: 40,
        height: 12,
        zIndex: 4,
        text: '5 Costly Mistakes',
        fontSize: 22,
        fontFamily: 'Outfit',
        fill: '#ffffff',
        textAlign: 'center' as const,
        badgeColor: '#ef4444',
        badgeOpacity: 0.9
      },
      {
        id: 'pointing-arrow',
        type: 'arrow' as const,
        x: 45,
        y: 45,
        width: 15,
        height: 15,
        zIndex: 5,
        rotation: 45,
        shapeFill: '#facc15',
        shapeStroke: '#000000',
        shapeStrokeWidth: 2
      }
    ]
  },
  {
    id: 'before-after-split',
    name: 'Before vs After Split Formula',
    description: 'Perfect for transformations: Split screen showcasing a dramatic comparison.',
    category: 'general',
    baselineCtr: 92,
    backgroundColor: '#ffffff',
    elements: [
      {
        id: 'left-before-bg',
        type: 'rect' as const,
        x: 0,
        y: 0,
        width: 50,
        height: 100,
        zIndex: 1,
        shapeFill: '#1e293b'
      },
      {
        id: 'right-after-bg',
        type: 'rect' as const,
        x: 50,
        y: 0,
        width: 50,
        height: 100,
        zIndex: 1,
        shapeFill: '#0f172a'
      },
      {
        id: 'vertical-divider',
        type: 'rect' as const,
        x: 49.5,
        y: 0,
        width: 1,
        height: 100,
        zIndex: 2,
        shapeFill: '#facc15'
      },
      {
        id: 'before-label',
        type: 'text' as const,
        x: 10,
        y: 10,
        width: 30,
        height: 12,
        zIndex: 3,
        text: 'BEFORE',
        fontSize: 24,
        fontFamily: 'Montserrat',
        fill: '#ffffff',
        textAlign: 'center' as const,
        badgeColor: '#ef4444',
        badgeOpacity: 1
      },
      {
        id: 'after-label',
        type: 'text' as const,
        x: 60,
        y: 10,
        width: 30,
        height: 12,
        zIndex: 3,
        text: 'AFTER',
        fontSize: 24,
        fontFamily: 'Montserrat',
        fill: '#ffffff',
        textAlign: 'center' as const,
        badgeColor: '#22c55e',
        badgeOpacity: 1
      },
      {
        id: 'main-title',
        type: 'text' as const,
        x: 5,
        y: 75,
        width: 90,
        height: 20,
        zIndex: 4,
        text: 'INSANE RESULTS!',
        fontSize: 42,
        fontFamily: 'Impact',
        fill: '#ffffff',
        textAlign: 'center' as const,
        textStrokeColor: '#000000',
        textStrokeWidth: 3
      }
    ]
  },
  {
    id: 'one-question-bold',
    name: 'Bold Topic / Big Question',
    description: 'Centered, highly legible question over dynamic visual backgrounds with directional highlights.',
    category: 'education',
    baselineCtr: 86,
    backgroundColor: '#facc15',
    backgroundGradient: {
      type: 'linear' as const,
      angle: 45,
      colors: ['#facc15', '#f97316']
    },
    elements: [
      {
        id: 'glow-spot',
        type: 'circle' as const,
        x: 25,
        y: 15,
        width: 50,
        height: 70,
        zIndex: 1,
        shapeFill: '#ffffff',
        opacity: 0.25,
        borderRadius: 9999
      },
      {
        id: 'question-title',
        type: 'text' as const,
        x: 10,
        y: 25,
        width: 80,
        height: 30,
        zIndex: 3,
        text: 'THE TRUTH ABOUT ONBOARDING?',
        fontSize: 38,
        fontFamily: 'Montserrat',
        fill: '#0f172a',
        textAlign: 'center' as const
      },
      {
        id: 'badge-trigger',
        type: 'text' as const,
        x: 25,
        y: 60,
        width: 50,
        height: 12,
        zIndex: 4,
        text: 'REVEALED IN 5 MINS',
        fontSize: 18,
        fontFamily: 'Outfit',
        fill: '#ffffff',
        textAlign: 'center' as const,
        badgeColor: '#0f172a',
        badgeOpacity: 1
      }
    ]
  },
  {
    id: 'saas-blueprint',
    name: 'SaaS Founder Blueprint',
    description: 'Tech & Business: Big bold text with radial neon background spotlight and guest speaker visual placeholders.',
    category: 'business',
    baselineCtr: 94,
    backgroundColor: '#0c0a09',
    backgroundGradient: {
      type: 'radial' as const,
      colors: ['#311042', '#0c0a09']
    },
    elements: [
      {
        id: 'spot-glow',
        type: 'circle' as const,
        x: 70,
        y: 10,
        width: 25,
        height: 45,
        zIndex: 1,
        shapeFill: '#a855f7',
        opacity: 0.25,
        borderRadius: 9999
      },
      {
        id: 'title-neon',
        type: 'text' as const,
        x: 5,
        y: 20,
        width: 60,
        height: 25,
        zIndex: 3,
        text: 'I BUILT A SAAS',
        fontSize: 44,
        fontFamily: 'Impact',
        fill: '#facc15',
        textEffect: 'neon',
        textAlign: 'left' as const
      },
      {
        id: 'badge-days',
        type: 'text' as const,
        x: 5,
        y: 50,
        width: 35,
        height: 12,
        zIndex: 4,
        text: 'IN JUST 30 DAYS',
        fontSize: 20,
        fontFamily: 'Outfit',
        fill: '#ffffff',
        badgeColor: '#9333ea',
        badgeOpacity: 0.9,
        textAlign: 'center' as const
      },
      {
        id: 'avatar-speaker',
        type: 'image' as const,
        x: 65,
        y: 15,
        width: 30,
        height: 75,
        zIndex: 2,
        imageSrc: 'https://picsum.photos/id/1012/400/600',
        imageOutlineColor: '#a855f7',
        imageOutlineWidth: 5
      }
    ]
  },
  {
    id: 'finance-trend-alert',
    name: 'Chart Breakout Trend Alert',
    description: 'Finance & Money: High-contrast upward breakout visual overlays with bold percentage gains indicators.',
    category: 'finance',
    baselineCtr: 95,
    backgroundColor: '#020617',
    backgroundGradient: {
      type: 'linear' as const,
      angle: 180,
      colors: ['#020617', '#0f172a']
    },
    elements: [
      {
        id: 'metric-gain',
        type: 'text' as const,
        x: 5,
        y: 20,
        width: 55,
        height: 30,
        zIndex: 3,
        text: '$10,000/MO',
        fontSize: 52,
        fontFamily: 'Anton',
        fill: '#22c55e',
        textEffect: 'metallic',
        textAlign: 'center' as const,
        textStrokeColor: '#000000',
        textStrokeWidth: 5
      },
      {
        id: 'sub-gain',
        type: 'text' as const,
        x: 10,
        y: 55,
        width: 45,
        height: 12,
        zIndex: 4,
        text: 'EASY COPY-PASTE METHOD',
        fontSize: 18,
        fontFamily: 'Outfit',
        fill: '#ffffff',
        badgeColor: '#1e293b',
        badgeOpacity: 0.9,
        textAlign: 'center' as const
      },
      {
        id: 'trend-arrow',
        type: 'arrow' as const,
        x: 65,
        y: 40,
        width: 25,
        height: 25,
        zIndex: 2,
        rotation: -45,
        shapeFill: '#22c55e',
        shapeStroke: '#ffffff',
        shapeStrokeWidth: 3
      }
    ]
  },
  {
    id: 'versus-combat-grid',
    name: 'Versus Niche Battle Grid',
    description: 'Gaming & Battles: Fire red vs ice blue split comparative overlay with centered metallic VS badge.',
    category: 'gaming',
    baselineCtr: 90,
    backgroundColor: '#09090b',
    elements: [
      {
        id: 'left-red-side',
        type: 'rect' as const,
        x: 0,
        y: 0,
        width: 50,
        height: 100,
        zIndex: 1,
        shapeFill: '#7f1d1d'
      },
      {
        id: 'right-blue-side',
        type: 'rect' as const,
        x: 50,
        y: 0,
        width: 50,
        height: 100,
        zIndex: 1,
        shapeFill: '#1e3a8a'
      },
      {
        id: 'title-vs',
        type: 'text' as const,
        x: 40,
        y: 35,
        width: 20,
        height: 25,
        zIndex: 4,
        text: 'VS',
        fontSize: 58,
        fontFamily: 'Impact',
        fill: '#facc15',
        textEffect: 'metallic',
        textAlign: 'center' as const,
        textStrokeColor: '#000000',
        textStrokeWidth: 5
      },
      {
        id: 'header-left',
        type: 'text' as const,
        x: 5,
        y: 10,
        width: 40,
        height: 12,
        zIndex: 3,
        text: 'PRO BUILD',
        fontSize: 22,
        fontFamily: 'Montserrat',
        fill: '#ffffff',
        textAlign: 'center' as const
      },
      {
        id: 'header-right',
        type: 'text' as const,
        x: 55,
        y: 10,
        width: 40,
        height: 12,
        zIndex: 3,
        text: 'NOOB BUILD',
        fontSize: 22,
        fontFamily: 'Montserrat',
        fill: '#ffffff',
        textAlign: 'center' as const
      }
    ]
  },
  {
    id: 'podcast-spotlight-glow',
    name: 'Podcast Speaker Spotlight',
    description: 'Podcast & Interviews: Centered guest speakers character cards wrapped in deep gradient backdrops.',
    category: 'podcast',
    baselineCtr: 88,
    backgroundColor: '#18001d',
    backgroundGradient: {
      type: 'radial' as const,
      colors: ['#4a044e', '#09000a']
    },
    elements: [
      {
        id: 'podcast-guest',
        type: 'image' as const,
        x: 60,
        y: 15,
        width: 32,
        height: 75,
        zIndex: 2,
        imageSrc: 'https://picsum.photos/id/1027/400/600',
        imageOutlineColor: '#db2777',
        imageOutlineWidth: 6
      },
      {
        id: 'title-secret',
        type: 'text' as const,
        x: 5,
        y: 25,
        width: 50,
        height: 25,
        zIndex: 3,
        text: 'THE SECRET TO SUCCESS',
        fontSize: 34,
        fontFamily: 'Montserrat',
        fill: '#ffffff',
        textAlign: 'left' as const,
        textStrokeColor: '#000000',
        textStrokeWidth: 2
      },
      {
        id: 'ep-badge',
        type: 'text' as const,
        x: 5,
        y: 10,
        width: 25,
        height: 10,
        zIndex: 4,
        text: 'EPISODE 42',
        fontSize: 16,
        fontFamily: 'Outfit',
        fill: '#facc15',
        badgeColor: '#000000',
        badgeOpacity: 0.8,
        textAlign: 'center' as const
      }
    ]
  },
  {
    id: 'stop-mistake-warning',
    name: 'Stop Mistake Caution Warning',
    description: 'Education & Advice: Danger indicators caution signs with giant bold red outlined stop tags.',
    category: 'education',
    baselineCtr: 91,
    backgroundColor: '#1c1917',
    elements: [
      {
        id: 'caution-triangle',
        type: 'svg' as const,
        x: 65,
        y: 20,
        width: 25,
        height: 50,
        zIndex: 2,
        svgPath: 'M50 10 L90 90 L10 90 Z',
        shapeFill: '#eab308',
        shapeStroke: '#000000',
        shapeStrokeWidth: 3
      },
      {
        id: 'title-stop',
        type: 'text' as const,
        x: 5,
        y: 25,
        width: 55,
        height: 30,
        zIndex: 3,
        text: 'STOP DOING THIS!',
        fontSize: 48,
        fontFamily: 'Impact',
        fill: '#ef4444',
        textAlign: 'center' as const,
        textStrokeColor: '#000000',
        textStrokeWidth: 5
      },
      {
        id: 'sub-alert',
        type: 'text' as const,
        x: 10,
        y: 60,
        width: 45,
        height: 12,
        zIndex: 4,
        text: 'REVEALED AND FIXED',
        fontSize: 18,
        fontFamily: 'Outfit',
        fill: '#ffffff',
        badgeColor: '#eab308',
        badgeOpacity: 0.95,
        textAlign: 'center' as const
      }
    ]
  }
];

export interface BrandKit {
  colors: string[];
  fontFamily: string;
  watermarkUrl?: string;
}

export interface DesignComment {
  id: string;
  authorName: string;
  authorEmail: string;
  text: string;
  timestamp: string;
  resolved?: boolean;
}

export interface ActivityLog {
  id: string;
  user: string;
  action: string;
  time: string;
}

export function makeUniqueId(): string {
  return `el-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}
