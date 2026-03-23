import { PDFForm, PDFFormField } from '@/lib/types';

export type ResizeHandle = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom' | 'left' | 'right';

export interface MarqueeState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export type EditorViewMode = 'design' | 'preview';

export interface LocalPDFFormField extends PDFFormField {
  isSuggestion?: boolean;
}

export interface EditorState {
  selectedFieldIds: string[];
  zoom: number;
  isSidebarCollapsed: boolean;
  marquee: MarqueeState | null;
  namingFieldId: string | null;
  viewMode: EditorViewMode;
}

export type AlignmentType = 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v';
export type DistributionType = 'horizontal' | 'vertical';
