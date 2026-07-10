/**
 * Declarative field descriptors. A block declares its editable props as a list
 * of `BlockField`s; the property panel (`AutoBlockEditor`, Phase 4) renders the
 * matching control for each `kind`. Defining fields here — once — is what lets
 * the editor panel be generated instead of hand-written per block.
 */
export type BlockField =
  | { kind: 'text'; key: string; label: string; placeholder?: string }
  | { kind: 'textarea'; key: string; label: string; placeholder?: string }
  | { kind: 'richtext'; key: string; label: string }
  | { kind: 'url'; key: string; label: string; placeholder?: string; filterType?: 'image' | 'video' | 'audio' | 'document' | 'link' }
  | { kind: 'image'; key: string; label: string }
  | { kind: 'video'; key: string; label: string }
  | { kind: 'number'; key: string; label: string; min?: number; max?: number; step?: number }
  | { kind: 'slider'; key: string; label: string; min: number; max: number; step: number }
  | { kind: 'color'; key: string; label: string }
  | { kind: 'boolean'; key: string; label: string }
  | { kind: 'select'; key: string; label: string; options: ReadonlyArray<{ value: string; label: string }> }
  | { kind: 'resource'; key: string; label: string; resource: 'form' | 'survey' | 'agreement' | 'meeting' | 'qr' }
  | { kind: 'list'; key: string; label: string; itemFields: ReadonlyArray<BlockField> }
  | { kind: 'animation'; key: string; label: string }
  | { kind: 'font-family'; key: string; label: string }
  | { kind: 'gradient'; key: string; label: string; fromKey: string; toKey: string };
