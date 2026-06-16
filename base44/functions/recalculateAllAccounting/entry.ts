import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { salon_id } = await req.json();
    if (!salon_id) return Response.json({ error: 'salon_id required' }, { status: 400 });

    // Verify the admin owns this specific salon
    const salonList = await base44.asServiceRole.entities.Salon.filter({ id: salon_id });
    if (!salonList[0] || salonList[0].owner_email !== user.email) {
      return Response.json({ error: 'Forbidden: You do not own this salon' }, { status: 403 });
    }

    // Fetch all completed appointments for this salon
    const appointments = await base44.asServiceRole.entities.Appointment.filter({
      salon_id,
      status: 'completed',
    });

    const [settingsList, staffList] = await Promise.all([
      base44.asServiceRole.entities.BusinessSettings.filter({ salon_id }),
      base44.asServiceRole.entities.Staff.filter({ salon_id }),
    ]);

    const settings = settingsList[0] || {};
    const staffMap = {};
    staffList.forEach(s => { staffMap[s.id] = s; });

    let updated = 0;
    for (const appt of appointments) {
      const gross = appt.price || 0;
      const method = appt.payment_method || '';

      let processorFee = 0;
      if (method === 'Stripe_App') {
        const rate = (settings.stripe_rate_percentage ?? 2.9) / 100;
        const fixed = settings.stripe_fixed_fee ?? 0.30;
        processorFee = parseFloat((gross * rate + fixed).toFixed(2));
      } else if (method === 'ATH_Movil') {
        const rate = (settings.ath_movil_rate_percentage ?? 2.25) / 100;
        processorFee = parseFloat((gross * rate).toFixed(2));
      } else if (method === 'External_Card') {
        const rate = (settings.external_terminal_rate_percentage ?? 0) / 100;
        processorFee = parseFloat((gross * rate).toFixed(2));
      }

      const net = parseFloat((gross - processorFee).toFixed(2));
      const staffRecord = staffMap[appt.staff_id] || {};

      // Owner fee % = what owner keeps; staff gets the remainder
      let houseNet = 0;
      let staffPayout = net;
      if (staffRecord.owner_fee_enabled && staffRecord.owner_fee_percentage > 0) {
        houseNet = parseFloat((net * staffRecord.owner_fee_percentage / 100).toFixed(2));
        staffPayout = parseFloat((net - houseNet).toFixed(2));
      }

      await base44.asServiceRole.entities.Appointment.update(appt.id, {
        gross_amount: gross,
        processor_fee_deducted: processorFee,
        net_amount_to_split: net,
        staff_payout_amount: staffPayout,
        house_net_amount: houseNet,
      });
      updated++;
    }

    return Response.json({ ok: true, updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});