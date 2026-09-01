// Canvas element types and utilities for the poster designer

export interface CanvasElement {
  type: 'text' | 'qr' | 'rect' | 'circle' | 'line' | 'image';
  id: string;
  x: number; // percentage 0-100
  y: number;
  width: number;
  height: number;
  // Text
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  fill?: string;
  textAlign?: string;
  // Shape
  shapeFill?: string;
  shapeStroke?: string;
  shapeStrokeWidth?: number;
  borderRadius?: number;
  opacity?: number;
  // QR
  isQR?: boolean;
  // Image
  imageSrc?: string;
  // Line
  lineColor?: string;
  lineWidth?: number;
  // Interaction & Layering
  selected?: boolean;
  rotation?: number;
  isLocked?: boolean;
}

export interface CanvasState {
  width: number;
  height: number;
  backgroundColor: string;
  elements: CanvasElement[];
  selectedId: string | null;
}

export const CANVAS_PRESETS = [
  { label: 'Portrait Poster (600×800)', w: 600, h: 800 },
  { label: 'Square Social (600×600)', w: 600, h: 600 },
  { label: 'A4 Flyer (595×842)', w: 595, h: 842 },
  { label: 'US Letter (612×792)', w: 612, h: 792 },
  { label: 'Story / Mobile (540×960)', w: 540, h: 960 },
  { label: 'Table Tent (400×600)', w: 400, h: 600 },
  { label: 'ID / Event Badge (350×200)', w: 350, h: 200 },
];

export const FONT_OPTIONS = ['Inter', 'Georgia', 'Arial', 'Courier New', 'Times New Roman', 'Impact', 'Trebuchet MS'];

export function makeId() {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function newTextElement(overrides?: Partial<CanvasElement>): CanvasElement {
  return {
    type: 'text',
    id: makeId(),
    x: 20,
    y: 50,
    width: 60,
    height: 6,
    text: 'New Text',
    fontSize: 18,
    fontFamily: 'Inter',
    fontWeight: '600',
    fill: '#1a1a1a',
    textAlign: 'center',
    ...overrides,
  };
}

export function newRectElement(overrides?: Partial<CanvasElement>): CanvasElement {
  return {
    type: 'rect',
    id: makeId(),
    x: 20,
    y: 50,
    width: 40,
    height: 10,
    shapeFill: '#e0e0e0',
    borderRadius: 8,
    opacity: 1,
    ...overrides,
  };
}

export function newCircleElement(overrides?: Partial<CanvasElement>): CanvasElement {
  return {
    type: 'circle',
    id: makeId(),
    x: 30,
    y: 45,
    width: 15,
    height: 15,
    shapeFill: '#d0d0d0',
    opacity: 1,
    ...overrides,
  };
}

export function newLineElement(overrides?: Partial<CanvasElement>): CanvasElement {
  return {
    type: 'line',
    id: makeId(),
    x: 10,
    y: 50,
    width: 80,
    height: 0.5,
    lineColor: '#999999',
    lineWidth: 2,
    ...overrides,
  };
}

export function newImageElement(src: string, overrides?: Partial<CanvasElement>): CanvasElement {
  return {
    type: 'image',
    id: makeId(),
    x: 20,
    y: 30,
    width: 30,
    height: 25,
    imageSrc: src,
    opacity: 1,
    borderRadius: 0,
    ...overrides,
  };
}
