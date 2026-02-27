'use client';

import * as React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { 
    Text, Signature, Calendar, ChevronDownSquare, Phone, Mail, Clock, Camera, 
    ALargeSmall, Copy, Replace, Trash2, Key, ChevronDown, Bold, Italic, Underline,
    AlignStartVertical, AlignCenterVertical, AlignEndVertical,
    AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
    ChevronUp, ChevronDown as ChevronDownIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditor } from '../EditorContext';
import { PDFFormField } from '@/lib/types';
import type { LocalPDFFormField, ResizeHandle } from '../types';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from '@/components/ui/separator';

const fieldIcons: { [key in PDFFormField['type']]: React.ElementType } = {
  text: Text,
  signature: Signature,
  date: Calendar,
  dropdown: ChevronDownSquare,
  phone: Phone,
  email: Mail,
  time: Clock,
  photo: Camera,
};

interface FieldOverlayProps {
  field: LocalPDFFormField;
  pageDimensions: { width: number; height: number };
}

export const FieldOverlay = React.memo(function FieldOverlay({ field, pageDimensions }: FieldOverlayProps) {
  const { 
    selectedFieldIds, namingFieldId, selectField, updateField, removeField, duplicateFields, zoom 
  } = useEditor();
  
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ 
    id: field.id,
    data: { type: 'FIELD', field }
  });

  const [isResizing, setIsResizing] = React.useState(false);
  const [isEditingPlaceholder, setIsEditingPlaceholder] = React.useState(false);
  const resizeHandleRef = React.useRef<ResizeHandle | null>(null);
  const initialResizeState = React.useRef<any>(null);

  const isSelected = selectedFieldIds.includes(field.id);
  const isMulti = selectedFieldIds.length > 1;
  const isNaming = field.id === namingFieldId;

  const isTextType = ['text', 'dropdown', 'phone', 'email', 'date', 'time'].includes(field.type);

  // Pixel-based font size calculation relative to zoom (removed 1.5 base scale)
  const currentTotalScale = zoom;
  const baseFontSize = field.fontSize || 11;
  const dynamicFontSize = `${Math.round(baseFontSize * currentTotalScale)}px`;

  const handleResizeStart = (e: React.MouseEvent, handle: ResizeHandle) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeHandleRef.current = handle;
    
    initialResizeState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: (field.dimensions.width / 100) * pageDimensions.width,
      startHeight: (field.dimensions.height / 100) * pageDimensions.height,
      startFieldX: (field.position.x / 100) * pageDimensions.width,
      startFieldY: (field.position.y / 100) * pageDimensions.height,
    };
    
    selectField(field.id);
  };

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!initialResizeState.current || !resizeHandleRef.current) return;
      
      const dx = e.clientX - initialResizeState.current.startX;
      const dy = e.clientY - initialResizeState.current.startY;
      const handle = resizeHandleRef.current;
      const { startWidth, startHeight, startFieldX, startFieldY } = initialResizeState.current;

      let newX = startFieldX, newY = startFieldY, newW = startWidth, newH = startHeight;

      if (handle.includes('bottom')) newH = Math.max(10, startHeight + dy);
      if (handle.includes('top')) { newH = Math.max(10, startHeight - dy); newY = startFieldY + (startHeight - newH); }
      if (handle.includes('right')) newW = Math.max(10, startWidth + dx);
      if (handle.includes('left')) { newW = Math.max(10, startWidth - dx); newX = startFieldX + (startWidth - newW); }

      updateField(field.id, {
        position: { x: (newX / pageDimensions.width) * 100, y: (newY / pageDimensions.height) * 100 },
        dimensions: { width: (newW / pageDimensions.width) * 100, height: (newH / pageDimensions.height) * 100 },
        isSuggestion: false,
      });
    };

    const handleMouseUp = () => setIsResizing(false);
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, field.id, pageDimensions, updateField]);

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${field.position.x}%`,
    top: `${field.position.y}%`,
    width: `${field.dimensions.width}%`,
    height: `${field.dimensions.height}%`,
    transform: CSS.Translate.toString(transform),
    zIndex: isSelected ? 50 : (field.isSuggestion ? 10 : 1),
    opacity: isDragging ? 0.4 : 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: field.verticalAlignment === 'center' ? 'center' : field.verticalAlignment === 'bottom' ? 'flex-end' : 'flex-start',
    textAlign: field.alignment || 'left',
    fontSize: dynamicFontSize,
    fontWeight: field.bold ? 'bold' : 'normal',
    fontStyle: field.italic ? 'italic' : 'normal',
    textDecoration: field.underline ? 'underline' : 'none',
  };

  const Icon = fieldIcons[field.type];
  const resizeHandles: ResizeHandle[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top', 'bottom', 'left', 'right'];

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...attributes}
      data-field-id={field.id}
      className={cn(
        "absolute border-2 transition-colors cursor-default select-none",
        isSelected ? "border-primary bg-primary/5" : field.isSuggestion ? "border-green-500 bg-green-50/20" : "border-dashed border-primary/40 hover:border-primary/80",
        (field.type === 'signature' || field.type === 'photo') ? "flex items-center justify-center" : "p-1"
      )}
      onPointerDown={(e) => { 
        e.stopPropagation(); 
        selectField(field.id, e.shiftKey, e.metaKey || e.ctrlKey); 
      }}
      onDoubleClick={(e) => { e.stopPropagation(); if (!isMulti) setIsEditingPlaceholder(true); }}
    >
      <div {...listeners} className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing" />

      {isEditingPlaceholder ? (
        <textarea
          autoFocus
          className="absolute inset-0 w-full h-full bg-transparent border-none outline-none resize-none p-1 italic text-muted-foreground z-20 overflow-hidden"
          style={{ 
            fontSize: 'inherit',
            textAlign: 'inherit',
            fontWeight: 'inherit',
            fontStyle: 'inherit',
            textDecoration: 'inherit'
          }}
          value={field.placeholder || ''}
          onChange={(e) => updateField(field.id, { placeholder: e.target.value, isSuggestion: false })}
          onBlur={() => setIsEditingPlaceholder(false)}
        />
      ) : (
        field.placeholder && (
          <span 
            className="text-muted-foreground italic z-10 pointer-events-none truncate block w-full"
            style={{ fontSize: 'inherit' }}
          >
            {field.placeholder}
          </span>
        )
      )}

      {(field.type === 'dropdown' || field.type === 'time') && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-40">
          {field.type === 'dropdown' ? <ChevronDown className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
        </div>
      )}

      {isNaming && !isSelected && (
        <div className="absolute -top-5 -right-1 bg-primary text-white p-0.5 rounded-full shadow-sm z-30">
          <Key className="h-2.5 w-2.5" />
        </div>
      )}

      {isSelected && !isMulti && (
        <>
          <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 rounded-2xl border bg-background/95 backdrop-blur-sm p-1 shadow-2xl scale-90 sm:scale-100 origin-bottom">
            <TooltipProvider>
              <div className="flex items-center gap-0.5 px-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setIsEditingPlaceholder(true)}>
                      <ALargeSmall className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit Placeholder</TooltipContent>
                </Tooltip>
                
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                          <Replace className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Change Field Type</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent className="w-40 p-1" side="top">
                    {(Object.keys(fieldIcons) as Array<keyof typeof fieldIcons>).map(type => (
                      <DropdownMenuItem key={type} className="text-xs capitalize gap-2" onClick={() => updateField(field.id, { type })}>
                        {React.createElement(fieldIcons[type], { className: "h-3.5 w-3.5" })}
                        {type}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Separator orientation="vertical" className="h-6 mx-0.5 bg-border/50" />

              {isTextType && (
                <>
                  <div className="flex items-center gap-0.5 px-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant={field.bold ? "secondary" : "ghost"} 
                          size="icon" 
                          className={cn("h-8 w-8 rounded-lg", field.bold && "text-primary bg-primary/10")} 
                          onClick={() => updateField(field.id, { bold: !field.bold })}
                        >
                          <Bold className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Bold</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant={field.italic ? "secondary" : "ghost"} 
                          size="icon" 
                          className={cn("h-8 w-8 rounded-lg", field.italic && "text-primary bg-primary/10")} 
                          onClick={() => updateField(field.id, { italic: !field.italic })}
                        >
                          <Italic className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Italic</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant={field.underline ? "secondary" : "ghost"} 
                          size="icon" 
                          className={cn("h-8 w-8 rounded-lg", field.underline && "text-primary bg-primary/10")} 
                          onClick={() => updateField(field.id, { underline: !field.underline })}
                        >
                          <Underline className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Underline</TooltipContent>
                    </Tooltip>
                  </div>

                  <Separator orientation="vertical" className="h-6 mx-0.5 bg-border/50" />

                  <div className="flex items-center gap-0.5 px-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-lg" 
                          onClick={() => updateField(field.id, { fontSize: Math.max(8, (field.fontSize || 11) - 1) })}
                        >
                          <ChevronDownIcon className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Decrease Font Size</TooltipContent>
                    </Tooltip>
                    
                    <span className="text-[10px] font-black w-6 text-center tabular-nums">{field.fontSize || 11}</span>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-lg" 
                          onClick={() => updateField(field.id, { fontSize: Math.min(36, (field.fontSize || 11) + 1) })}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Increase Font Size</TooltipContent>
                    </Tooltip>
                  </div>

                  <Separator orientation="vertical" className="h-6 mx-0.5 bg-border/50" />

                  <div className="flex items-center gap-0.5 px-1">
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                              {field.alignment === 'center' ? <AlignCenterVertical className="h-4 w-4" /> : field.alignment === 'right' ? <AlignEndVertical className="h-4 w-4" /> : <AlignStartVertical className="h-4 w-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Horizontal Alignment</TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent className="w-12 p-1" side="top">
                        <DropdownMenuItem onClick={() => updateField(field.id, { alignment: 'left' })}><AlignStartVertical className="h-4 w-4" /></DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateField(field.id, { alignment: 'center' })}><AlignCenterVertical className="h-4 w-4" /></DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateField(field.id, { alignment: 'right' })}><AlignEndVertical className="h-4 w-4" /></DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                              {field.verticalAlignment === 'center' ? <AlignCenterHorizontal className="h-4 w-4" /> : field.verticalAlignment === 'bottom' ? <AlignEndHorizontal className="h-4 w-4" /> : <AlignStartHorizontal className="h-4 w-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Vertical Alignment</TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent className="w-12 p-1" side="top">
                        <DropdownMenuItem onClick={() => updateField(field.id, { verticalAlignment: 'top' })}><AlignStartHorizontal className="h-4 w-4" /></DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateField(field.id, { verticalAlignment: 'center' })}><AlignCenterHorizontal className="h-4 w-4" /></DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateField(field.id, { verticalAlignment: 'bottom' })}><AlignEndHorizontal className="h-4 w-4" /></DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <Separator orientation="vertical" className="h-6 mx-0.5 bg-border/50" />
                </>
              )}

              <div className="flex items-center gap-0.5 px-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => duplicateFields([field.id])}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Duplicate</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => removeField(field.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
          {resizeHandles.map(h => (
            <div key={h}
              onMouseDown={(e) => handleResizeStart(e, h)}
              className={cn(
                'absolute bg-primary border border-white rounded-full w-2.5 h-2.5 z-50 -translate-x-1/2 -translate-y-1/2 shadow-sm transition-transform hover:scale-125',
                h.includes('top') ? 'top-0' : h.includes('bottom') ? 'top-full' : 'top-1/2',
                h.includes('left') ? 'left-0' : h.includes('right') ? 'left-full' : 'left-1/2',
                h === 'top' && 'cursor-n-resize', h === 'bottom' && 'cursor-s-resize',
                h === 'left' && 'cursor-w-resize', h === 'right' && 'cursor-e-resize',
                h === 'top-left' && 'cursor-nw-resize', h === 'top-right' && 'cursor-ne-resize',
                h === 'bottom-left' && 'cursor-sw-resize', h === 'bottom-right' && 'cursor-se-resize'
              )}
            />
          ))}
        </>
      )}
      {field.isSuggestion && <span className="absolute -top-6 left-0 text-[10px] font-black uppercase tracking-wider bg-green-500 text-white px-2 py-0.5 rounded-full shadow-lg">AI Suggestion</span>}
    </div>
  );
});
