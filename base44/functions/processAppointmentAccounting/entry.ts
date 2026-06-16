import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { appointment_id } = await req.json();
    if (!appointment_id) return Response.json({ error: 'appointment_id required' }, { status: 400 });

    const appt = await base44.asServiceRole.entities.Appointment.get(appointment_id);
    if (!appt) return Response.json({ error: 'Appointment not found' }, { status: 404 });

    // Verify the caller owns this salon OR is the assigned staff member
    const isOwner = appt.salon_owner_email === user.email;
    const isAssignedStaff = appt.assigned_staff_email === user.email;
    if (!isOwner && !isAssignedStaff) {
      return Response.json({ error: 'Forbidden: Access denied' }, { status: 403 });
    }

    const gross = appt.gross_amount || appt.price || 0;

    // Fetch business settings for processor fees
    const [settingsList, staffRecord] = await Promise.all([
      base44.asServiceRole.entities.BusinessSettings.filter({ salon_id: appt.salon_id }),
      base44.asServiceRole.entities.Staff.get(appt.staff_id),
    ]);

    const settings = settingsList[0] || {};

    // Calculate processor fee based on payment method
    let processorFee = 0;
    const method = appt.payment_method || '';
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

    // Owner fee % = what the owner keeps; staff receives the remainder
    let houseNet = 0;
    let staffPayout = net;
    if (staffRecord.owner_fee_enabled && staffRecord.owner_fee_percentage > 0) {
      houseNet = parseFloat((net * staffRecord.owner_fee_percentage / 100).toFixed(2));
      staffPayout = parseFloat((net - houseNet).toFixed(2));
    }

    await base44.asServiceRole.entities.Appointment.update(appointment_id, {
      gross_amount: gross,
      processor_fee_deducted: processorFee,
      net_amount_to_split: net,
      staff_payout_amount: staffPayout,
      house_net_amount: houseNet,
    });

    return Response.json({ ok: true, gross, processorFee, net, staffPayout, houseNet });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});