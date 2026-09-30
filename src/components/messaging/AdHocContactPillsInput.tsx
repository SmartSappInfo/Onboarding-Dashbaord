'use client';

/**
 * @fileOverview SmartSapp Message Composer — Interactive Ad-Hoc Contact Pills Input
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR FUTURE MAINTAINERS (Rule 10):
 * 1. Delimited Text Tokenization: Parses raw pasted/typed text (comma, colon, semicolon, newline, tab)
 *    into normalized contact pills using canonical `tokenizeDelimitedContacts`.
 * 2. Mobile Touch Ergonomics (Rule 6): All interactive action buttons and pill delete icons enforce
 *    a minimum 44px touch target zone (`min-h-[44px]`).
 * 3. Emil Kowalski Animations (Rule 7): Tactile click feedback (`active:scale-[0.97]`) on all chips and buttons.
 * 4. High Load & DOM Safety (Rule 9): Implements a rendering threshold cap (100 pills) with an interactive
 *    toggle ("Show All / Show Less") to protect client DOM performance under large input volumes.
 * 5. Strict Zero-Any Invariant (Rule 1): Strictly typed without 'any' or 'any[]'.
 */

import React, { useState, useCallback } from 'react';
import {
  X,
  AlertCircle,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { AdHocContactItem } from '@/lib/types/composer-audience';
import { tokenizeDelimitedContacts } from '@/lib/messaging/contact-tokenizer';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface AdHocContactPillsInputProps {
  channel: 'email' | 'sms' | 'whatsapp';
  defaultCountry?: string;
  items: AdHocContactItem[];
  onChange: (items: AdHocContactItem[]) => void;
  duplicateCount?: number;
  disabled?: boolean;
  className?: string;
}

const SMS_WHATSAPP_PLACEHOLDER =
  'Type or paste phone numbers separated by commas, colons, or newlines (e.g. 0244123456, Kwame: 0201112222)...';
const EMAIL_PLACEHOLDER =
  'Type or paste emails separated by commas, colons, or newlines (e.g. name@domain.com, Kwame <kwame@domain.com>)...';

export function AdHocContactPillsInput({
  channel,
  defaultCountry = 'GH',
  items,
  onChange,
  duplicateCount,
  disabled = false,
  className,
}: AdHocContactPillsInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [localDuplicateCount, setLocalDuplicateCount] = useState(0);

  const { toast } = useToast();

  const effectiveDuplicateCount = duplicateCount !== undefined ? duplicateCount : localDuplicateCount;
  const validItems = items.filter((it) => it.isValid);
  const invalidItems = items.filter((it) => !it.isValid);
  const validCount = validItems.length;
  const invalidCount = invalidItems.length;

  const placeholder = channel === 'email' ? EMAIL_PLACEHOLDER : SMS_WHATSAPP_PLACEHOLDER;

  const commitInput = useCallback(
    (rawText: string) => {
      const trimmed = rawText.trim();
      if (!trimmed) {
        setInputValue('');
        return;
      }

      const result = tokenizeDelimitedContacts(trimmed, channel, defaultCountry);
      if (result.items.length === 0) {
        setInputValue('');
        return;
      }

      const existingTargets = new Set(items.map((it) => it.target.toLowerCase()));
      const newItemsToAdd: AdHocContactItem[] = [];
      let duplicatesFound = result.duplicateCount;

      for (const item of result.items) {
        const canonical = item.target.toLowerCase();
        if (existingTargets.has(canonical)) {
          duplicatesFound++;
        } else {
          existingTargets.add(canonical);
          newItemsToAdd.push(item);
        }
      }

      if (newItemsToAdd.length > 0) {
        onChange([...items, ...newItemsToAdd]);
      }

      if (duplicatesFound > 0) {
        setLocalDuplicateCount((prev) => prev + duplicatesFound);
      }

      setInputValue('');
    },
    [channel, defaultCountry, items, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitInput(inputValue);
    } else if (e.key === ',' || e.key === ';') {
      e.preventDefault();
      commitInput(inputValue);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.includes(',') || val.includes(';') || val.includes('\n')) {
      commitInput(val);
    } else {
      setInputValue(val);
    }
  };

  const handleBlur = () => {
    if (inputValue.trim()) {
      commitInput(inputValue);
    }
  };

  const handleRemoveItem = (idToRemove: string) => {
    if (disabled) return;
    onChange(items.filter((item) => item.id !== idToRemove));
  };

  const handleRemoveInvalid = () => {
    if (disabled) return;
    onChange(validItems);
  };

  const handleClearAll = () => {
    if (disabled) return;
    onChange([]);
    setLocalDuplicateCount(0);
    setInputValue('');
  };

  const handleCopyValid = async () => {
    if (disabled || validCount === 0) return;
    const validTargets = validItems.map((item) => item.target).join(', ');
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(validTargets);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      toast({
        title: 'Copied to clipboard',
        description: `${validCount} valid contact${validCount === 1 ? '' : 's'} copied.`,
      });
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const hasExceededThreshold = items.length > 100;
  const displayedItems = hasExceededThreshold && !showAll ? items.slice(0, 100) : items;

  return (
    <div className={cn('w-full flex flex-col gap-3', className)}>
      {/* Input Textarea Area */}
      <div className="relative">
        <textarea
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          rows={3}
          className={cn(
            'w-full min-h-[88px] px-3.5 py-2.5 text-sm rounded-lg border border-input bg-background',
            'placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            'transition-all duration-200 resize-y',
            disabled && 'opacity-50 cursor-not-allowed bg-muted/40'
          )}
          aria-label="Direct contact input"
        />
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>Separate with commas, colons, or newlines</span>
          <span>Press Enter or comma to create pill</span>
        </div>
      </div>

      {/* Batch Actions & Status Toolbar */}
      {(items.length > 0 || effectiveDuplicateCount > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 pb-0.5">
          {/* Status Badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
                'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              {validCount} Valid
            </span>

            {invalidCount > 0 && (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
                  'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden="true" />
                {invalidCount} Invalid
              </span>
            )}

            {effectiveDuplicateCount > 0 && (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
                  'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                )}
              >
                {effectiveDuplicateCount} {effectiveDuplicateCount === 1 ? 'Duplicate' : 'Duplicates'}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {invalidCount > 0 && (
              <button
                type="button"
                onClick={handleRemoveInvalid}
                disabled={disabled}
                className={cn(
                  'min-h-[44px] px-3.5 py-2 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg',
                  'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40',
                  'border border-rose-200 dark:border-rose-800/60 active:scale-[0.97] transition-all duration-200',
                  'disabled:opacity-50 disabled:pointer-events-none'
                )}
                aria-label="Remove invalid contacts"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                Remove Invalid
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyValid}
              disabled={disabled || validCount === 0}
              className={cn(
                'min-h-[44px] px-3.5 py-2 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg',
                'text-foreground bg-muted/60 hover:bg-muted border border-border',
                'active:scale-[0.97] transition-all duration-200',
                'disabled:opacity-50 disabled:pointer-events-none'
              )}
              aria-label="Copy valid contacts"
            >
              {isCopied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              ) : (
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              {isCopied ? 'Copied!' : 'Copy Valid'}
            </button>

            <button
              type="button"
              onClick={handleClearAll}
              disabled={disabled}
              className={cn(
                'min-h-[44px] px-3.5 py-2 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg',
                'text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/60',
                'active:scale-[0.97] transition-all duration-200',
                'disabled:opacity-50 disabled:pointer-events-none'
              )}
              aria-label="Clear all contacts"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Pills Container */}
      {items.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div
            className="flex flex-wrap gap-2 max-h-72 overflow-y-auto p-1.5 rounded-lg border border-border/50 bg-background/50"
            role="list"
            aria-label="Contact pills"
          >
            {displayedItems.map((item) => {
              if (item.isValid) {
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'inline-flex items-center gap-2 pl-3 pr-1 py-1 rounded-lg text-xs',
                      'bg-emerald-50/70 dark:bg-emerald-950/20 text-foreground',
                      'border border-emerald-200/80 dark:border-emerald-800/50 shadow-sm transition-all duration-200'
                    )}
                    role="listitem"
                  >
                    <span
                      className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="flex items-center gap-1.5 select-text">
                      {item.displayName ? (
                        <>
                          <span className="font-semibold text-foreground">
                            {item.displayName}
                          </span>
                          <span className="text-muted-foreground font-mono">
                            {item.target}
                          </span>
                        </>
                      ) : (
                        <span className="font-medium text-foreground">
                          {item.target}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={disabled}
                      aria-label={`Remove ${item.displayName || item.target}`}
                      className={cn(
                        'min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md',
                        'text-muted-foreground hover:text-foreground hover:bg-emerald-200/50 dark:hover:bg-emerald-900/30',
                        'active:scale-[0.97] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        disabled && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                );
              }

              // Invalid Pill
              return (
                <div
                  key={item.id}
                  className={cn(
                    'inline-flex items-center gap-2 pl-3 pr-1 py-1 rounded-lg text-xs',
                    'bg-rose-50/80 dark:bg-rose-950/25 text-rose-950 dark:text-rose-100',
                    'border border-rose-300 dark:border-rose-800/80 shadow-sm transition-all duration-200'
                  )}
                  role="listitem"
                >
                  <AlertCircle
                    className="w-4 h-4 text-rose-500 shrink-0"
                    aria-hidden="true"
                  />
                  <div className="flex flex-col select-text">
                    <span className="font-medium line-through decoration-rose-400">
                      {item.rawInput || item.target}
                    </span>
                    <span className="text-[11px] text-rose-600 dark:text-rose-400 font-normal">
                      {item.validationError || 'Invalid format'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    disabled={disabled}
                    aria-label={`Remove ${item.rawInput || item.target}`}
                    className={cn(
                      'min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md',
                      'text-rose-400 hover:text-rose-700 dark:hover:text-rose-200 hover:bg-rose-200/50 dark:hover:bg-rose-900/40',
                      'active:scale-[0.97] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      disabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Performance Guard Toggle for > 100 contacts */}
          {hasExceededThreshold && (
            <div className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground bg-muted/30 rounded-md">
              <span>
                Showing first 100 of {items.length} contacts.
              </span>
              <button
                type="button"
                onClick={() => setShowAll((prev) => !prev)}
                className="min-h-[44px] px-3 py-1.5 inline-flex items-center gap-1 font-medium text-primary hover:underline active:scale-[0.97] transition-all duration-200"
              >
                {showAll ? (
                  <>
                    Show Less <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    Show All <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center p-6 text-center rounded-lg border border-dashed border-border/80 bg-muted/20">
          <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center mb-2 text-muted-foreground">
            <Users className="w-5 h-5" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-foreground">No contacts added yet</p>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
            Type or paste contacts into the box above and press Enter or comma to create pills.
          </p>
        </div>
      )}
    </div>
  );
}
