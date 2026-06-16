import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Convert "HH:MM" to total minutes from midnight
function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const {
      salon_id, salon_name,
      staff_id, staff_name,
      service_id, service_name,
      customer_email, customer_name, customer_phone,
      date, time_slot,
      duration_minutes, price, notes,
    } = body;

    // Validate required fields
    if (!salon_id || !staff_id || !service_id || !customer_email || !customer_name || !date || !time_slot) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch salon config to get slot_interval and buffer
    const salons = await base44.asServiceRole.entities.Salon.filter({ id: salon_id });
    const salon = salons[0];
    if (!salon) return Response.json({ error: 'Salon not found' }, { status: 404 });

    const salon_owner_email = salon.owner_email || '';

    const slotInterval = salon.slot_interval_minutes || 30;
    const buffer = salon.buffer_minutes || 0;

    const newStart = timeToMinutes(time_slot);
    const newEnd = newStart + (duration_minutes || slotInterval);

    // Fetch all existing confirmed/pending appointments, staff exclusions, and staff closures
    const [existing, staffExclusions, staffClosures] = await Promise.all([
      base44.asServiceRole.entities.Appointment.filter({
        staff_id,
        date,
      }),
      base44.asServiceRole.entities.StaffExclusion.filter({
        staff_id,
      }),
      base44.asServiceRole.entities.StaffClosureDate.filter({
        staff_id,
      }),
    ]);

    // Check if staff is completely closed on this date
    if (staffClosures.some(c => c.date === date)) {
      return Response.json(
        { error: 'This staff member is unavailable on this date.' },
        { status: 409 }
      );
    }

    const conflicting = existing.filter(appt => {
      if (['cancelled'].includes(appt.status)) return false;
      const apptStart = timeToMinutes(appt.time_slot);
      const apptDuration = appt.duration_minutes || slotInterval;
      const apptEnd = apptStart + apptDuration + buffer; // include buffer after existing appt
      // Overlap if new slot starts before existing ends AND new slot ends after existing starts
      return newStart < apptEnd && newEnd > apptStart;
    });

    if (conflicting.length > 0) {
      return Response.json(
        { error: 'This time slot is no longer available. Please choose another time.' },
        { status: 409 }
      );
    }

    // Check staff-specific exclusion blocks (time-based)
    const dayName = new Date(date + 'T00:00:00').toLocaleString('en-US', { weekday: 'long' });
    const staffBlocked = staffExclusions.some(exc => {
      const matches = (exc.type === 'recurring' && exc.day_of_week === dayName) ||
                      (exc.type === 'one_time' && exc.specific_date === date);
      if (!matches) return false;
      const excStart = timeToMinutes(exc.start_time);
      const excEnd = timeToMinutes(exc.end_time);
      return newStart < excEnd && newEnd > excStart;
    });

    if (staffBlocked) {
      return Response.json(
        { error: 'This staff member is unavailable during this time.' },
        { status: 409 }
      );
    }

    // Look up the staff record to capture the assigned staff member's user email (their User ID)
    const staffRecord = await base44.asServiceRole.entities.Staff.get(staff_id);
    const assigned_staff_email = staffRecord?.user_email || '';

    // All clear — create the appointment
    const appointment = await base44.asServiceRole.entities.Appointment.create({
      salon_id,
      salon_name,
      staff_id,
      staff_name,
      assigned_staff_email,
      service_id,
      service_name,
      customer_email,
      customer_name,
      customer_phone: customer_phone || '',
      date,
      time_slot,
      duration_minutes: duration_minutes || slotInterval,
      price: price || 0,
      status: 'confirmed',
      notes: notes || '',
      salon_owner_email,
    });

    return Response.json({ appointment });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});