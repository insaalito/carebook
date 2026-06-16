import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, ChevronLeft, ChevronRight, Check, Clock, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, addDays, startOfDay, isBefore } from 'date-fns';

/** Convert "HH:MM" → "H:MM AM/PM" */
export function formatAmPm(time24) {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

/** Convert "HH:MM" to minutes from midnight */
function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Generate slots within active windows only (supports split-shift).
 * Shift 1: openingTime → closingTime
 * Shift 2 (optional): shift2Start → shift2End
 * The gap between shift 1 end and shift 2 start is excluded.
 */
function generateSlots(openingTime, closingTime, intervalMinutes, shift2Start, shift2End) {
  const slots = [];
  const windows = [[timeToMinutes(openingTime), timeToMinutes(closingTime)]];
  if (shift2Start && shift2End) {
    windows.push([timeToMinutes(shift2Start), timeToMinutes(shift2End)]);
  }
  for (const [winStart, winEnd] of windows) {
    for (let t = winStart; t < winEnd; t += intervalMinutes) {
      const h = Math.floor(t / 60);
      const m = t % 60;
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}

export default function BookingModal({ salon, staffMember, services, availableStaff = [], onClose }) {
  const [step, setStep] = useState(1); // 1=service, 2=staff (if needed), 3=date/time, 4=details, 5=confirm
  const [selectedService, setSelectedService] = useState(null);
  const [selectedStaffMember, setSelectedStaffMember] = useState(staffMember);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' });

  // Pre-fill form from user profile + client preferences
  useEffect(() => {
    base44.auth.me().then(async (user) => {
      if (!user) return;
      const prefs = await base44.entities.ClientPreference.filter({ customer_email: user.email });
      const pref = prefs[0];
      setForm(f => ({
        ...f,
        name: pref?.customer_name || user.full_name || '',
        email: user.email || '',
        phone: pref?.phone || user.phone || '',
      }));
    }).catch(() => {});
  }, []);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);

  const [bookedSlots, setBookedSlots] = useState([]);
  const [exclusionBlocks, setExclusionBlocks] = useState([]);
  const [closureDates, setClosureDates] = useState(new Set());
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Validate: if service has assigned staff, selected staff must be in the list
  const isStaffValidForService = () => {
    if (!selectedService?.staff_ids || selectedService.staff_ids.length === 0) return true;
    return selectedService.staff_ids.includes(selectedStaffMember?.id);
  };

  const slotInterval = salon.slot_interval_minutes || 30;
  const buffer = salon.buffer_minutes || 0;
  const openingTime = salon.opening_time || '09:00';
  const closingTime = salon.closing_time || '18:00';
  const shift2Start = salon.shift2_start || '';
  const shift2End = salon.shift2_end || '';

  // Staff schedule: use staff times if set, otherwise fall back to salon hours
  const staffStart = selectedStaffMember?.start_time || openingTime;
  const staffEnd = selectedStaffMember?.end_time || closingTime;
  const staffDays = selectedStaffMember?.working_days || [];

  const allSlots = generateSlots(openingTime, closingTime, slotInterval, shift2Start, shift2End);

  const today = startOfDay(new Date());
  const weekStart = addDays(today, weekOffset * 7);
  const weekDays = [...Array(7)].map((_, i) => addDays(weekStart, i));

  // Fetch closure dates (business + staff-specific) whenever staff changes
  useEffect(() => {
    Promise.all([
      base44.entities.ClosureDate.filter({ salon_id: salon.id }),
      selectedStaffMember?.id ? base44.entities.StaffClosureDate.filter({ staff_id: selectedStaffMember.id }) : Promise.resolve([]),
    ]).then(([businessDates, staffDates]) => {
      const allDates = new Set([...businessDates, ...staffDates].map(d => d.date));
      setClosureDates(allDates);
    });
  }, [salon.id, selectedStaffMember?.id]);

  // Fetch booked appointments + exclusions whenever date changes (via service-role backend to bypass RLS)
  useEffect(() => {
    if (!selectedDate || !selectedStaffMember?.id) return;
    setLoadingSlots(true);
    setSelectedTime(null);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dayName = format(selectedDate, 'EEEE');

    base44.functions.invoke('getBookedSlots', {
      staff_id: selectedStaffMember.id,
      date: dateStr,
      salon_id: salon.id,
    }).then(res => {
      const { booked = [], exclusions = [], staff_exclusions = [], is_staff_closed = false } = res.data || {};

      const locked = booked.map(a => ({
        start: timeToMinutes(a.time_slot),
        end: timeToMinutes(a.time_slot) + (a.duration_minutes || slotInterval) + buffer,
      }));
      setBookedSlots(locked);

      // Combine business-wide + staff-specific exclusions
      const allExclusions = [...exclusions, ...staff_exclusions];
      const blocks = allExclusions
        .filter(ex =>
          (ex.type === 'recurring' && ex.day_of_week === dayName) ||
          (ex.type === 'one_time' && ex.specific_date === dateStr)
        )
        .map(ex => ({ start: timeToMinutes(ex.start_time), end: timeToMinutes(ex.end_time) }));
      setExclusionBlocks(blocks);

      // Mark the date as closed if staff is closed that day
      if (is_staff_closed) {
        setClosureDates(prev => new Set([...prev, dateStr]));
      }
    }).finally(() => setLoadingSlots(false));
  }, [selectedDate, selectedStaffMember?.id, slotInterval, buffer, salon.id]);

  /** True if a calendar day is fully closed (holiday OR staff not working that day) */
  const isDayClosed = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayName = format(day, 'EEEE');
    if (closureDates.has(dateStr)) return true;
    // Business working days check
    if (salon.working_days?.length > 0 && !salon.working_days.includes(dayName)) return true;
    // Staff working days check (only if staff has working_days set)
    if (staffDays.length > 0 && !staffDays.includes(dayName)) return true;
    return false;
  };

  /** True if a time slot is outside staff hours, overlaps a booking or exclusion block, or is in the past */
  const isSlotLocked = (slot) => {
    const slotStart = timeToMinutes(slot);
    const slotEnd = slotStart + (selectedService?.duration_minutes || slotInterval);
    // Staff hour boundaries
    const staffStartMins = timeToMinutes(staffStart);
    const staffEndMins = timeToMinutes(staffEnd);
    if (slotStart < staffStartMins || slotEnd > staffEndMins) return true;
    // If today is selected, block slots that have already passed
    if (selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      if (slotStart <= currentMinutes) return true;
    }
    // Booked or exclusion overlap
    const overlap = (blocks) => blocks.some(b => slotStart < b.end && slotEnd > b.start);
    return overlap(bookedSlots) || overlap(exclusionBlocks);
  };

  const handleBook = async () => {
    setSubmitting(true);
    setSubmitError('');

    // Check if running in iframe (published app check)
    if (window.self !== window.top) {
      setSubmitError('Checkout is only available on the published app, not in preview mode.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await base44.functions.invoke('createCheckoutSession', {
        salonId: salon.id,
        serviceId: selectedService.id,
        staffId: selectedStaffMember.id,
        serviceName: selectedService.name,
        price: selectedService.price,
        date: format(selectedDate, 'yyyy-MM-dd'),
        timeSlot: selectedTime,
        customerEmail: form.email,
        customerName: form.name,
        customerPhone: form.phone,
      });

      if (res.data?.url) {
        // Redirect to Stripe checkout
        window.location.href = res.data.url;
      } else {
        setSubmitError('Failed to create checkout session');
      }
    } catch (err) {
      setSubmitError(err.message || 'Payment failed');
    }

    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <p className="text-xs text-muted-foreground">Booking with</p>
            <h3 className="font-semibold text-foreground">{selectedStaffMember.name} @ {salon.name}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex px-6 py-3 gap-2">
          {['Service', 'Date & Time', 'Details', 'Confirm'].map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={`w-5 h-5 rounded-full text-xs flex items-center justify-center flex-shrink-0 font-medium ${
                step > i + 1 ? 'bg-primary text-primary-foreground' :
                step === i + 1 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}>
                {step > i + 1 ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              {i < 3 && <div className={`h-0.5 flex-1 ${step > i + 1 ? 'bg-primary' : 'bg-border'}`} />}
            </div>
          ))}
        </div>

        <div className="p-6">
          {done ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-bebas text-3xl tracking-wider text-foreground mb-2">BOOKED!</h3>
              <p className="text-muted-foreground mb-2">
                {selectedService.name} with {selectedStaffMember.name}
              </p>
              <p className="text-primary font-medium">
                {format(selectedDate, 'EEEE, MMM d')} at {formatAmPm(selectedTime)}
              </p>
              <Button onClick={onClose} className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90">
                Done
              </Button>
            </div>
          ) : step === 1 ? (
            <div>
              <h4 className="font-semibold text-foreground mb-4">Choose a Service</h4>
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {services
                  .filter(svc => {
                    if (!svc.staff_ids || svc.staff_ids.length === 0) return true;
                    return svc.staff_ids.includes(selectedStaffMember?.id);
                  })
                  .map(svc => (
                  <button
                    key={svc.id}
                    onClick={() => { setSelectedService(svc); setStep(2); }}
                    className="w-full flex items-center justify-between bg-secondary border border-border hover:border-primary/40 rounded-xl px-4 py-3 text-left transition-all"
                  >
                    <div>
                      <p className="font-medium text-foreground">{svc.name}</p>
                      <p className="text-xs text-muted-foreground">{svc.duration_minutes} min</p>
                    </div>
                    <span className="text-primary font-semibold">${svc.price}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : step === 2 && selectedService?.staff_ids?.length > 0 ? (
            <div>
              <h4 className="font-semibold text-foreground mb-4">Choose a Staff Member</h4>
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {availableStaff
                  .filter(s => selectedService.staff_ids.includes(s.id))
                  .map(staff => (
                    <button
                      key={staff.id}
                      onClick={() => { setSelectedStaffMember(staff); setStep(3); }}
                      className="w-full flex items-center justify-between bg-secondary border border-border hover:border-primary/40 rounded-xl px-4 py-3 text-left transition-all"
                    >
                      <div>
                        <p className="font-medium text-foreground">{staff.name}</p>
                        <p className="text-xs text-muted-foreground">{staff.role_title || 'Staff'}</p>
                      </div>
                    </button>
                  ))}
              </div>
              <div className="flex gap-3 mt-5">
                <Button variant="outline" onClick={() => setStep(1)} className="border-border text-foreground">Back</Button>
              </div>
            </div>
           ) : step === 2 ? (
            <div>
              <h4 className="font-semibold text-foreground mb-4">Pick a Date &amp; Time</h4>
              {/* Week navigation */}
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
                  const past = isBefore(day, today);
                  const closed = !past && isDayClosed(day);
                  const sel = selectedDate && format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                  return (
                    <button
                      key={day.toISOString()}
                      disabled={past || closed}
                      onClick={() => setSelectedDate(day)}
                      className={`flex flex-col items-center py-2 rounded-lg text-xs transition-all ${
                        sel ? 'bg-primary text-primary-foreground' :
                        past ? 'opacity-30 cursor-not-allowed text-muted-foreground' :
                        closed ? 'opacity-40 cursor-not-allowed text-muted-foreground bg-destructive/5 border border-destructive/20' :
                        'bg-secondary text-muted-foreground hover:bg-primary/20 hover:text-foreground'
                      }`}
                    >
                      <span className="text-[10px]">{format(day, 'EEE')}</span>
                      <span className="font-semibold text-sm">{format(day, 'd')}</span>
                      {closed && <Ban className="w-2.5 h-2.5 mt-0.5 text-destructive/50" />}
                    </button>
                  );
                })}
              </div>

              {/* Time slots */}
              {selectedDate && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">Available times</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary/60 inline-block" />Available</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-border inline-block" />Unavailable</span>
                    </div>
                  </div>
                  {loadingSlots ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 max-h-44 overflow-y-auto pr-1">
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
                  )}
                </>
              )}

              <div className="flex gap-3 mt-5">
                <Button variant="outline" onClick={() => setStep(selectedService?.staff_ids?.length > 0 ? 2 : 1)} className="border-border text-foreground">Back</Button>
                  <Button
                    onClick={() => setStep(3)}
                    disabled={!selectedDate || !selectedTime}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Continue
                  </Button>
              </div>
            </div>
           ) : step === 3 ? (
            <div>
              <h4 className="font-semibold text-foreground mb-4">Your Details</h4>
               <div className="space-y-4">
                 <div>
                   <Label className="text-muted-foreground text-xs mb-1">Full Name</Label>
                   <Input
                     value={form.name}
                     onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                     placeholder="John Doe"
                     className="bg-secondary border-border text-foreground"
                   />
                 </div>
                 <div>
                   <Label className="text-muted-foreground text-xs mb-1">Email</Label>
                   <Input
                     type="email"
                     value={form.email}
                     onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                     placeholder="john@email.com"
                     className="bg-secondary border-border text-foreground"
                   />
                 </div>
                 <div>
                   <Label className="text-muted-foreground text-xs mb-1">Phone (optional)</Label>
                   <Input
                     value={form.phone}
                     onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                     placeholder="+1 555 000 0000"
                     className="bg-secondary border-border text-foreground"
                   />
                 </div>
                 <div>
                   <Label className="text-muted-foreground text-xs mb-1">Special Requests / Notes (optional)</Label>
                   <textarea
                     value={form.notes}
                     onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                     placeholder="Any allergies, preferences, or special requests..."
                     rows={3}
                     className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                   />
                 </div>
               </div>
               <div className="flex gap-3 mt-5">
                 <Button variant="outline" onClick={() => setStep(2)} className="border-border text-foreground">Back</Button>
                   <Button
                     onClick={() => setStep(4)}
                     disabled={!form.name || !form.email}
                     className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                   >
                     Review Booking
                   </Button>
               </div>
             </div>
           ) : (
             <div>
              <h4 className="font-semibold text-foreground mb-4">Confirm Booking</h4>
              <div className="bg-secondary rounded-xl border border-border p-4 space-y-3 mb-5">
                {[
                  ['Service', selectedService?.name],
                  ['With', selectedStaffMember.name],
                   ['Date', selectedDate ? format(selectedDate, 'EEEE, MMMM d') : ''],
                   ['Time', selectedTime ? formatAmPm(selectedTime) : ''],
                   ['Duration', `${selectedService?.duration_minutes} min`],
                   ['Price', `$${selectedService?.price}`],
                   ['Name', form.name],
                   ['Email', form.email],
                 ].map(([label, val]) => (
                   <div key={label} className="flex justify-between text-sm">
                     <span className="text-muted-foreground">{label}</span>
                     <span className="text-foreground font-medium">{val}</span>
                   </div>
                 ))}
               </div>
               {!isStaffValidForService() && (
                 <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 mb-4">
                   <Clock className="w-4 h-4 text-destructive flex-shrink-0" />
                   <p className="text-sm text-destructive">{selectedStaffMember?.name} is not assigned to perform {selectedService?.name}.</p>
                 </div>
               )}
               {submitError && (
                 <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 mb-4">
                   <Clock className="w-4 h-4 text-destructive flex-shrink-0" />
                   <p className="text-sm text-destructive">{submitError}</p>
                 </div>
               )}
               <div className="flex gap-3">
                 <Button variant="outline" onClick={() => { setStep(3); setSubmitError(''); }} className="border-border text-foreground">Back</Button>
                 <Button
                   onClick={handleBook}
                   disabled={submitting || !isStaffValidForService()}
                   className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                 >
                   {submitting ? 'Processing...' : `Pay Deposit $${selectedService?.price}`}
                 </Button>
               </div>
             </div>
           )}
         </div>
       </div>
     </div>
   );
}