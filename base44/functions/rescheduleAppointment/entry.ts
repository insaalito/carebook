import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { appointment_id, new_date, new_time, note } = await req.json();
    if (!appointment_id || !new_date || !new_time) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch the appointment
    const appt = await base44.asServiceRole.entities.Appointment.get(appointment_id);
    if (!appt) return Response.json({ error: 'Appointment not found' }, { status: 404 });

    // Check no other confirmed appointment blocks the new slot for this staff member
    const sameDay = await base44.asServiceRole.entities.Appointment.filter({
      staff_id: appt.staff_id,
      date: new_date,
    });

    const newSlotStart = timeToMinutes(new_time);
    const newSlotEnd = newSlotStart + (appt.duration_minutes || 30);

    const conflict = sameDay.filter(a => a.id !== appointment_id && ['confirmed'].includes(a.status)).some(a => {
      const aStart = timeToMinutes(a.time_slot);
      const aEnd = aStart + (a.duration_minutes || 30);
      return newSlotStart < aEnd && newSlotEnd > aStart;
    });

    if (conflict) {
      return Response.json({ error: 'That time slot is already booked.' }, { status: 409 });
    }

    // Update appointment
    await base44.asServiceRole.entities.Appointment.update(appointment_id, {
      date: new_date,
      time_slot: new_time,
    });

    // Send notification email to client (best-effort — client may not be an app user)
    if (appt.customer_email) {
      try {
        const noteSection = note ? `\n\nNote from your barber:\n"${note}"` : '';
        await base44.integrations.Core.SendEmail({
          to: appt.customer_email,
          subject: `Your appointment has been rescheduled — ${appt.salon_name}`,
          body: `Hi ${appt.customer_name},\n\nYour appointment for ${appt.service_name} with ${appt.staff_name} has been rescheduled.\n\nNew Date: ${new_date}\nNew Time: ${new_time}${noteSection}\n\nIf you have any questions, please contact the salon directly.\n\n— ${appt.salon_name}`,
        });
      } catch (_emailErr) {
        // Email failed (e.g. client not an app user) — ignore, reschedule still succeeds
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});