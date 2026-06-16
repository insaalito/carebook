import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, ChevronLeft, ChevronRight, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, addDays, startOfDay, isBefore } from 'date-fns';

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function formatAmPm(time24) {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function generateSlots(openingTime, closingTime, intervalMinutes) {
  const slots = [];
  const start = timeToMinutes(openingTime);
  const end = timeToMinutes(closingTime);
  for (let t = start; t < end; t += intervalMinutes) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return slots;
}

export default function RescheduleModal({ appointment, salon, onClose, onSuccess }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [exclusionBlocks, setExclusionBlocks] = useState([]);
  const [closureDates, setClosureDates] = useState(new Set());
  const [staffRecord, setStaffRecord] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const slotInterval = salon?.slot_interval_minutes || 30;
  const openingTime = salon?.opening_time || '09:00';
  const closingTime = salon?.closing_time || '18:00';
  const allSlots = generateSlots(openingTime, closingTime, slotInterval);

  // Fetch staff record + closure dates once
  useEffect(() => {
    if (!appointment?.staff_id || !salon?.id) return;
    base44.entities.Staff.filter({ id: appointment.staff_id }).then(res => setStaffRecord(res[0] || null));
    base44.entities.ClosureDate.filter({ salon_id: salon.id }).then(dates =>
      setClosureDates(new Set(dates.map(d => d.date)))
    );
  }, [appointment?.staff_id, salon?.id]);

  const today = startOfDay(new Date());
  const weekStart = addDays(today, weekOffset * 7);
  const weekDays = [...Array(7)].map((_, i) => addDays(weekStart, i));

  useEffect(() => {
    if (!selectedDate || !appointment?.staff_id) return;
    setLoadingSlots(true);
    setSelectedTime(null);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dayName = format(selectedDate, 'EEEE');
    base44.functions.invoke('getBookedSlots', {
      staff_id: appointment.staff_id,
      date: dateStr,
      salon_id: appointment.salon_id,
    }).then(res => {
      const { booked = [], exclusions = [] } = res.data || {};
      const locked = booked
        .filter(a => a.time_slot !== appointment.time_slot) // exclude current appointment's slot
        .map(a => ({
          start: timeToMinutes(a.time_slot),
          end: timeToMinutes(a.time_slot) + (a.duration_minutes || slotInterval),
        }));
      setBookedSlots(locked);
      const blocks = exclusions
        .filter(ex =>
          (ex.type === 'recurring' && ex.day_of_week === dayName) ||
          (ex.type === 'one_time' && ex.specific_date === dateStr)
        )
        .map(ex => ({ start: timeToMinutes(ex.start_time), end: timeToMinutes(ex.end_time) }));
      setExclusionBlocks(blocks);
    }).finally(() => setLoadingSlots(false));
  }, [selectedDate, appointment?.staff_id, slotInterval]);

  const isSlotLocked = (slot) => {
    const slotStart = timeToMinutes(slot);
    const slotEnd = slotStart + (appointment?.duration_minutes || slotInterval);
    // Staff hour boundaries
    if (staffRecord) {
      const staffStartMins = timeToMinutes(staffRecord.start_time || openingTime);
      const staffEndMins = timeToMinutes(staffRecord.end_time || closingTime);
      if (slotStart < staffStartMins || slotEnd > staffEndMins) return true;
    }
    const overlap = (blocks) => blocks.some(b => slotStart < b.end && slotEnd > b.start);
    return overlap(bookedSlots) || overlap(exclusionBlocks);
  };

  const isDayClosed = (day) => {
    if (isBefore(day, today)) return true;
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayName = format(day, 'EEEE');
    if (closureDates.has(dateStr)) return true;
    if (salon?.working_days?.length > 0 && !salon.working_days.includes(dayName)) return true;
    if (staffRecord?.working_days?.length > 0 && !staffRecord.working_days.includes(dayName)) return true;
    return false;
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime) return;
    setSubmitting(true);
    setError('');
    const res = await base44.functions.invoke('rescheduleAppointment', {
      appointment_id: appointment.id,
      new_date: format(selectedDate, 'yyyy-MM-dd'),
      new_time: selectedTime,
    });
    setSubmitting(false);
    if (res.data?.error) {
      setError(res.data.error);
      return;
    }
    onSuccess({ date: format(selectedDate, 'yyyy-MM-dd'), time_slot: selectedTime });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground">Reschedule Appointment</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{appointment.customer_name} · {appointment.service_name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Week nav */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setWeekOffset(o => Math.max(0, o - 1))}
                disabled={weekOffset === 0}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-1"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-muted-foreground">
                {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d')}
              </span>
              <button onClick={() => setWeekOffset(o => o + 1)} className="text-muted-foreground hover:text-foreground p-1">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-1 mb-4">
              {weekDays.map(day => {
                const closed = isDayClosed(day);
                const sel = selectedDate && format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                return (
                  <button
                    key={day.toISOString()}
                    disabled={closed}
                    onClick={() => setSelectedDate(day)}
                    className={`flex flex-col items-center py-2 rounded-lg text-xs transition-all ${
                      sel ? 'bg-primary text-primary-foreground' :
                      closed ? 'opacity-40 cursor-not-allowed text-muted-foreground' :
                      'bg-secondary text-muted-foreground hover:bg-primary/20 hover:text-foreground'
                    }`}
                  >
                    <span className="text-[10px]">{format(day, 'EEE')}</span>
                    <span className="font-semibold text-sm">{format(day, 'd')}</span>
                    {closed && <Ban className="w-2.5 h-2.5 mt-0.5 opacity-50" />}
                  </button>
                );
              })}
            </div>

            {/* Time slots */}
            {selectedDate && (
              loadingSlots ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1">
                  {allSlots.map(t => {
                    const locked = isSlotLocked(t);
                    return (
                      <button
                        key={t}
                        disabled={locked}
                        onClick={() => setSelectedTime(t)}
                        className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                          locked
                            ? 'bg-secondary/40 border-border/30 text-muted-foreground/40 cursor-not-allowed line-through'
                            : selectedTime === t
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-secondary border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        }`}
                      >
                        {formatAmPm(t)}
                      </button>
                    );
                  })}
                </div>
              )
            )}
          </div>

          {error && <p className="text-destructive text-xs">{error}</p>}

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="border-border text-foreground">Cancel</Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedDate || !selectedTime || submitting}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {submitting ? 'Rescheduling...' : 'Confirm Reschedule'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}