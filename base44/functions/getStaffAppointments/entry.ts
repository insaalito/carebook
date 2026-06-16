import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Authenticate the logged-in user
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Find the Staff record linked to this user account
    const staffRecords = await base44.asServiceRole.entities.Staff.filter({ user_email: user.email });
    if (!staffRecords.length) {
      return Response.json({ appointments: [], staffRecord: null });
    }

    const staffRecord = staffRecords[0];

    // Fetch this staff member's own appointments (for EmployeeDashboard earnings)
    const appointments = await base44.asServiceRole.entities.Appointment.filter({
      staff_id: staffRecord.id,
    });

    // Fetch ALL salon appointments + all active staff for CalendarPage
    const [salonAppointments, salonStaff, bizSettings] = await Promise.all([
      base44.asServiceRole.entities.Appointment.filter({ salon_id: staffRecord.salon_id }),
      base44.asServiceRole.entities.Staff.filter({ salon_id: staffRecord.salon_id, is_active: true }),
      base44.asServiceRole.entities.BusinessSettings.filter({ salon_id: staffRecord.salon_id }),
    ]);

    const allowTeamView = bizSettings[0]?.allow_staff_view_team_calendar ?? false;

    return Response.json({ appointments, staffRecord, salonAppointments, salonStaff, allowTeamView });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});