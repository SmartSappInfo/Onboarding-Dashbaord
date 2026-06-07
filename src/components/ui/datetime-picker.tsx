'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from './scroll-area';

interface DateTimePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

export function DateTimePicker({ value, onChange, disabled, className, variant }: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      onChange(undefined);
      return;
    }
    
    // Keep the time from the original value if it exists, otherwise default to 9am
    const hours = value?.getHours() ?? 9;
    const minutes = value?.getMinutes() ?? 0;
    selectedDate.setHours(hours, minutes);
    onChange(selectedDate);
  };
  
  const handleTimeSelect = (time: string) => {
    const datePart = value ? new Date(value) : new Date();
    
    const [timePart, meridiem] = time.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);

    if (meridiem.toLowerCase() === 'pm' && hours < 12) {
        hours += 12;
    }
    if (meridiem.toLowerCase() === 'am' && hours === 12) { // 12 AM is midnight
        hours = 0;
    }

    datePart.setHours(hours, minutes);
    onChange(datePart);
    setOpen(false); // Close popover after time selection
  };
  
  const availableTimes = React.useMemo(() => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let min = 0; min < 60; min += 15) {
        const h12 = hour % 12 === 0 ? 12 : hour % 12;
        const meridiem = hour < 12 ? 'AM' : 'PM';
        const displayHour = h12.toString().padStart(2, '0');
        const displayMin = min.toString().padStart(2, '0');
        times.push(`${displayHour}:${displayMin} ${meridiem}`);
      }
    }
    return times;
  }, []);
  
  const selectedTime = value ? format(value, 'hh:mm a') : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={variant || 'outline'}
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, 'PPP p') : <span>Pick a date and time</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex divide-x overflow-hidden rounded-md bg-background">
            <Calendar 
              mode="single" 
              onSelect={handleDateSelect} 
              selected={value} 
              disabled={disabled}
            />
            <div className="relative w-[200px] overflow-hidden">
              <div className="absolute inset-0 flex flex-col min-h-0">
                <div className="space-y-2 px-4 pt-4 pb-2 shrink-0 text-center">
                  <p className="font-semibold text-sm text-foreground">Available Times</p>
                </div>
                <ScrollArea className="flex-1 min-h-0">
                  <div className="grid grid-cols-1 gap-2 px-4 pb-4">
                    {availableTimes.map(time => (
                      <Button
                        key={time}
                        onClick={() => handleTimeSelect(time)}
                        size="sm"
                        variant={selectedTime === time ? "default" : "outline"}
                        disabled={!value || disabled}
                        className="font-semibold rounded-lg"
                      >
                        {time}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function convert24to12(time24: string | undefined): string {
  if (!time24) return '';
  const [hourStr, minStr] = time24.split(':');
  const hour = parseInt(hourStr, 10);
  const min = parseInt(minStr, 10);
  if (isNaN(hour) || isNaN(min)) return '';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const displayHour = h12.toString().padStart(2, '0');
  const displayMin = min.toString().padStart(2, '0');
  const meridiem = hour < 12 ? 'AM' : 'PM';
  return `${displayHour}:${displayMin} ${meridiem}`;
}

export function convert12to24(time12: string | undefined): string {
  if (!time12) return '';
  const [timePart, meridiem] = time12.split(' ');
  if (!timePart || !meridiem) return '';
  let [hours, minutes] = timePart.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return '';
  if (meridiem.toLowerCase() === 'pm' && hours < 12) {
    hours += 12;
  }
  if (meridiem.toLowerCase() === 'am' && hours === 12) {
    hours = 0;
  }
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

interface TimePickerProps {
  value: string | undefined;
  onChange: (time: string | undefined) => void;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

export function TimePicker({ value, onChange, disabled, className, variant }: TimePickerProps) {
  const [open, setOpen] = React.useState(false);

  const availableTimes = React.useMemo(() => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let min = 0; min < 60; min += 15) {
        const h12 = hour % 12 === 0 ? 12 : hour % 12;
        const meridiem = hour < 12 ? 'AM' : 'PM';
        const displayHour = h12.toString().padStart(2, '0');
        const displayMin = min.toString().padStart(2, '0');
        times.push(`${displayHour}:${displayMin} ${meridiem}`);
      }
    }
    return times;
  }, []);

  const selectedTime12 = React.useMemo(() => convert24to12(value), [value]);

  const handleTimeSelect = (time12: string) => {
    const time24 = convert12to24(time12);
    onChange(time24);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={variant || 'outline'}
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
        >
          <Clock className="mr-2 h-4 w-4" />
          {selectedTime12 || <span>Pick a time</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <div className="relative h-[300px] w-full overflow-hidden bg-background rounded-md">
          <div className="absolute inset-0 grid grid-rows-[auto_1fr] gap-2">
            <div className="space-y-2 px-4 pt-4">
              <p className="text-center font-medium text-sm">Available Times</p>
            </div>
            <ScrollArea className="h-full">
              <div className="grid grid-cols-1 gap-2 px-4 pb-4">
                {availableTimes.map(time => (
                  <Button
                    key={time}
                    onClick={() => handleTimeSelect(time)}
                    size="sm"
                    variant={selectedTime12 === time ? "default" : "outline"}
                    disabled={disabled}
                  >
                    {time}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}