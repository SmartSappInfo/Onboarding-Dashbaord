// Poster template definitions for the QR Canvas Designer

/**
 * Poster Template definitions for the QR Canvas Designer.
 * Each template is a serialized Fabric.js-compatible JSON structure
 * that can be loaded onto a canvas.
 */

export interface PosterTemplate {
  id: string;
  name: string;
  category: 'social' | 'business' | 'restaurant' | 'utility' | 'custom';
  description: string;
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  elements: PosterElement[];
  scope: 'system' | 'workspace';
}

export interface PosterElement {
  type: 'text' | 'qr' | 'rect' | 'circle' | 'image';
  id: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage
  height: number; // percentage
  // Text props
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  fill?: string;
  textAlign?: string;
  // Shape props
  shapeFill?: string;
  shapeStroke?: string;
  shapeStrokeWidth?: number;
  borderRadius?: number;
  opacity?: number;
  // QR-specific
  isQR?: boolean;
}

// ─────────────────────────────────────────────────
// System Seed Templates
// ─────────────────────────────────────────────────

export const SYSTEM_POSTER_TEMPLATES: PosterTemplate[] = [
  // Template 1: Social Media Follow (Clean White)
  {
    id: 'tpl-social-follow',
    name: 'Social Media Follow',
    category: 'social',
    description: 'Clean white poster for social media promotion',
    canvasWidth: 600,
    canvasHeight: 800,
    backgroundColor: '#FFFFFF',
    scope: 'system',
    elements: [
      {
        type: 'text', id: 'heading-1', x: 10, y: 5, width: 80, height: 6,
        text: 'SCAN TO FOLLOW US ON', fontSize: 18, fontFamily: 'Inter',
        fontWeight: '400', fill: '#1a1a1a', textAlign: 'center',
      },
      {
        type: 'text', id: 'heading-2', x: 10, y: 11, width: 80, height: 10,
        text: 'social media', fontSize: 42, fontFamily: 'Georgia',
        fontWeight: '400', fontStyle: 'italic', fill: '#1a1a1a', textAlign: 'center',
      },
      {
        type: 'qr', id: 'qr-code', x: 20, y: 24, width: 60, height: 45,
        isQR: true,
      },
      {
        type: 'text', id: 'cta', x: 10, y: 72, width: 80, height: 5,
        text: 'FOLLOW  |  LIKE  |  TAG', fontSize: 16, fontFamily: 'Inter',
        fontWeight: '700', fill: '#1a1a1a', textAlign: 'center',
      },
      {
        type: 'text', id: 'handle', x: 10, y: 79, width: 80, height: 5,
        text: '@yourbusinessname', fontSize: 18, fontFamily: 'Georgia',
        fontWeight: '400', fontStyle: 'italic', fill: '#555555', textAlign: 'center',
      },
      {
        type: 'rect', id: 'divider', x: 30, y: 86, width: 40, height: 0.3,
        shapeFill: '#e0e0e0',
      },
      {
        type: 'text', id: 'footer', x: 10, y: 90, width: 80, height: 5,
        text: 'Connect with us on all platforms', fontSize: 12, fontFamily: 'Inter',
        fontWeight: '400', fill: '#999999', textAlign: 'center',
      },
    ],
  },

  // Template 2: Appointment Booking (Minimalist)
  {
    id: 'tpl-appointment',
    name: 'Appointment Booking',
    category: 'business',
    description: 'Minimalist card for booking appointments',
    canvasWidth: 500,
    canvasHeight: 700,
    backgroundColor: '#FAF5F0',
    scope: 'system',
    elements: [
      {
        type: 'rect', id: 'accent-shape', x: 60, y: -5, width: 50, height: 35,
        shapeFill: '#E8B4B8', opacity: 0.4, borderRadius: 100,
      },
      {
        type: 'text', id: 'brand', x: 10, y: 8, width: 80, height: 8,
        text: '✦ YOUR BRAND', fontSize: 22, fontFamily: 'Inter',
        fontWeight: '800', fill: '#2D4A3E', textAlign: 'center',
      },
      {
        type: 'text', id: 'heading', x: 5, y: 22, width: 90, height: 12,
        text: 'TO BOOK ONLINE\nAPPOINTMENT', fontSize: 14, fontFamily: 'Inter',
        fontWeight: '700', fill: '#2D4A3E', textAlign: 'center',
      },
      {
        type: 'text', id: 'subheading', x: 5, y: 34, width: 90, height: 5,
        text: 'SCAN THE QR CODE', fontSize: 12, fontFamily: 'Inter',
        fontWeight: '600', fill: '#6B8F7B', textAlign: 'center',
      },
      {
        type: 'qr', id: 'qr-code', x: 15, y: 42, width: 70, height: 50,
        isQR: true,
      },
      {
        type: 'text', id: 'footer', x: 10, y: 93, width: 80, height: 4,
        text: 'www.yourbrand.com', fontSize: 11, fontFamily: 'Inter',
        fontWeight: '500', fill: '#999999', textAlign: 'center',
      },
    ],
  },

  // Template 3: Menu Access (Bold Teal)
  {
    id: 'tpl-menu-access',
    name: 'Menu Access',
    category: 'restaurant',
    description: 'Bold restaurant menu access poster',
    canvasWidth: 600,
    canvasHeight: 850,
    backgroundColor: '#1A8E7D',
    scope: 'system',
    elements: [
      {
        type: 'text', id: 'heading-1', x: 5, y: 6, width: 90, height: 8,
        text: 'ACCESS TO MENU', fontSize: 36, fontFamily: 'Inter',
        fontWeight: '900', fill: '#FFFFFF', textAlign: 'center',
      },
      {
        type: 'rect', id: 'cta-box', x: 20, y: 16, width: 60, height: 5,
        shapeFill: 'transparent', shapeStroke: '#FFFFFF', shapeStrokeWidth: 2, borderRadius: 4,
      },
      {
        type: 'text', id: 'cta', x: 20, y: 16.5, width: 60, height: 4,
        text: 'SCAN THE QR CODE', fontSize: 14, fontFamily: 'Inter',
        fontWeight: '700', fill: '#FFFFFF', textAlign: 'center',
      },
      {
        type: 'rect', id: 'qr-bg', x: 12, y: 24, width: 76, height: 48,
        shapeFill: '#FFFFFF', borderRadius: 20,
      },
      {
        type: 'qr', id: 'qr-code', x: 18, y: 28, width: 64, height: 40,
        isQR: true,
      },
      {
        type: 'text', id: 'hours', x: 5, y: 75, width: 90, height: 10,
        text: 'OPEN FROM TUESDAY TO SUNDAY\nFROM 10 AM TO 11 PM', fontSize: 16, fontFamily: 'Inter',
        fontWeight: '800', fill: '#FFA94D', textAlign: 'center',
      },
      {
        type: 'rect', id: 'footer-bg', x: 0, y: 88, width: 100, height: 12,
        shapeFill: '#FFFFFF',
      },
      {
        type: 'text', id: 'footer-info', x: 5, y: 90, width: 90, height: 8,
        text: 'YOUR LOGO  |  123 Street Name  |  (012) 345-6789  |  info@restaurant.com',
        fontSize: 10, fontFamily: 'Inter', fontWeight: '600', fill: '#1A8E7D', textAlign: 'center',
      },
    ],
  },

  // Template 4: WiFi Share (Green)
  {
    id: 'tpl-wifi-share',
    name: 'WiFi Share',
    category: 'utility',
    description: 'Share your WiFi credentials with a QR code',
    canvasWidth: 500,
    canvasHeight: 750,
    backgroundColor: '#5B8C5A',
    scope: 'system',
    elements: [
      {
        type: 'text', id: 'heading-1', x: 8, y: 6, width: 60, height: 8,
        text: "What's the\ncode to your", fontSize: 20, fontFamily: 'Inter',
        fontWeight: '400', fill: '#FFFFFF', textAlign: 'left',
      },
      {
        type: 'text', id: 'heading-2', x: 8, y: 20, width: 84, height: 14,
        text: 'WiFi?', fontSize: 64, fontFamily: 'Inter',
        fontWeight: '900', fill: '#FFFFFF', textAlign: 'left',
      },
      {
        type: 'rect', id: 'qr-card', x: 12, y: 40, width: 76, height: 42,
        shapeFill: '#FFFFFF', borderRadius: 16,
      },
      {
        type: 'text', id: 'scan-label', x: 25, y: 42, width: 50, height: 4,
        text: 'SCAN HERE', fontSize: 14, fontFamily: 'Inter',
        fontWeight: '800', fill: '#333333', textAlign: 'center',
      },
      {
        type: 'qr', id: 'qr-code', x: 20, y: 48, width: 60, height: 32,
        isQR: true,
      },
      {
        type: 'text', id: 'network', x: 10, y: 85, width: 80, height: 4,
        text: 'Network: YourNetworkName', fontSize: 16, fontFamily: 'Inter',
        fontWeight: '400', fill: '#E0E0E0', textAlign: 'center',
      },
      {
        type: 'text', id: 'password', x: 10, y: 91, width: 80, height: 4,
        text: 'Password: ••••••••', fontSize: 16, fontFamily: 'Inter',
        fontWeight: '400', fill: '#E0E0E0', textAlign: 'center',
      },
    ],
  },
];
