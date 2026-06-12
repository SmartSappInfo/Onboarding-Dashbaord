import * as React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export const SearchInput = React.memo(function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className,
  autoFocus,
}: SearchInputProps) {
  return (
    <div className={`relative flex items-center ${className || ''}`}>
      <Search className="absolute left-3.5 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="pl-9 pr-9 h-10 rounded-xl bg-background border border-border/50 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/30 shadow-sm text-xs font-medium"
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onChange('')}
          className="absolute right-1.5 h-7 w-7 rounded-lg hover:bg-muted/80 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
});
