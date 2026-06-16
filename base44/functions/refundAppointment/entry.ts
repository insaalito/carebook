import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.7.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { appointment_id } = await req.json();
    if (!appointment_id) return Response.json({ error: 'appointment_id required' }, { status: 400 });

    const appt = await base44.asServiceRole.entities.Appointment.get(appointment_id);
    if (!appt) return Response.json({ error: 'Appointment not found' }, { status: 404 });

    const isOwner = appt.salon_owner_email === user.email;
    const isCustomer = appt.customer_email === user.email;
    const isStaff = appt.assigned_staff_email === user.email;
    if (!isOwner && !isCustomer && !isStaff) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // If no Stripe payment, just cancel without refund
    if (!appt.stripe_payment_intent_id || appt.payment_method !== 'Stripe_App') {
      await base44.asServiceRole.entities.Appointment.update(appointment_id, {
        status: 'cancelled',
        refund_status: 'none',
      });
      return Response.json({ ok: true, refunded: false, reason: 'No Stripe payment on record' });
    }

    if (appt.status === 'cancelled') {
      return Response.json({ ok: true, refunded: false, reason: 'Already cancelled' });
    }

    const salon = await base44.asServiceRole.entities.Salon.get(appt.salon_id);
    if (!salon?.stripe_connect_account_id) {
      await base44.asServiceRole.entities.Appointment.update(appointment_id, {
        status: 'cancelled',
        refund_status: 'none',
      });
      return Response.json({ ok: true, refunded: false, reason: 'Salon has no Stripe Connect account' });
    }

    // --- Tiered refund policy ---
    // > 24h before appointment → full refund (anyone)
    // ≤ 24h before appointment → partial refund (deduct Stripe processing fee), regardless of who cancels
    const apptDateTime = new Date(`${appt.date}T${appt.time_slot || '09:00'}:00`);
    const hoursUntil = (apptDateTime - new Date()) / (1000 * 60 * 60);
    console.log(`Appointment datetime: ${apptDateTime.toISOString()}, hoursUntil: ${hoursUntil.toFixed(2)}, cancelledBy: ${isOwner ? 'owner' : isStaff ? 'staff' : 'client'}`);
    const isFullRefund = isOwner || hoursUntil > 24;

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const gross = appt.gross_amount || appt.price || 0;

    let refundParams = { payment_intent: appt.stripe_payment_intent_id };
    let refundedAmount = gross;

    if (!isFullRefund) {
      // Fetch salon's fee config (fallback to Stripe defaults)
      const settings = await base44.asServiceRole.entities.BusinessSettings.filter({ salon_id: appt.salon_id });
      const biz = settings[0];
      const stripeRate = biz?.stripe_rate_percentage ?? 2.9;
      const stripeFixed = biz?.stripe_fixed_fee ?? 0.30;
      const stripeFee = parseFloat(((gross * stripeRate / 100) + stripeFixed).toFixed(2));
      refundedAmount = parseFloat((gross - stripeFee).toFixed(2));
      refundParams.amount = Math.round(refundedAmount * 100); // cents
      console.log(`Partial refund: gross=$${gross}, fee=$${stripeFee}, refund=$${refundedAmount}`);
    } else {
      console.log(`Full refund: gross=$${gross}`);
    }

    const refund = await stripe.refunds.create(refundParams, { stripeAccount: salon.stripe_connect_account_id });
    console.log('Refund created:', refund.id, 'status:', refund.status);

    await base44.asServiceRole.entities.Appointment.update(appointment_id, {
      status: 'cancelled',
      refund_status: refund.status === 'succeeded' ? 'refunded' : 'failed',
    });

    return Response.json({
      ok: true,
      refunded: true,
      refund_id: refund.id,
      refund_status: refund.status,
      refund_type: isFullRefund ? 'full' : 'partial',
      refunded_amount: refundedAmount,
      gross_amount: gross,
    });
  } catch (error) {
    console.error('Refund error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});