'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface DateTimePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  disabled?: boolean;
}

export function DateTimePicker({ value, onChange, disabled }: DateTimePickerProps) {
  const [date, setDate] = React.useState<Date | undefined>(value);
  const [open, setOpen] = React.useState(false);

  // When the external value changes, update the internal date state.
  React.useEffect(() => {
    setDate(value);
  }, [value]);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      setDate(undefined);
      onChange(undefined);
      return;
    }

    // Preserve the time part if it exists, otherwise default to the current time.
    const hours = date?.getHours() ?? new Date().getHours();
    const minutes = date?.getMinutes() ?? new Date().getMinutes();
    
    const newDate = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      hours,
      minutes
    );
    
    setDate(newDate);
    onChange(newDate);
    // Do not close popover, allow time selection.
  };
  
  const handleTimeChange = (part: 'hour' | 'minute', val: string) => {
    if (!date) return;

    const newDate = new Date(date);
    const numericValue = parseInt(val, 10);
    
    if (part === 'hour') {
      newDate.setHours(numericValue);
    } else {
      newDate.setMinutes(numericValue);
    }
    
    setDate(newDate);
    onChange(newDate);
  }
  
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  // Use 5-minute intervals for a better user experience
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

  const selectedHour = date ? format(date, 'HH') : undefined;
  
  // Snap the minute to the nearest 5-minute interval for display in the select
  const selectedMinute = date ? (Math.floor(date.getMinutes() / 5) * 5).toString().padStart(2, '0') : undefined;


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={'outline'}
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground'
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, 'PPP p') : <span>Pick a date and time</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateSelect}
          initialFocus
          disabled={disabled}
        />
        <div className="p-3 border-t border-border space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Time
          </Label>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <Select
              value={selectedHour}
              onValueChange={(value) => handleTimeChange('hour', value)}
              disabled={!date || disabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Hour" />
              </SelectTrigger>
              <SelectContent>
                {hours.map(hour => (
                  <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="font-bold text-muted-foreground">:</span>
            <Select
              value={selectedMinute}
              onValueChange={(value) => handleTimeChange('minute', value)}
              disabled={!date || disabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Min" />
              </SelectTrigger>
              <SelectContent>
                {minutes.map(minute => (
                  <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
