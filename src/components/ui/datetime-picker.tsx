'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';

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
}

export function DateTimePicker({ value, onChange, disabled }: DateTimePickerProps) {
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
  
  const availableTimes = [
    "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
    "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
    "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM",
  ];
  
  const selectedTime = value ? format(value, 'hh:mm a') : null;

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
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex divide-x overflow-hidden rounded-md border bg-background">
            <Calendar 
              mode="single" 
              onSelect={handleDateSelect} 
              selected={value} 
              disabled={disabled}
            />
            <div className="relative w-[200px] overflow-hidden">
                <div className="absolute inset-0 grid gap-4">
                <div className="space-y-2 px-4 pt-4">
                    <p className="text-center font-medium text-sm">Available Times</p>
                </div>
                <ScrollArea className="h-full overflow-y-auto">
                    <div className="grid grid-cols-1 gap-2 px-4 pb-4">
                    {availableTimes.map(time => (
                        <Button
                          key={time}
                          onClick={() => handleTimeSelect(time)}
                          size="sm"
                          variant={selectedTime === time ? "default" : "outline"}
                          disabled={!value || disabled}
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