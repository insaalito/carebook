import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Reusable date picker that matches the app's dark aesthetic.
 * Props:
 *   value: string | null  — "yyyy-MM-dd" format
 *   onChange: (string) => void  — called with "yyyy-MM-dd" string
 *   placeholder: string
 *   className: string
 *   disabled: boolean
 */
export default function DatePickerInput({ value, onChange, placeholder = 'Pick a date', className, disabled }) {
  const [open, setOpen] = useState(false);

  const selected = value ? new Date(value + 'T12:00:00') : undefined;

  const handleSelect = (date) => {
    if (!date) return;
    onChange(format(date, 'yyyy-MM-dd'));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal bg-secondary border-border text-foreground hover:bg-secondary/80 hover:text-foreground',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 opacity-60" />
          {value ? format(selected, 'MMMM d, yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 bg-card border-border shadow-xl"
        align="start"
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          initialFocus
          classNames={{
            months: 'p-3',
            head_cell: 'text-muted-foreground text-xs font-medium w-9',
            cell: 'text-center text-sm p-0 relative',
            day: 'h-9 w-9 p-0 font-normal rounded-md hover:bg-primary/20 hover:text-foreground transition-colors',
            day_selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
            day_today: 'border border-primary/40 text-primary',
            day_outside: 'text-muted-foreground opacity-30',
            day_disabled: 'text-muted-foreground opacity-20 cursor-not-allowed',
            nav_button: 'text-muted-foreground hover:text-foreground h-7 w-7 bg-transparent p-0',
            caption: 'flex justify-center items-center relative mb-1',
            caption_label: 'text-sm font-semibold text-foreground',
          }}
        />
      </PopoverContent>
    </Popover>
  );
}