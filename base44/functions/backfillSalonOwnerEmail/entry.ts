import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Backfill function: populates salon_owner_email on all Appointments and ClientNotes
// that are missing it. Safe to run multiple times (idempotent).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Find this admin's salon
    const salons = await base44.asServiceRole.entities.Salon.filter({ owner_email: user.email });
    if (!salons.length) {
      return Response.json({ error: 'No salon found for this owner' }, { status: 404 });
    }
    const salon = salons[0];
    const owner_email = salon.owner_email;

    // Load all staff for this salon for name lookup
    const allStaff = await base44.asServiceRole.entities.Staff.filter({ salon_id: salon.id });
    const staffMap = {};
    for (const s of allStaff) staffMap[s.id] = s.name;

    // Backfill Appointments missing salon_owner_email or staff_name
    const allAppts = await base44.asServiceRole.entities.Appointment.filter({ salon_id: salon.id });
    const apptsMissing = allAppts.filter(a => !a.salon_owner_email || !a.staff_name);

    let apptUpdated = 0;
    for (const appt of apptsMissing) {
      const updates = {};
      if (!appt.salon_owner_email) updates.salon_owner_email = owner_email;
      if (!appt.staff_name && appt.staff_id && staffMap[appt.staff_id]) {
        updates.staff_name = staffMap[appt.staff_id];
      }
      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.Appointment.update(appt.id, updates);
        apptUpdated++;
      }
    }

    // Backfill ClientNotes missing salon_owner_email
    const allNotes = await base44.asServiceRole.entities.ClientNote.filter({ salon_id: salon.id });
    const notesMissing = allNotes.filter(n => !n.salon_owner_email);

    let notesUpdated = 0;
    for (const note of notesMissing) {
      await base44.asServiceRole.entities.ClientNote.update(note.id, { salon_owner_email: owner_email });
      notesUpdated++;
    }

    return Response.json({ ok: true, apptUpdated, notesUpdated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});