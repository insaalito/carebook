import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const now = new Date().toISOString().split('T')[0];

    // Step 1: Cancel all future confirmed appointments for this client
    const futureAppts = await base44.entities.Appointment.filter({
      customer_email: user.email,
      status: 'confirmed',
    });

    for (const appt of futureAppts) {
      if (appt.date >= now) {
        await base44.asServiceRole.entities.Appointment.update(appt.id, { status: 'cancelled' });
      }
    }

    // Step 2: Delete client preferences
    const prefs = await base44.entities.ClientPreference.filter({ customer_email: user.email });
    for (const pref of prefs) {
      await base44.entities.ClientPreference.delete(pref.id);
    }

    // Step 3: Delete the user record (service role required)
    await base44.asServiceRole.entities.User.delete(user.id);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});