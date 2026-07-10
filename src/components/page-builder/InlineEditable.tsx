'use client';

import React, { useEffect, useRef, useState } from 'react';
import { sanitizeHtml } from '@/lib/page-builder/sanitize';

interface InlineEditableProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onChange'> {
  value: string;
  onChange?: (val: string) => void;
  isEdit: boolean;
  tagName?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div' | 'a' | 'blockquote' | 'figcaption';
  html?: boolean;
  placeholder?: string;
}

export const InlineEditable: React.FC<InlineEditableProps> = ({
  value,
  onChange,
  isEdit,
  tagName = 'span',
  html = false,
  className,
  placeholder,
  ...props
}) => {
  const elementRef = useRef<HTMLElement>(null);
  const lastValueRef = useRef<string>(value);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Sync value from parent prop
  useEffect(() => {
    if (!hasMounted || !elementRef.current) return;
    
    // If the element is currently focused, do not overwrite the user's active typing
    if (document.activeElement === elementRef.current) {
      return;
    }

    const targetVal = value || '';
    const currentVal = html ? elementRef.current.innerHTML : elementRef.current.textContent || '';
    
    if (currentVal !== targetVal) {
      if (html) {
        elementRef.current.innerHTML = targetVal;
      } else {
        elementRef.current.textContent = targetVal;
      }
    }
    lastValueRef.current = targetVal;
  }, [value, html, hasMounted]);

  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    const currentValue = html ? e.currentTarget.innerHTML : e.currentTarget.textContent || '';
    lastValueRef.current = currentValue;
    if (onChange) {
      onChange(currentValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (!html && e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const Tag = tagName as any;

  if (!isEdit) {
    if (html) {
      return (
        <Tag
          className={className}
          dangerouslySetInnerHTML={{ __html: value }}
          {...props}
        />
      );
    }
    return (
      <Tag className={className} {...props}>
        {value || placeholder}
      </Tag>
    );
  }

  return (
    <Tag
      ref={elementRef}
      contentEditable={true}
      suppressContentEditableWarning
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      placeholder={placeholder}
      dangerouslySetInnerHTML={
        !hasMounted
          ? { __html: html ? sanitizeHtml(value || '') : (value || '') }
          : undefined
      }
      {...props}
    />
  );
};
