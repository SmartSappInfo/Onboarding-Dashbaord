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

export const CTR_TEMPLATES = [
  {
    id: 'reaction-surprise',
    name: 'Reaction / Shock Formula',
    description: 'High CTR: Expressive subject on one side, shocking focal object/chart on the other, bold outlined text.',
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
        imageOutlineWidth: 6,
        imageShadow: { color: '#000000', blur: 15, offsetX: 5, offsetY: 5 }
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
        textStrokeWidth: 4,
        textShadow: { color: '#000000', blur: 10, offsetX: 4, offsetY: 4 }
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
        badgeOpacity: 0.9,
        textShadow: { color: '#000000', blur: 5, offsetX: 2, offsetY: 2 }
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
        textStrokeWidth: 3,
        textShadow: { color: '#000000', blur: 10, offsetX: 3, offsetY: 3 }
      }
    ]
  },
  {
    id: 'one-question-bold',
    name: 'Bold Topic / Big Question',
    description: 'Centered, highly legible question over dynamic visual backgrounds with directional highlights.',
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
        textAlign: 'center' as const,
        textShadow: { color: '#ffffff', blur: 10, offsetX: 0, offsetY: 0 }
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
        badgeOpacity: 1,
        textShadow: { color: '#000000', blur: 5, offsetX: 1, offsetY: 1 }
      }
    ]
  }
];

export function makeUniqueId(): string {
  return `el-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}
