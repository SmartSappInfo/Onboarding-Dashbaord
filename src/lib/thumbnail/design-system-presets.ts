export interface FontPairing {
  name: string;
  headline: string;
  sub: string;
}

export interface ShapePreset {
  id: string;
  name: string;
  path: string;
}

export const FONT_PAIRINGS: FontPairing[] = [
  { name: 'Viral Punch', headline: 'Impact', sub: 'Montserrat' },
  { name: 'Gaming Neon', headline: 'Luckiest Guy', sub: 'Poppins' },
  { name: 'Modern Minimal', headline: 'League Spartan', sub: 'Inter' },
  { name: 'Finance Bold', headline: 'Bebas Neue', sub: 'Montserrat' },
  { name: 'Podcast Classic', headline: 'Anton', sub: 'Figtree' }
];

export const SHAPE_PATH_REGISTRY: ShapePreset[] = [
  { 
    id: 'star-5', 
    name: '5-Point Star', 
    path: 'M50 0 L63 38 L100 38 L70 60 L82 100 L50 75 L18 100 L30 60 L0 38 L37 38 Z' 
  },
  { 
    id: 'speech-bubble', 
    name: 'Speech Bubble', 
    path: 'M10 10 H90 V70 H40 L20 90 V70 H10 Z' 
  },
  { 
    id: 'hexagon-flat', 
    name: 'Flat Hexagon', 
    path: 'M50 0 L100 25 L100 75 L50 100 L0 75 L0 25 Z' 
  },
  { 
    id: 'badge-banner', 
    name: 'Banner Badge', 
    path: 'M0 20 L25 0 H75 L100 20 V80 L75 100 H25 L0 80 Z' 
  },
  { 
    id: 'triangle-pointing', 
    name: 'Indicator Triangle', 
    path: 'M50 0 L100 100 H0 Z' 
  }
];

export function getEffectStyle(
  effect: 'none' | 'neon' | '3d' | 'gradient' | 'metallic',
  baseColor: string
): {
  textShadow?: string;
  WebkitBackgroundClip?: string;
  WebkitTextFillColor?: string;
  background?: string;
  fill?: string;
} {
  switch (effect) {
    case 'neon':
      return {
        textShadow: `0 0 5px ${baseColor}, 0 0 10px ${baseColor}, 0 0 20px ${baseColor}`
      };
    case '3d':
      return {
        textShadow: '1px 1px 0px #000000, 2px 2px 0px #000000, 3px 3px 0px #000000, 4px 4px 0px #000000, 5px 5px 0px #000000'
      };
    case 'gradient':
      return {
        background: 'linear-gradient(to bottom, #ffffff, #facc15)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
      };
    case 'metallic':
      return {
        background: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 25%, #94a3b8 50%, #cbd5e1 75%, #e2e8f0 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
      };
    default:
      return {};
  }
}
