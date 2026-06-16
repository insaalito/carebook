import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { staff_id, date, salon_id } = await req.json();

    if (!staff_id || !date || !salon_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const [appointments, exclusions, staffExclusions, staffClosures] = await Promise.all([
      base44.asServiceRole.entities.Appointment.filter({ staff_id, date }),
      base44.asServiceRole.entities.BusinessExclusion.filter({ salon_id }),
      base44.asServiceRole.entities.StaffExclusion.filter({ staff_id }),
      base44.asServiceRole.entities.StaffClosureDate.filter({ staff_id }),
    ]);

    // Only return confirmed/completed/no_show — not cancelled
    const booked = appointments
      .filter(a => a.status !== 'cancelled')
      .map(a => ({
        time_slot: a.time_slot,
        duration_minutes: a.duration_minutes,
      }));

    // Check if staff is closed on this date
    const isStaffClosed = staffClosures.some(c => c.date === date);

    return Response.json({ booked, exclusions, staff_exclusions: staffExclusions, is_staff_closed: isStaffClosed });
  } catch (error) {
    console.error('getBookedSlots error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});