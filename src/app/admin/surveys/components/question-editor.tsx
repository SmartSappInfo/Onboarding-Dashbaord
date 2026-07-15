
'use client';

import { useFormContext, Controller, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { 
    Trash2, PlusCircle, ArrowUp, ArrowDown, Bot, Check, ChevronsUpDown, X, Star, Clock, 
    Upload, Pilcrow, Baseline, CheckCircle2, ListChecks, ChevronDownSquare, CheckCircle, 
    Type, Copy, Eye, EyeOff, Heading1, Image as ImageIcon, Video as VideoIcon, 
    AudioWaveform, FileText, Code, Minus, Text as TextIcon, MoreVertical, 
    Calendar as CalendarIcon, GripVertical, Layers, Bold, Italic, Underline,
    AlignLeft, AlignCenter, AlignRight, Zap, Asterisk, Trophy as TrophyIcon,
    AlignJustify, Database, Mail, Phone, Hash, Link as LinkIcon, Settings
} from 'lucide-react';
import type { SurveyElement, SurveyQuestion, SurveyLayoutBlock, MediaAsset, TemplateVariable } from '@/lib/types';
import * as React from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { getVariablesAction } from '@/lib/services/fields-variables-service';
import { FormMessage, FormItem, FormLabel } from '@/components/ui/form';
import { useFieldArray } from 'react-hook-form';
import { useSlashAutocomplete, convertToCleanHtml } from '@/hooks/use-slash-autocomplete';
import { sanitizeHtml } from '@/lib/survey-variable-utils';
import { createPortal } from 'react-dom';
import { FallbackEditorModal } from '@/components/shared/FallbackEditorModal';

const QuestionVariablesContext = React.createContext<TemplateVariable[]>([]);
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandList, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { format, isValid, parseISO } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import Image from 'next/image';
import VideoEmbed from '@/components/video-embed';
import { MediaSelect } from '../../entities/components/media-select';
import MediaSelectorDialog from '../../media/components/media-selector-dialog';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const stripHtml = (html: string) => {
    if (typeof window === 'undefined') return html;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
};

/**
 * A simple Rich Text Editor using contenteditable that integrates with react-hook-form.
 */
const contextLabels: Record<string, string> = {
  entity: 'Entity',
  deal: 'Deal',
  agent: 'Agent',
  core: 'General Identity & Contacts',
  contact: 'General Identity & Contacts',
  contact_specific: 'Contact Specific Role',
  general: 'General Variables',
  common: 'Common Variables',
  custom: 'Custom Variables',
  regional: 'Regional Metadata',
  financial: 'Financial Configuration',
  interests: 'Interests',
  survey: 'Survey Metadata',
};

function convertToVisualHtml(text: string): string {
  if (!text) return '';
  const parsed = text.replace(/\{\{(.*?)\}\}/g, (match, rawKey) => {
    const parts = rawKey.split(/\|\||\|/);
    const varName = parts[0].trim();
    const fallback = parts.length > 1 ? parts.slice(1).join('|').trim() : '';
    const fallbackText = fallback ? ` (${fallback})` : '';

    return `<span contenteditable="false" data-variable="${varName}" data-fallback="${fallback}" class="inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded bg-blue-100/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-mono text-[90%] font-bold border border-blue-200/50 align-baseline select-none hover:bg-blue-200/20 dark:hover:bg-blue-900/30 transition-all">
      <span>${varName}${fallbackText}</span>
      <button type="button" data-variable-settings="${varName}" class="hover:bg-blue-500/20 p-0.5 rounded transition-all inline-flex items-center justify-center ml-1 text-[9px] cursor-pointer border-0 bg-transparent" title="Configure fallback">⚙️</button>
    </span>`;
  });
  return parsed;
}

/**
 * A simple Rich Text Editor using contenteditable that integrates with react-hook-form
 * and supports slash commands for unified variables.
 */
const RichTextEditor = ({ 
    value, 
    onChange, 
    placeholder, 
    className,
    textAlign = 'left' 
}: { 
    value: string; 
    onChange: (val: string) => void; 
    placeholder?: string;
    className?: string;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
}) => {
    const variables = React.useContext(QuestionVariablesContext);
    const editorRef = React.useRef<HTMLDivElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const [coords, setCoords] = React.useState({ top: 0, left: 0, width: 250 });

    const [modalOpen, setModalOpen] = React.useState(false);
    const [editingVarKey, setEditingVarKey] = React.useState('');
    const [editingVarCurrentFallback, setEditingVarCurrentFallback] = React.useState('');
    const [activePillElement, setActivePillElement] = React.useState<HTMLElement | null>(null);

    const handleSaveFallback = React.useCallback((fallbackVal: string) => {
      if (!activePillElement) return;
      const cleanFallback = fallbackVal.trim();
      activePillElement.setAttribute('data-fallback', cleanFallback);
      
      const labelSpan = activePillElement.querySelector('span');
      const varName = activePillElement.getAttribute('data-variable') || '';
      if (labelSpan) {
        labelSpan.textContent = cleanFallback ? `${varName} (${cleanFallback})` : varName;
      }
      
      const el = editorRef.current;
      if (el) {
        const cleanVal = convertToCleanHtml(el);
        onChange(cleanVal);
      }
      
      setModalOpen(false);
      setActivePillElement(null);
    }, [activePillElement, onChange]);

    const {
      showAutocomplete,
      autocompleteCoords,
      autocompleteIndex,
      filteredVars,
      handleKeyDown: hookKeyDown,
      handleInputChange,
      handleSelectChange,
      selectAndInsert,
      setShowAutocomplete,
    } = useSlashAutocomplete({
      variables,
      value,
      onChange,
    });

    const updateCoords = React.useCallback(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 800;
        const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 600;
        const width = Math.max(250, rect.width);
        
        let left = rect.left + window.scrollX;
        if (left + width > screenWidth - 16) {
          left = Math.max(8, screenWidth - width - 16);
        }
        
        const dropdownHeight = 240;
        let top = rect.bottom + window.scrollY;
        if (rect.bottom + dropdownHeight > screenHeight - 16) {
          top = Math.max(8, rect.top + window.scrollY - dropdownHeight - 8);
        }

        setCoords({ top, left, width });
      }
    }, []);

    React.useEffect(() => {
      if (showAutocomplete) {
        updateCoords();
        window.addEventListener('resize', updateCoords);
        window.addEventListener('scroll', updateCoords, { capture: true });
      }
      return () => {
        window.removeEventListener('resize', updateCoords);
        window.removeEventListener('scroll', updateCoords, { capture: true });
      };
    }, [showAutocomplete, updateCoords]);

    // Sync external value to editor (only if visual representation differs)
    React.useEffect(() => {
        if (editorRef.current) {
            const visualHtml = convertToVisualHtml(value);
            if (editorRef.current.innerHTML !== visualHtml) {
                editorRef.current.innerHTML = visualHtml || '';
            }
        }
    }, [value]);

    const handleInput = () => {
        if (editorRef.current) {
            const cleanVal = convertToCleanHtml(editorRef.current);
            const sanitized = sanitizeHtml(cleanVal);
            onChange(sanitized);
            handleInputChange({ target: editorRef.current } as unknown as React.ChangeEvent<HTMLDivElement>);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter') {
          if (showAutocomplete && filteredVars.length > 0) {
            e.preventDefault();
            const selectedVar = filteredVars[autocompleteIndex];
            if (selectedVar) {
              selectAndInsert(selectedVar.name, e.currentTarget);
            }
            return;
          }
        }
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b') { e.preventDefault(); document.execCommand('bold', false); }
            if (e.key === 'i') { e.preventDefault(); document.execCommand('italic', false); }
            if (e.key === 'u') { e.preventDefault(); document.execCommand('underline', false); }
        }
        hookKeyDown(e);
    };

    const handleBlur = () => {
        setShowAutocomplete(false);
    };

    return (
        <div ref={containerRef} className="relative w-full">
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                onKeyUp={(e) => handleSelectChange(e as unknown as React.SyntheticEvent<HTMLDivElement>)}
                onMouseUp={(e) => handleSelectChange(e as unknown as React.SyntheticEvent<HTMLDivElement>)}
                onClick={(e) => {
                    const target = e.target as HTMLElement;
                    const settingsBtn = target.closest('[data-variable-settings]');
                    if (settingsBtn) {
                        e.preventDefault();
                        e.stopPropagation();
                        const pill = settingsBtn.closest('[data-variable]');
                        if (pill) {
                            const varName = pill.getAttribute('data-variable') || '';
                            const fallback = pill.getAttribute('data-fallback') || '';
                            setEditingVarKey(varName);
                            setEditingVarCurrentFallback(fallback);
                            setActivePillElement(pill as HTMLElement);
                            setModalOpen(true);
                        }
                    }
                }}
                className={cn(
                    "min-h-[1em] outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50 empty:before:italic whitespace-pre-wrap [&_*]:!text-inherit focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 rounded-lg px-1",
                    textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : textAlign === 'justify' ? 'text-justify' : 'text-left',
                    className
                )}
                data-placeholder={placeholder}
            />

            {showAutocomplete && filteredVars.length > 0 && typeof document !== 'undefined' && createPortal(
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'absolute',
                        top: `${coords.top}px`,
                        left: `${coords.left}px`,
                        width: `${coords.width}px`,
                        marginTop: '4px',
                        zIndex: 100000,
                    }}
                    className="max-h-60 overflow-y-auto rounded-xl border border-border bg-popover/95 backdrop-blur-md shadow-2xl p-1.5 text-left text-popover-foreground scrollbar-thin scrollbar-thumb-muted"
                >
                    {filteredVars.map((v, idx) => {
                        const labelText = contextLabels[v.context] || String(v.context);
                        const isSelected = idx === autocompleteIndex;

                        return (
                            <button
                                key={v.id}
                                type="button"
                                data-active={isSelected ? 'true' : 'false'}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    if (editorRef.current) {
                                        selectAndInsert(v.name, editorRef.current);
                                    }
                                }}
                                className={cn(
                                    "w-full text-left px-2.5 py-2.5 sm:py-1.5 rounded-lg text-xs font-semibold transition-colors flex flex-col gap-0.5 outline-none min-h-[44px] sm:min-h-0 justify-center cursor-pointer",
                                    isSelected
                                        ? "bg-primary text-primary-foreground"
                                        : "text-foreground hover:bg-muted"
                                )}
                            >
                                <span className="truncate w-full">{v.label}</span>
                                <span className={cn("text-[9px] font-mono truncate w-full", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                                    {`{{${v.name}}}`} • {labelText}
                                </span>
                            </button>
                        );
                    })}
                </div>,
                document.body
            )}

            <FallbackEditorModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                variableKey={editingVarKey}
                currentFallback={editingVarCurrentFallback}
                onSave={handleSaveFallback}
            />
        </div>
    );
};

function isQuestion(element: SurveyElement): element is SurveyQuestion {
    const questionTypes: SurveyQuestion['type'][] = [
        'text', 'long-text', 'yes-no', 'multiple-choice', 'checkboxes', 
        'dropdown', 'rating', 'date', 'time', 'file-upload',
        'email', 'phone', 'number', 'link'
    ];
    return questionTypes.includes(element.type as any);
}

function isLayoutBlock(element: SurveyElement): element is SurveyLayoutBlock {
    const layoutTypes = ['heading', 'description', 'divider', 'image', 'video', 'audio', 'document', 'embed', 'section'];
    return layoutTypes.includes(element.type);
}

const getElementIcon = (type: SurveyElement['type']) => {
    const iconMap: { [key in SurveyElement['type']]: React.ElementType } = {
        'text': Baseline,
        'long-text': Pilcrow,
        'yes-no': CheckCircle2,
        'multiple-choice': CheckCircle,
        'checkboxes': ListChecks,
        'dropdown': ChevronDownSquare,
        'rating': Star,
        'date': CalendarIcon,
        'time': Clock,
        'file-upload': Upload,
        'heading': Heading1,
        'description': TextIcon,
        'divider': Minus,
        'image': ImageIcon,
        'video': VideoIcon,
        'audio': AudioWaveform,
        'document': FileText,
        'embed': Code,
        'logic': Bot,
        'section': Layers,
    };
    return iconMap[type] || Type;
}

const getMediaFilterType = (type: SurveyElement['type']): 'image' | 'video' | 'audio' | 'document' | undefined => {
      if (type === 'image') return 'image';
      if (type === 'video') return 'video';
      if (type === 'audio') return 'audio';
      if (type === 'document') return 'document';
      return undefined;
}

function FormattingToolbar({ fieldName, alignValue, onAlignChange, minimal }: { 
    fieldName: string;
    alignValue?: 'left' | 'center' | 'right' | 'justify';
    onAlignChange?: (val: 'left' | 'center' | 'right' | 'justify') => void;
    minimal?: boolean;
}) {
    const applyStyle = (cmd: string) => {
        document.execCommand(cmd, false);
    };

    return (
 <div className={cn("flex items-center gap-0.5", !minimal && "bg-card/20 p-1 rounded-md mb-2 ring-1 ring-border")}>
 <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyStyle('bold')} title="Bold (Ctrl+B)">
 <Bold className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
 <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyStyle('italic')} title="Italic (Ctrl+I)">
 <Italic className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
 <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => applyStyle('underline')} title="Underline (Ctrl+U)">
 <Underline className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            
            {onAlignChange && (
                <>
 <Button type="button" variant={alignValue === 'left' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => onAlignChange('left')}>
 <AlignLeft className="h-3.5 w-3.5" />
                    </Button>
 <Button type="button" variant={alignValue === 'center' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => onAlignChange('center')}>
 <AlignCenter className="h-3.5 w-3.5" />
                    </Button>
 <Button type="button" variant={alignValue === 'right' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => onAlignChange('right')}>
 <AlignRight className="h-3.5 w-3.5" />
                    </Button>
 <Button type="button" variant={alignValue === 'justify' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => onAlignChange('justify')}>
 <AlignJustify className="h-3.5 w-3.5" />
                    </Button>
                </>
            )}
        </div>
    );
}

const MediaLayoutEditor = ({ element, field }: { element: SurveyLayoutBlock; field: any }) => {
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    
    const handleSelect = (asset: MediaAsset) => {
        field.onChange(asset.url);
        setIsDialogOpen(false);
    };

    const filterType = getMediaFilterType(element.type);
    const Icon = getElementIcon(element.type);

    return (
        <>
            {field.value ? (
 <div className="relative group/media-preview rounded-lg border border-border/50 overflow-hidden">
 {element.type === 'image' && <Image src={field.value} alt={element.title || 'image preview'} width={800} height={450} className="w-full h-auto object-cover" />}
                    {element.type === 'video' && <VideoEmbed url={field.value} />}
 {element.type === 'audio' && <div className="p-4"><audio controls src={field.value} className="w-full" /></div>}
                    {element.type === 'document' && (
 <a href={field.value} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 hover:bg-accent/10 transition-colors">
 <FileText className="h-8 w-8 text-muted-foreground" />
                            <div>
 <p className="font-semibold">Document</p>
 <p className="text-sm text-muted-foreground truncate">{field.value}</p>
                            </div>
                        </a>
                    )}
 <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/media-preview:opacity-100 transition-opacity">
                         <Button type="button" variant="secondary" onClick={() => setIsDialogOpen(true)}>Change {element.type}</Button>
                    </div>
                </div>
            ) : (
                <div 
 className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border/50 bg-card/5 rounded-xl cursor-pointer hover:bg-accent/5 transition-all"
                    onClick={() => setIsDialogOpen(true)}
                >
 <Icon className="h-12 w-12 text-muted-foreground" />
 <span className="mt-4 text-sm font-semibold text-muted-foreground">Select an {element.type}</span>
                </div>
            )}
            <MediaSelectorDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSelectAsset={handleSelect}
                filterType={filterType}
            />
        </>
    );
};

interface MultiSelectProps {
  options: { label: string; value: string; }[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

function MultiSelect({ options, value, onChange, placeholder = "Select options..." }: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const selectedValues = new Set(value);

  const handleRemove = (val: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    const newSelection = Array.from(selectedValues).filter((v) => v !== val);
    onChange(newSelection);
  };
  
  // Strip HTML from labels for display
  const cleanLabel = (label: string) => {
    return stripHtml(label);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
 className="w-full justify-between h-auto min-h-10 border-border"
        >
 <div className="flex gap-1 flex-wrap flex-1 min-w-0">
            {selectedValues.size > 0 ? (
                options.filter(opt => selectedValues.has(opt.value)).map(option => (
                    <Badge
                        variant="secondary"
                        key={option.value}
 className="mr-1 mb-1 max-w-full"
                    >
                        <span className="truncate">{cleanLabel(option.label)}</span>
                        <div
                            role="button"
                            tabIndex={0}
                            aria-label={`Remove ${cleanLabel(option.label)}`}
                            className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-muted-foreground/20 transition-colors"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleRemove(option.value, e);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleRemove(option.value, e as any);
                                }
                            }}
                        >
                            <X className="h-3 w-3 shrink-0" />
                        </div>
                    </Badge>
                ))
            ) : (
 <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
 <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
 className="w-[--radix-popover-trigger-width] max-w-[400px] p-0 z-[100]"
        align="start"
        side="bottom"
        sideOffset={5}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value);
                const label = cleanLabel(option.label);
                
                return (
                  <CommandItem
                    key={option.value}
                    // CRITICAL: value must be unique for cmdk selection logic to work correctly
                    // We append the unique ID to the label so it remains searchable by label but is globally unique.
                    value={`${label} ${option.value}`}
                    onSelect={() => {
                      const newSelection = new Set(value);
                      if (isSelected) {
                        newSelection.delete(option.value);
                      } else {
                        newSelection.add(option.value);
                      }
                      onChange(Array.from(newSelection));
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface OptionInputProps {
  value: string;
  name?: string;
  placeholder: string;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onChange: (val: string) => void;
  onPasteAppend: (lines: string[]) => void;
}

function OptionInput({
  value,
  name,
  placeholder,
  onKeyDown,
  onChange,
  onPasteAppend,
}: OptionInputProps) {
  const variables = React.useContext(QuestionVariablesContext);
  const [localVal, setLocalVal] = React.useState(value || '');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [coords, setCoords] = React.useState({ top: 0, left: 0, width: 250 });

  React.useEffect(() => {
    setLocalVal(value || '');
  }, [value]);

  const {
    showAutocomplete,
    autocompleteIndex,
    filteredVars,
    handleKeyDown: hookKeyDown,
    handleInputChange,
    handleSelectChange,
    selectAndInsert,
    setShowAutocomplete,
  } = useSlashAutocomplete({
    variables,
    value: localVal,
    onChange: (newVal) => {
      setLocalVal(newVal);
      onChange(newVal);
    },
  });

  const updateCoords = React.useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 800;
      const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 600;
      const width = Math.max(250, rect.width);
      
      let left = rect.left + window.scrollX;
      if (left + width > screenWidth - 16) {
        left = Math.max(8, screenWidth - width - 16);
      }
      
      const dropdownHeight = 240;
      let top = rect.bottom + window.scrollY;
      if (rect.bottom + dropdownHeight > screenHeight - 16) {
        top = Math.max(8, rect.top + window.scrollY - dropdownHeight - 8);
      }

      setCoords({ top, left, width });
    }
  }, []);

  React.useEffect(() => {
    if (showAutocomplete) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, { capture: true });
    }
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, { capture: true });
    };
  }, [showAutocomplete, updateCoords]);

  const handleBlur = () => {
    if (localVal !== value) {
      onChange(localVal);
    }
    setTimeout(() => setShowAutocomplete(false), 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (showAutocomplete && filteredVars.length > 0) {
        e.preventDefault();
        const selectedVar = filteredVars[autocompleteIndex];
        if (selectedVar) {
          selectAndInsert(selectedVar.name, e.currentTarget);
        }
        return;
      }
      onChange(localVal);
      onKeyDown(e);
    } else {
      hookKeyDown(e);
      onKeyDown(e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalVal(newVal);
    handleInputChange(e);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <Input
        ref={inputRef}
        name={name}
        value={localVal}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        onKeyUp={(e) => handleSelectChange(e as unknown as React.SyntheticEvent<HTMLInputElement>)}
        onMouseUp={(e) => handleSelectChange(e as unknown as React.SyntheticEvent<HTMLInputElement>)}
        className="bg-card h-11 rounded-xl border border-border/50 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/20 transition-all w-full"
        onPaste={(e) => {
          const pastedText = e.clipboardData.getData('Text');
          if (pastedText && pastedText.includes('\n')) {
            e.preventDefault();
            const lines = pastedText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length > 0) {
              setLocalVal(lines[0]);
              onChange(lines[0]);
              if (lines.length > 1) {
                onPasteAppend(lines.slice(1));
              }
            }
          }
        }}
      />

      {showAutocomplete && filteredVars.length > 0 && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            marginTop: '4px',
            zIndex: 100000,
          }}
          className="max-h-60 overflow-y-auto rounded-xl border border-border bg-popover/95 backdrop-blur-md shadow-2xl p-1.5 text-left text-popover-foreground scrollbar-thin scrollbar-thumb-muted"
        >
          {filteredVars.map((v, idx) => {
            const labelText = contextLabels[v.context] || String(v.context);
            const isSelected = idx === autocompleteIndex;

            return (
              <button
                key={v.id}
                type="button"
                data-active={isSelected ? 'true' : 'false'}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (inputRef.current) {
                    selectAndInsert(v.name, inputRef.current);
                  }
                }}
                className={cn(
                  "w-full text-left px-2.5 py-2.5 sm:py-1.5 rounded-lg text-xs font-semibold transition-colors flex flex-col gap-0.5 outline-none min-h-[44px] sm:min-h-0 justify-center cursor-pointer",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <span className="truncate w-full">{v.label}</span>
                <span className={cn("text-[9px] font-mono truncate w-full", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {`{{${v.name}}}`} • {labelText}
                </span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

function OptionsEditor({ questionIndex }: { questionIndex: number }) {
  const { control, watch, setValue, getValues } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `elements.${questionIndex}.options`,
  });

  const questionType = watch(`elements.${questionIndex}.type`);
  const defaultValue = watch(`elements.${questionIndex}.defaultValue`);
  const allowOther = watch(`elements.${questionIndex}.allowOther`);
  const enableScoring = watch(`elements.${questionIndex}.enableScoring`);

  // Track which index to focus after appending a new option
  const pendingFocusIndexRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (pendingFocusIndexRef.current !== null) {
      const idx = pendingFocusIndexRef.current;
      pendingFocusIndexRef.current = null;
      // Wait for DOM to update, then focus the new input
      requestAnimationFrame(() => {
        const input = document.querySelector<HTMLInputElement>(
          `input[name="elements.${questionIndex}.options.${idx}"]`
        );
        input?.focus();
      });
    }
  }, [fields.length, questionIndex]);

  const handleAddOption = () => {
    pendingFocusIndexRef.current = fields.length;
    append('');
    if (enableScoring) {
        const currentScores = getValues(`elements.${questionIndex}.optionScores`) || [];
        setValue(`elements.${questionIndex}.optionScores`, [...currentScores, 0], { shouldDirty: true });
    }
  };

  const handleOptionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddOption();
    }
  };

  const handleRemoveOption = (index: number) => {
    const optionVal = getValues(`elements.${questionIndex}.options.${index}`);
    const questionId = getValues(`elements.${questionIndex}.id`);
    remove(index);

    if (enableScoring) {
        const currentScores = getValues(`elements.${questionIndex}.optionScores`) || [];
        const newScores = currentScores.filter((_:any, i:number) => i !== index);
        setValue(`elements.${questionIndex}.optionScores`, newScores, { shouldDirty: true });
    }

    if (questionId && optionVal) {
      const allElements = getValues('elements') || [];
      const { syncElementsOnOptionChange } = require('@/lib/survey-logic-utils');
      const updatedElements = syncElementsOnOptionChange(allElements, questionId, optionVal, null);
      setValue('elements', updatedElements, { shouldDirty: true });
    }
  };

  const handleOptionTextChange = (index: number, newVal: string, oldVal: string, onChange: (v: string) => void) => {
    onChange(newVal);
    const questionId = getValues(`elements.${questionIndex}.id`);
    if (questionId && oldVal && oldVal !== newVal) {
      const allElements = getValues('elements') || [];
      const { syncElementsOnOptionChange } = require('@/lib/survey-logic-utils');
      const updatedElements = syncElementsOnOptionChange(allElements, questionId, oldVal, newVal);
      setValue('elements', updatedElements, { shouldDirty: true });
    }
  };

  const handleDefaultChange = (newValue: any) => {
    setValue(`elements.${questionIndex}.defaultValue`, newValue, { shouldDirty: true, shouldValidate: true });
  }

  return (
 <div className="space-y-3">
 <Label className="text-[10px] font-semibold text-muted-foreground/60">Options</Label>
      {(questionType === 'multiple-choice' || questionType === 'dropdown') && (
        <RadioGroup onValueChange={handleDefaultChange} value={defaultValue}>
          {fields.map((field, index) => {
            const optionValue = watch(`elements.${questionIndex}.options.${index}`);
            return (
 <div key={field.id} className="flex items-center gap-2">
                <RadioGroupItem 
                    value={optionValue} 
                    id={`${field.id}-radio`} 
                    onClick={(e) => {
                        if (defaultValue === optionValue) {
                            e.preventDefault();
                            handleDefaultChange(undefined);
                        }
                    }}
                />
  <div className="flex-1 space-y-1">
                    <Controller
                    name={`elements.${questionIndex}.options.${index}`}
                    control={control}
                    render={({ field }) => (
                      <OptionInput 
                        name={field.name}
                        value={field.value ?? ''}
                        placeholder={`Option ${index + 1}`}
                        onKeyDown={handleOptionKeyDown}
                        onChange={(newVal) => handleOptionTextChange(index, newVal, field.value, field.onChange)}
                        onPasteAppend={(lines) => {
                          for (const line of lines) {
                            append(line);
                          }
                        }}
                      />
                    )}
                    />
                </div>
                 {enableScoring && (
                    <Controller
                    name={`elements.${questionIndex}.optionScores.${index}`}
                    control={control}
                    defaultValue={0}
                    render={({ field: scoreField }) => (
                        <Input
                        type="number"
                        placeholder="Score"
 className="w-24 bg-card h-11 rounded-xl border border-border/50 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/20 transition-all"
                        {...scoreField}
                        value={scoreField.value ?? ''}
                        onChange={e => scoreField.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                        />
                    )}
                    />
                )}
 <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => handleRemoveOption(index)}>
 <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )
          })}
        </RadioGroup>
      )}
      {questionType === 'checkboxes' && (
 <div className="space-y-2">
          {fields.map((field, index) => {
            const optionValue = watch(`elements.${questionIndex}.options.${index}`);
            const isChecked = allowOther
              ? Array.isArray(defaultValue?.options) && defaultValue.options.includes(optionValue)
              : Array.isArray(defaultValue) && defaultValue.includes(optionValue);

            return (
 <div key={field.id} className="flex items-center gap-2">
                <Checkbox
                  id={`${field.id}-checkbox`}
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    if (allowOther) {
                      const currentSelected = defaultValue?.options || [];
                      const newSelected = checked
                        ? [...currentSelected, optionValue]
                        : currentSelected.filter((v: string) => v !== optionValue);
                      handleDefaultChange({ ...(defaultValue || { options: [], other: '' }), options: newSelected });
                    } else {
                      const currentSelected = Array.isArray(defaultValue) ? defaultValue : [];
                      const newSelected = checked
                        ? [...currentSelected, optionValue]
                        : currentSelected.filter((v: string) => v !== optionValue);
                      handleDefaultChange(newSelected);
                    }
                  }}
                />
  <div className="flex-1">
                    <Controller
                    name={`elements.${questionIndex}.options.${index}`}
                    control={control}
                    render={({ field }) => (
                      <OptionInput 
                        name={field.name}
                        value={field.value ?? ''}
                        placeholder={`Option ${index + 1}`}
                        onKeyDown={handleOptionKeyDown}
                        onChange={(newVal) => handleOptionTextChange(index, newVal, field.value, field.onChange)}
                        onPasteAppend={(lines) => {
                          for (const line of lines) {
                            append(line);
                          }
                        }}
                      />
                    )}
                    />
                </div>
                 {enableScoring && (
                    <Controller
                    name={`elements.${questionIndex}.optionScores.${index}`}
                    control={control}
                    defaultValue={0}
                    render={({ field: scoreField }) => (
                        <Input
                        type="number"
                        placeholder="Score"
 className="w-24 bg-card h-11 rounded-xl border border-border/50 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/20 transition-all"
                        {...scoreField}
                        value={scoreField.value ?? ''}
                        onChange={e => scoreField.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                        />
                    )}
                    />
                )}
 <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => handleRemoveOption(index)}>
 <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

 <Button type="button" variant="outline" size="sm" onClick={handleAddOption} className="rounded-xl font-bold border-border/50">
 <PlusCircle className="h-4 w-4 mr-2" /> Add Option
      </Button>
      {(questionType === 'checkboxes' || questionType === 'multiple-choice') && (
 <div className="flex items-center space-x-2 pt-2">
          <Controller
            name={`elements.${questionIndex}.allowOther`}
            control={control}
            render={({ field }) => (
              <Switch
                id={`allowOther-${questionIndex}`}
                checked={!!field.value}
                onCheckedChange={(isChecked) => {
                  field.onChange(isChecked);
                  if (questionType === 'checkboxes') {
                    if (isChecked) {
                      const currentArray = Array.isArray(defaultValue) ? defaultValue : [];
                      handleDefaultChange({ options: currentArray, other: '' });
                    } else {
                      const currentOptions = defaultValue?.options || [];
                      handleDefaultChange(currentOptions);
                    }
                  }
                }}
              />
            )}
          />
 <Label htmlFor={`allowOther-${questionIndex}`} className="text-sm font-semibold">Allow "Other" option</Label>
        </div>
      )}
      {questionType === 'checkboxes' && (
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50 mt-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Min Selections</Label>
            <Controller
              name={`elements.${questionIndex}.minSelections`}
              control={control}
              render={({ field }) => (
                <Input 
                  type="number" 
                  placeholder="No minimum" 
                  min={0}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="rounded-xl h-10 bg-background/50 border-border/50"
                />
              )}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Max Selections</Label>
            <Controller
              name={`elements.${questionIndex}.maxSelections`}
              control={control}
              render={({ field }) => (
                <Input 
                  type="number" 
                  placeholder="No maximum" 
                  min={0}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="rounded-xl h-10 bg-background/50 border-border/50"
                />
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function LogicBlockEditor({ elementIndex }: { elementIndex: number }) {
    const { control, watch } = useFormContext();
    const { fields, append, remove } = useFieldArray({
      control,
      name: `elements.${elementIndex}.rules`,
    });
  
    const allElements: SurveyElement[] = watch('elements') || [];
  
    const potentialSourceQuestions = allElements
      .slice(0, elementIndex)
      .filter((el): el is SurveyQuestion => isQuestion(el));
  
    const targetableElements = React.useMemo(() => {
        return allElements
            .map((el, idx) => ({ el, idx }))
            .filter(({ idx }) => idx !== elementIndex)
            .map(({ el }) => {
                const Icon = getElementIcon(el.type);
                const prefix = isQuestion(el) ? `Q${allElements.filter(isQuestion).findIndex(q => q.id === el.id) + 1}` : (el.type.charAt(0).toUpperCase() + el.type.slice(1));
                const label = el.title ? `${prefix}: ${stripHtml(el.title)}` : `${prefix}: untitled`;
                return { value: el.id, label, icon: Icon };
            });
    }, [allElements, elementIndex]);

    const jumpTargets = React.useMemo(() => {
        return allElements
            .slice(elementIndex + 1)
            .filter((el) => isQuestion(el) || el.type === 'heading' || el.type === 'section')
            .map((el) => {
                const prefix = isQuestion(el) ? `Q${allElements.filter(isQuestion).findIndex(q => q.id === el.id) + 1}` : 'Section';
                return {
                    value: el.id,
                    label: `${prefix}: ${stripHtml(el.title || 'untitled')}`
                }
            });
    }, [allElements, elementIndex]);
  
    return (
 <div className="space-y-4 p-4 border border-primary/20 rounded-2xl bg-primary/10">
        {fields.map((field, index) => {
          const operator = watch(`elements.${elementIndex}.rules.${index}.operator`);
          const actionType = watch(`elements.${elementIndex}.rules.${index}.action.type`);
          const showValueInput = operator !== 'isEmpty' && operator !== 'isNotEmpty';
  
          return (
 <div key={field.id} className="p-4 border border-border/50 rounded-xl bg-card shadow-sm space-y-4">
              {/* WHEN Section */}
 <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full">
 <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground shrink-0">
 <Bot className="h-5 w-5" />
                      <span>When</span>
                  </div>
 <div className="flex-1 space-y-2 min-w-0">
                  <Controller
                      name={`elements.${elementIndex}.rules.${index}.sourceQuestionId`}
                      control={control}
                      render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                       <SelectTrigger className="bg-background border-border/50 ring-1 ring-border w-full">
                         <SelectValue placeholder="Select a question..." />
                       </SelectTrigger>
                          <SelectContent className="max-w-[400px] max-h-[300px] overflow-y-auto z-[100]" position="popper" sideOffset={5}>
                          {potentialSourceQuestions.map((q) => (
                              <SelectItem key={q.id} value={q.id}>
                              Q{allElements.filter(isQuestion).findIndex(el => el.id === q.id) + 1}: {stripHtml(q.title || '')}
                              </SelectItem>
                          ))}
                          </SelectContent>
                      </Select>
                      )}
                  />
 <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full">
                      <Controller
                      name={`elements.${elementIndex}.rules.${index}.operator`}
                      control={control}
                      render={({ field }) => (
                           <Select onValueChange={field.onChange} value={field.value}>
 <SelectTrigger className="w-full sm:flex-1 bg-background border-border/50 ring-1 ring-border">
                             <SelectValue placeholder="Operator..." />
                           </SelectTrigger>
                          <SelectContent className="z-[100]" position="popper" sideOffset={5}>
                              <SelectItem value="isEqualTo">Is</SelectItem>
                              <SelectItem value="isNotEqualTo">Is not</SelectItem>
                              <SelectItem value="contains">Contains</SelectItem>
                              <SelectItem value="doesNotContain">Does not contain</SelectItem>
                              <SelectItem value="startsWith">Starts with</SelectItem>
                              <SelectItem value="doesNotStartWith">Does not start with</SelectItem>
                              <SelectItem value="endsWith">Ends with</SelectItem>
                              <SelectItem value="doesNotEndWith">Does not end with</SelectItem>
                              <SelectItem value="isEmpty">Is empty</SelectItem>
                              <SelectItem value="isNotEmpty">Is not empty</SelectItem>
                              <SelectItem value="isGreaterThan">Is greater than</SelectItem>
                              <SelectItem value="isLessThan">Is less than</SelectItem>
                          </SelectContent>
                          </Select>
                      )}
                      />
                      {showValueInput && (() => {
                        const sourceQuestionId = watch(`elements.${elementIndex}.rules.${index}.sourceQuestionId`);
                        const sourceQuestion = allElements.find(el => el.id === sourceQuestionId) as any;
                        const isChoiceType = sourceQuestion && ['multiple-choice', 'dropdown', 'checkboxes', 'yes-no'].includes(sourceQuestion.type);
                        const options = sourceQuestion?.type === 'yes-no' ? ['Yes', 'No'] : (sourceQuestion?.options || []);

                        if (isChoiceType) {
                          const isEqualityOperator = ['isEqualTo', 'isNotEqualTo'].includes(operator);
                          if (isEqualityOperator) {
                            return (
                              <Controller
                                name={`elements.${elementIndex}.rules.${index}.targetValue`}
                                control={control}
                                render={({ field }) => (
                                  <Select onValueChange={field.onChange} value={field.value || ''}>
                                    <SelectTrigger className="bg-background border-border/50 ring-1 ring-border w-full sm:flex-1 h-10">
                                      <SelectValue placeholder="Select option..." />
                                    </SelectTrigger>
                                    <SelectContent className="z-[100]" position="popper" sideOffset={5}>
                                      {options.map((opt: string, i: number) => (
                                        <SelectItem key={i} value={opt}>{opt}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            );
                          }
                        }

                        if (sourceQuestion?.type === 'number') {
                            return (
                              <Controller
                                name={`elements.${elementIndex}.rules.${index}.targetValue`}
                                control={control}
                                render={({ field }) => (
                                  <Input 
                                    {...field} 
                                    type="number"
                                    value={field.value ?? ''} 
                                    placeholder="Number value..." 
                                    className="bg-background border-border/50 ring-1 ring-border w-full sm:flex-1 h-10" 
                                  />
                                )}
                              />
                            );
                        }

                        if (sourceQuestion?.type === 'date') {
                            return (
                              <Controller
                                name={`elements.${elementIndex}.rules.${index}.targetValue`}
                                control={control}
                                render={({ field }) => (
                                  <div className="w-full sm:flex-1">
                                    <DatePicker 
                                        value={field.value} 
                                        onChange={(date) => field.onChange(date ? date.toISOString() : '')} 
                                    />
                                  </div>
                                )}
                              />
                            );
                        }

                        return (
                          <Controller
                            name={`elements.${elementIndex}.rules.${index}.targetValue`}
                            control={control}
                            render={({ field }) => (
                              <Input 
                                {...field} 
                                value={field.value ?? ''} 
                                placeholder="Value..." 
                                className="bg-background border-border/50 ring-1 ring-border w-full sm:flex-1 h-10" 
                              />
                            )}
                          />
                        );
                      })()}
                  </div>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 shrink-0 bg-destructive/10 hover:bg-destructive/20 text-destructive" 
                    onClick={() => remove(index)}
                  >
                      <Trash2 className="h-4 w-4" />
                  </Button>
              </div>
              
              {/* THEN Section */}
 <div className="flex flex-col sm:flex-row items-start gap-4">
 <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground shrink-0 pt-1">
 <span className="text-lg leading-none">↳</span>
                      <span>Then</span>
                  </div>
 <div className="flex-1 flex flex-col gap-2 min-w-0">
                      <Controller
                          name={`elements.${elementIndex}.rules.${index}.action.type`}
                          control={control}
                          render={({ field }) => (
                               <Select onValueChange={field.onChange} value={field.value}>
 <SelectTrigger className="w-full bg-card border-border/50 ring-1 ring-border">
                                 <SelectValue placeholder="Action..." />
                               </SelectTrigger>
                                  <SelectContent className="z-[100]" position="popper" sideOffset={5}>
                                      <SelectItem value="jump">Jump To...</SelectItem>
                                      <SelectItem value="show">Show Element(s)...</SelectItem>
                                      <SelectItem value="hide">Hide Element(s)...</SelectItem>
                                      <SelectItem value="require">Require Element(s)...</SelectItem>
                                      <SelectItem value="disableSubmit">Disable Submit</SelectItem>
                                  </SelectContent>
                              </Select>
                          )}
                      />
                      {actionType === 'jump' && (
                          <Controller
                              name={`elements.${elementIndex}.rules.${index}.action.targetElementId`}
                              control={control}
                              render={({ field }) => (
                                   <Select onValueChange={field.onChange} value={field.value}>
 <SelectTrigger className="w-full bg-card border-border/50 ring-1 ring-border">
                                     <SelectValue placeholder="Target element..." />
                                   </SelectTrigger>
                                      <SelectContent className="max-w-[400px] max-h-[300px] overflow-y-auto z-[100]" position="popper" sideOffset={5}>
                                      {jumpTargets.map((el) => (
                                          <SelectItem key={el.value} value={el.value}>{el.label}</SelectItem>
                                      ))}
                                      </SelectContent>
                                  </Select>
                              )}
                          />
                      )}
                       {(actionType === 'show' || actionType === 'hide' || actionType === 'require') && (
                          <Controller
                              name={`elements.${elementIndex}.rules.${index}.action.targetElementIds`}
                              control={control}
                              defaultValue={[]}
                              render={({ field }) => (
                                  <MultiSelect 
                                      options={targetableElements}
                                      value={field.value || []}
                                      onChange={field.onChange}
                                      placeholder="Select target element(s)..."
                                  />
                              )}
                          />
                       )}
                  </div>
              </div>
              </div>
          );
        })}
         <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ sourceQuestionId: '', operator: 'isEqualTo', action: { type: 'jump' } })}
 className="rounded-xl font-bold border-border/50"
        >
 <PlusCircle className="h-4 w-4 mr-2" /> Add Rule
        </Button>
      </div>
    );
}

const StarRatingInput = ({ value, onChange, disabled }: { value: number, onChange: (value: number) => void, disabled?: boolean }) => {
    return (
 <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(star => (
                <Star
                    key={star}
 className={cn(
                        'w-10 h-10 cursor-pointer',
                        star <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300',
                        disabled ? 'cursor-not-allowed opacity-50' : ''
                    )}
                    onClick={() => !disabled && onChange(value === star ? 0 : star)}
                />
            ))}
        </div>
    );
};

const DatePicker = ({ value, onChange, disabled }: { value?: string | Date, onChange: (date?: Date) => void, disabled?: boolean }) => {
    let dateValue: Date | undefined = undefined;
    if (value) {
        const parsed = value instanceof Date ? value : parseISO(value);
        if (isValid(parsed)) {
            dateValue = parsed;
        }
    }
    
    return (
        <Popover>
            <PopoverTrigger asChild>
 <Button variant="outline" className={cn("w-full sm:w-fit justify-start text-left font-normal h-11 bg-card border-none shadow-none ring-1 ring-border focus-visible:ring-1 focus-visible:ring-primary/20 rounded-xl", !dateValue && "text-muted-foreground")} disabled={disabled}>
 <CalendarIcon className="mr-2 h-4" />
                    {dateValue ? format(dateValue, "PPP") : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
 <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateValue} onSelect={onChange} initialFocus />
            </PopoverContent>
        </Popover>
    );
}

function SortableSurveyElement({ id, index, remove, swap, insert, requestAddElement, selectedBlockIds, setSelectedBlockIds, setLastSelectedId, onSelect, isAccordion }: {
    id: string;
    index: number;
    remove: (index: number) => void;
    swap: (a: number, b: number) => void;
    insert: (index: number, value: any) => void;
    requestAddElement: (index: number) => void;
    selectedBlockIds: string[];
    setSelectedBlockIds: (ids: string[]) => void;
    setLastSelectedId: (id: string | null) => void;
    onSelect: (id: string, isMulti: boolean, isRange: boolean) => void;
    isAccordion: boolean;
}) {
  const { watch, control, setValue, getValues, formState: { errors } } = useFormContext();
  const element = watch(`elements.${index}`);
  const isSelected = selectedBlockIds.includes(element?.id);
  const isPrimaryActive = selectedBlockIds.length === 1 && isSelected;
  const isCollapsed = isAccordion && !isPrimaryActive;
  const hasErrors = !!(errors.elements as any)?.[index];

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const elements = watch('elements') || [];
  const questionNumber = elements.slice(0, index + 1).filter(isQuestion).length;
  const sectionNumber = elements.slice(0, index + 1).filter((el: any) => el.type === 'section').length;

  const isElementQuestion = isQuestion(element);
  const isElementLayout = isLayoutBlock(element);
  const isElementSection = element.type === 'section';
  const ElementIcon = getElementIcon(element.type);
  const isTitleBold = useWatch({ name: 'questionTitleBold' }) !== false;

  
  return (
    <div 
        className="relative group" 
        ref={setNodeRef} 
        style={style} 
        onClickCapture={(e) => {
            // Only handle selection if not clicking a button or input
            const target = e.target as HTMLElement;
            if (target.closest('button') || target.closest('input') || target.closest('textarea') || target.closest('[contenteditable]') || target.closest('[data-marquee-ignore="true"]')) return;
            
            e.stopPropagation();
            onSelect(element?.id, e.metaKey || e.ctrlKey, e.shiftKey);
        }}
    >
        <div
            data-marquee-ignore="true"
            className={cn(
                "absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 cursor-grab p-2 bg-foreground border border-border rounded-full opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-2xl",
                isDragging && "cursor-grabbing scale-110 shadow-2xl ring-4 ring-primary/20",
                isSelected && "opacity-100"
            )}
            {...attributes}
            {...listeners}
        >
            <GripVertical className="h-4 w-4 text-white" />
        </div>
        <Card 
            id={element.id}
            data-block-id={element.id}
            className={cn(
                "border transition-all duration-500 overflow-hidden rounded-[2rem]",
                isSelected ? "ring-4 ring-primary/5 shadow-xl border-primary" : "border-border/60 shadow-sm hover:border-foreground/20",
                isPrimaryActive ? "bg-primary/[0.01]" : "bg-card",
                hasErrors ? "border-destructive shadow-lg" : "",
                element.hidden ? "opacity-60 grayscale-[0.5]" : "bg-card",
                isCollapsed && "hover:translate-x-1"
            )}
        >
            <CardHeader className={cn(
                "py-3 px-6 transition-colors border-b border-border/20",
                isSelected ? "bg-primary/[0.02]" : "bg-transparent",
                isCollapsed && "cursor-pointer py-3"
            )}>
                <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            "flex items-center justify-center rounded-xl border shadow-xs transition-all duration-300",
                            isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border text-muted-foreground",
                            "h-8 w-8"
                        )}>
                            <ElementIcon className={cn("shrink-0 transition-all h-4 w-4")} />
                        </div>
                        <div className="flex flex-col gap-0">
                            <div className="flex items-center gap-2">
                                <span className={cn("text-[9px] font-bold uppercase tracking-[0.15em] transition-colors", isSelected ? "text-primary" : "text-muted-foreground")}>
                                    {isElementQuestion ? `Question ${questionNumber}`
                                    : isElementSection ? `Section ${sectionNumber}`
                                    : isElementLayout ? `${element.type} Block`
                                    : 'Logic Node'}
                                </span>
                                {isElementQuestion && element.isRequired && (
                                    <span className="text-destructive font-black text-xs animate-pulse">*</span>
                                )}
                            </div>
                            {!isCollapsed && isElementQuestion && element.isRequired && (
                                <Badge variant="outline" className="h-4 text-[7px] font-black uppercase tracking-tighter px-1.5 border-destructive/20 text-destructive bg-destructive/5">Required</Badge>
                            )}
                            {isCollapsed && (
                                <div className="flex items-center gap-2 max-w-md">
                                    <span className={cn(
                                        "font-bold tracking-tight truncate transition-all duration-300 text-sm text-muted-foreground",
                                        isSelected && "text-foreground"
                                    )}>
                                        {stripHtml((element.type === 'section' || element.type === 'heading') ? (element.title || 'Untitled Section') : (element.title || element.text || 'New Block'))}
                                    </span>
                                    {element.hidden && <Badge variant="secondary" className="h-3 text-[6px] font-black uppercase tracking-tighter px-1 opacity-50">Hidden</Badge>}
                                    {element.isRequired && <div className="flex items-center gap-0.5"><Asterisk className="h-3 w-3 text-destructive" /><span className="text-[9px] uppercase font-black tracking-widest text-destructive">Required</span></div>}
                                </div>
                            )}
                        </div>
                    </div>
                    {isSelected && (
                        <div className="flex items-center gap-1.5 mt-2 sm:mt-0">
                            <Button 
                                data-marquee-ignore="true"
                                variant="outline" 
                                size="icon" 
                                className="h-8 w-8 rounded-md hidden sm:flex bg-background"
                                disabled={index === 0}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    swap(index, index - 1);
                                }}
                            >
                                <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button 
                                data-marquee-ignore="true"
                                variant="outline" 
                                size="icon" 
                                className="h-8 w-8 rounded-md hidden sm:flex bg-background"
                                disabled={index >= elements.length - 1}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    swap(index, index + 1);
                                }}
                            >
                                <ArrowDown className="h-4 w-4" />
                            </Button>
                            {isElementQuestion && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button 
                                                data-marquee-ignore="true"
                                                variant="outline" 
                                                size="icon" 
                                                className={cn(
                                                    "h-8 w-8 rounded-md hidden sm:flex bg-background transition-all",
                                                    element.isRequired ? "border-destructive/40 text-destructive bg-destructive/5 hover:bg-destructive/10" : "hover:bg-primary/5 hover:text-primary border-border/60"
                                                )}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setValue(`elements.${index}.isRequired`, !element.isRequired, { shouldDirty: true });
                                                }}
                                            >
                                                <Asterisk className={cn("h-4 w-4", element.isRequired ? "fill-current" : "")} />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            <p className="text-xs font-bold">{element.isRequired ? 'Make Optional' : 'Make Required'}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            <Button 
                                data-marquee-ignore="true"
                                variant="outline" 
                                size="icon" 
                                className="h-8 w-8 rounded-md hidden sm:flex bg-background hover:bg-primary/5 hover:text-primary hover:border-primary/20"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const newElem = { ...element, id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` };
                                    insert(index + 1, newElem);
                                    setSelectedBlockIds([newElem.id]);
                                    setLastSelectedId(newElem.id);
                                }}
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                            <Button 
                                data-marquee-ignore="true"
                                variant="outline" 
                                size="icon" 
                                className="h-8 w-8 rounded-md hidden sm:flex text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 bg-background"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    remove(index);
                                }}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </CardHeader>
            <div className={cn(
                "transition-all duration-500 ease-in-out origin-top",
                isCollapsed ? "h-0 opacity-0 pointer-events-none scale-95" : "h-auto opacity-100 scale-100"
            )}>
                <CardContent className="p-8 sm:p-12 space-y-8">
                    {element.type !== 'logic' ? (
                        <div className="space-y-10">
                            {isElementQuestion && (
                                <div className="space-y-8">
                                    <div className="space-y-4">
                                        <Controller 
                                            name={`elements.${index}.title`} 
                                            control={control} 
                                            render={({ field }) => (
                                                <RichTextEditor 
                                                    value={field.value} 
                                                    onChange={field.onChange} 
                                                    placeholder="The name of your question..." 
                                                    textAlign={element.style?.textAlign}
                                                    className={cn(
                                                        "text-xl sm:text-2xl min-h-[1.2em] focus:ring-0 px-0 transition-all text-foreground selection:bg-primary/20",
                                                        isTitleBold ? "font-bold" : "font-semibold"
                                                    )}
                                                />
                                            )} 
                                        />
                                        <Controller 
                                            name={`elements.${index}.description`} 
                                            control={control} 
                                            render={({ field }) => (
                                                <RichTextEditor 
                                                    value={field.value} 
                                                    onChange={field.onChange} 
                                                    placeholder="Add a subtle instruction or hint here..." 
                                                    textAlign={element.style?.textAlign}
                                                    className="text-sm text-muted-foreground font-medium min-h-[1em] whitespace-pre-wrap px-0 opacity-70"
                                                />
                                            )} 
                                        />
                                    </div>

                                    <div className="space-y-6 pt-4 border-t border-border/50">
                                        {element.type === 'text' && (
                                            <Controller
                                                name={`elements.${index}.placeholder`}
                                                control={control}
                                                render={({ field }) => (
                                                    <Input 
                                                        {...field} 
                                                        value={field.value || ''} 
                                                        placeholder="Type your answer here..." 
                                                        className="h-12 bg-card border border-border/50 rounded-xl px-6 text-foreground text-sm font-semibold shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30 transition-all" 
                                                    />
                                                )}
                                            />
                                        )}
                                        {element.type === 'long-text' && (
                                            <Controller
                                                name={`elements.${index}.placeholder`}
                                                control={control}
                                                render={({ field }) => (
                                                    <Textarea 
                                                        {...field} 
                                                        value={field.value || ''} 
                                                        placeholder="Share your thoughts..." 
                                                        className="min-h-[100px] bg-card border border-border/50 rounded-xl p-6 text-foreground text-sm font-semibold shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30 resize-none transition-all" 
                                                    />
                                                )}
                                            />
                                        )}
                                        {element.type === 'email' && (
                                            <Controller
                                                name={`elements.${index}.placeholder`}
                                                control={control}
                                                render={({ field }) => (
                                                    <div className="relative flex items-center">
                                                        <Mail className="absolute left-6 h-4 w-4 text-primary/60 pointer-events-none" />
                                                        <Input 
                                                            {...field} 
                                                            value={field.value || ''} 
                                                            placeholder="email@example.com" 
                                                            className="h-12 bg-card border border-border/50 rounded-xl pl-14 pr-6 text-foreground text-sm font-semibold shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30 transition-all" 
                                                        />
                                                    </div>
                                                )}
                                            />
                                        )}
                                        {element.type === 'phone' && (
                                            <Controller
                                                name={`elements.${index}.placeholder`}
                                                control={control}
                                                render={({ field }) => (
                                                    <div className="relative flex items-center">
                                                        <Phone className="absolute left-6 h-4 w-4 text-primary/60 pointer-events-none" />
                                                        <Input 
                                                            {...field} 
                                                            value={field.value || ''} 
                                                            placeholder="+233 24 123 4567" 
                                                            className="h-12 bg-card border border-border/50 rounded-xl pl-14 pr-6 text-foreground text-sm font-semibold shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30 transition-all" 
                                                        />
                                                    </div>
                                                )}
                                            />
                                        )}
                                        {element.type === 'number' && (
                                            <Controller
                                                name={`elements.${index}.placeholder`}
                                                control={control}
                                                render={({ field }) => (
                                                    <div className="relative flex items-center">
                                                        <Hash className="absolute left-6 h-4 w-4 text-primary/60 pointer-events-none" />
                                                        <Input 
                                                            {...field} 
                                                            value={field.value || ''} 
                                                            placeholder="e.g. 42" 
                                                            className="h-12 bg-card border border-border/50 rounded-xl pl-14 pr-6 text-foreground text-sm font-semibold shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30 transition-all" 
                                                        />
                                                    </div>
                                                )}
                                            />
                                        )}
                                        {element.type === 'link' && (
                                            <Controller
                                                name={`elements.${index}.placeholder`}
                                                control={control}
                                                render={({ field }) => (
                                                    <div className="relative flex items-center">
                                                        <LinkIcon className="absolute left-6 h-4 w-4 text-primary/60 pointer-events-none" />
                                                        <Input 
                                                            {...field} 
                                                            value={field.value || ''} 
                                                            placeholder="https://example.com" 
                                                            className="h-12 bg-card border border-border/50 rounded-xl pl-14 pr-6 text-foreground text-sm font-semibold shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30 transition-all" 
                                                        />
                                                    </div>
                                                )}
                                            />
                                        )}
                                        {(element.type === 'multiple-choice' || element.type === 'dropdown' || element.type === 'checkboxes') && (
                                            <div className="pt-2">
                                                <OptionsEditor questionIndex={index} />
                                            </div>
                                        )}
                                        {element.type === 'yes-no' && (
                                            <div className="flex gap-4">
                                                <div className="flex-1 h-16 bg-muted/50 border border-border/50 rounded-2xl flex items-center justify-center gap-3 opacity-60">
                                                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                                                    <span className="font-bold text-muted-foreground text-xs">YES</span>
                                                </div>
                                                <div className="flex-1 h-16 bg-muted/50 border border-border/50 rounded-2xl flex items-center justify-center gap-3 opacity-60">
                                                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                                                    <span className="font-bold text-muted-foreground text-xs">NO</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {element.type === 'section' && (
                                <div className="space-y-4">
                                    <Controller
                                        name={`elements.${index}.title`}
                                        control={control}
                                        render={({ field }) => (
                                            <RichTextEditor 
                                                value={field.value} 
                                                onChange={field.onChange} 
                                                placeholder="Section Heading..." 
                                                textAlign={element.style?.textAlign}
                                                className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-tight" 
                                            />
                                        )}
                                    />
                                    <Controller
                                        name={`elements.${index}.description`}
                                        control={control}
                                        render={({ field }) => (
                                            <RichTextEditor 
                                                value={field.value} 
                                                onChange={field.onChange} 
                                                placeholder="Brief overview of this section..." 
                                                textAlign={element.style?.textAlign}
                                                className="text-base sm:text-lg text-muted-foreground font-medium leading-relaxed opacity-80" 
                                            />
                                        )}
                                    />
                                </div>
                            )}

                            {element.type === 'heading' && (
                                <Controller 
                                    name={`elements.${index}.title`} 
                                    control={control} 
                                    render={({ field }) => (
                                        <RichTextEditor 
                                            value={field.value} 
                                            onChange={field.onChange} 
                                            placeholder="Display Heading" 
                                            textAlign={element.style?.textAlign}
                                            className={cn(
                                                "leading-tight tracking-tight text-foreground",
                                                isTitleBold ? "font-bold" : "font-semibold",
                                                element.variant === 'h1' ? "text-3xl sm:text-4xl" : element.variant === 'h3' ? "text-lg sm:text-xl" : "text-2xl sm:text-3xl"
                                            )} 
                                        />
                                    )} 
                                />
                            )}
                            {element.type === 'description' && (
                                <Controller 
                                    name={`elements.${index}.text`} 
                                    control={control} 
                                    render={({ field }) => (
                                        <RichTextEditor 
                                            value={field.value} 
                                            onChange={field.onChange} 
                                            placeholder="Informative text for your users..." 
                                            textAlign={element.style?.textAlign}
                                            className="text-base sm:text-lg leading-relaxed text-slate-500 font-medium min-h-[1.5em]" 
                                        />
                                    )} 
                                />
                            )}
                            {['image', 'video', 'audio', 'document'].includes(element.type) && (
                                <div className="space-y-6 pt-4 border-t border-border/50">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                                {element.type} Source
                                            </Label>
                                            <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter opacity-50">
                                                Supports Library & URL
                                            </Badge>
                                        </div>
                                        <Controller
                                            name={`elements.${index}.url`}
                                            control={control}
                                            render={({ field }) => (
                                                <MediaSelect 
                                                    value={field.value} 
                                                    onValueChange={field.onChange}
                                                    filterType={element.type as any}
                                                />
                                            )}
                                        />
                                    </div>
                                    {element.type === 'video' && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                                    Video Thumbnail (Optional)
                                                </Label>
                                                <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter opacity-50">
                                                    Replaces Auto-Thumbnail
                                                </Badge>
                                            </div>
                                            <Controller
                                                name={`elements.${index}.thumbnailUrl`}
                                                control={control}
                                                render={({ field }) => (
                                                    <MediaSelect 
                                                        value={field.value} 
                                                        onValueChange={field.onChange}
                                                        filterType="image"
                                                    />
                                                )}
                                            />
                                        </div>
                                    )}
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                            {element.type === 'image' ? 'Alt Text' : 'Caption'}
                                        </Label>
                                        <Controller 
                                            name={`elements.${index}.title`} 
                                            control={control} 
                                            render={({ field }) => (
                                                <Input 
                                                    {...field} 
                                                    value={field.value || ''} 
                                                    placeholder={`Add a descriptive ${element.type === 'image' ? 'alt text' : 'caption'}...`}
                                                    className="h-12 bg-card border border-border/50 rounded-xl px-6 text-foreground text-sm font-semibold shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30 transition-all" 
                                                />
                                            )} 
                                        />
                                    </div>
                                </div>
                            )}
                            {element.type === 'embed' && (
                                <div className="space-y-4 pt-4 border-t border-border/50">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">HTML Embed Code</Label>
                                    <Controller 
                                        name={`elements.${index}.html`} 
                                        control={control} 
                                        render={({ field }) => (
                                            <Textarea 
                                                {...field} 
                                                value={field.value || ''} 
                                                placeholder="Paste your iframe or HTML code here..."
                                                className="min-h-[150px] font-mono text-xs bg-card border border-border/50 rounded-xl p-6 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/30 transition-all" 
                                            />
                                        )} 
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <LogicBlockEditor elementIndex={index} />
                    )}
                </CardContent>
            </div>
        </Card>
        <div
            data-marquee-ignore="true"
            className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-20 cursor-pointer p-1.5 bg-background border border-border rounded-full opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-lg"
            onClick={(e) => {
                e.stopPropagation();
                requestAddElement(index);
            }}
        >
            <PlusCircle className="h-5 w-5 text-primary" />
        </div>
    </div>
  );
}

export default function QuestionEditor({ fields, remove, move, swap, insert, requestAddElement, selectedBlockIds, setSelectedBlockIds, lastSelectedId, setLastSelectedId, isAccordion }: {
    fields: any[];
    remove: (index: number) => void;
    move: (from: number, to: number) => void;
    swap: (indexA: number, indexB: number) => void;
    insert: (index: number, value: SurveyElement) => void;
    requestAddElement: (index: number) => void;
    selectedBlockIds: string[];
    setSelectedBlockIds: (ids: string[]) => void;
    lastSelectedId: string | null;
    setLastSelectedId: (id: string | null) => void;
    isAccordion: boolean;
}) {
  const { activeWorkspaceId } = useWorkspace();
  const workspaceId = activeWorkspaceId;
  const [variables, setVariables] = React.useState<TemplateVariable[]>([]);

  React.useEffect(() => {
    if (!workspaceId) return;
    getVariablesAction({
      workspaceId,
      featureContext: 'survey',
    }).then((data) => {
      const mapped: TemplateVariable[] = data.map((v) => ({
        id: v.key,
        name: v.key,
        label: v.label,
        context: v.category,
        description: v.description || '',
        dataType: v.dataType === 'boolean' ? 'string' : v.dataType,
        exampleValue: v.exampleValue || '',
        isDynamic: false,
        isComputed: false
      }));
      setVariables(mapped);
    }).catch((err) => {
      console.error('[QuestionEditor] Failed to fetch survey variables:', err);
    });
  }, [workspaceId]);

  const { formState: { errors } } = useFormContext();
  const formErrors = errors.elements as any[] | undefined;
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((field) => field.id === active.id);
      const newIndex = fields.findIndex((field) => field.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
          move(oldIndex, newIndex);
      }
    }
  }

  const handleSelect = (id: string, isMulti: boolean, isRange: boolean) => {
    if (isRange && lastSelectedId) {
        const lastIdx = fields.findIndex(f => f.id === lastSelectedId);
        const currIdx = fields.findIndex(f => f.id === id);
        if (lastIdx !== -1 && currIdx !== -1) {
            const start = Math.min(lastIdx, currIdx);
            const end = Math.max(lastIdx, currIdx);
            const rangeIds = fields.slice(start, end + 1).map(f => f.id);
            const newSelection = Array.from(new Set([...selectedBlockIds, ...rangeIds]));
            setSelectedBlockIds(newSelection);
        }
    } else if (isMulti) {
        if (selectedBlockIds.includes(id)) {
            setSelectedBlockIds(selectedBlockIds.filter(bid => bid !== id));
        } else {
            setSelectedBlockIds([...selectedBlockIds, id]);
        }
    } else {
        setSelectedBlockIds([id]);
    }
    setLastSelectedId(id);
  };

  return (
    <QuestionVariablesContext.Provider value={variables}>
      <div onClickCapture={(e) => {
          if(e.target === e.currentTarget) {
              setSelectedBlockIds([]);
              setLastSelectedId(null);
          }
      }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-6">
                      {fields.map((field, index) => (
                          <SortableSurveyElement 
                              key={field.id} 
                              id={field.id} 
                              index={index} 
                              remove={remove} 
                              swap={swap} 
                              insert={insert}
                              requestAddElement={requestAddElement}
                              selectedBlockIds={selectedBlockIds}
                              setSelectedBlockIds={setSelectedBlockIds}
                              setLastSelectedId={setLastSelectedId}
                              onSelect={handleSelect}
                              isAccordion={isAccordion}
                          />
                      ))}
                  </div>
              </SortableContext>
          </DndContext>
          <div className="mt-8 flex justify-center">
              <Button
                  data-marquee-ignore="true"
                  type="button"
                  variant="outline"
                  className="rounded-xl border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary gap-2 h-12 px-8"
                  onClick={() => requestAddElement(fields.length - 1)}
              >
                  <PlusCircle className="h-4 w-4" />
                  <span className="font-bold">Add New Block</span>
              </Button>
          </div>
          <div className="mt-8">
              {formErrors && typeof formErrors === 'object' && 'message' in formErrors && (
                  <FormMessage className="text-sm font-bold bg-destructive/10 p-4 rounded-xl flex items-center gap-3 border border-destructive/20 shadow-sm">
                      <X className="h-5 w-5 text-destructive" />
                      {(formErrors as any).message}
                  </FormMessage>
              )}
          </div>
      </div>
    </QuestionVariablesContext.Provider>
  );
}
