'use client';

import * as React from 'react';

interface RawDebouncedInputProps extends Omit<React.ComponentProps<'input'>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  debounce?: number;
}

export function RawDebouncedInput({
  value: initialValue,
  onChange,
  debounce = 300,
  ...props
}: RawDebouncedInputProps) {
  const [value, setValue] = React.useState(initialValue);

  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    if (value === initialValue) return;
    const timeout = setTimeout(() => {
      onChangeRef.current(value);
    }, debounce);

    return () => clearTimeout(timeout);
  }, [value, initialValue, debounce]);

  return (
    <input
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}

interface RawDebouncedTextareaProps extends Omit<React.ComponentProps<'textarea'>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  debounce?: number;
}

export function RawDebouncedTextarea({
  value: initialValue,
  onChange,
  debounce = 300,
  ...props
}: RawDebouncedTextareaProps) {
  const [value, setValue] = React.useState(initialValue);

  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    if (value === initialValue) return;
    const timeout = setTimeout(() => {
      onChangeRef.current(value);
    }, debounce);

    return () => clearTimeout(timeout);
  }, [value, initialValue, debounce]);

  return (
    <textarea
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}
