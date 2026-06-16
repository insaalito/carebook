import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.7.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, salonId } = await req.json();

    if (!sessionId || !salonId) {
      return Response.json({ error: 'Missing session ID or salon ID' }, { status: 400 });
    }

    // Look up salon to get the connected Stripe account
    const salon = await base44.asServiceRole.entities.Salon.get(salonId);

    if (!salon.stripe_connect_account_id) {
      return Response.json({ error: 'Salon has no connected Stripe account' }, { status: 400 });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    // Retrieve the session from the CONNECTED account
    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      { stripeAccount: salon.stripe_connect_account_id }
    );

    console.log('Session retrieved, payment_status:', session.payment_status);

    if (session.payment_status !== 'paid') {
      return Response.json({ error: 'Payment not completed' }, { status: 400 });
    }

    // Resolve the payment_intent ID — for Connect accounts it may need to be
    // fetched from the PaymentIntent directly if the session only has a PI id string
    let paymentIntentId = session.payment_intent;
    if (!paymentIntentId) {
      // Try expanding the session to get the payment intent
      const expandedSession = await stripe.checkout.sessions.retrieve(
        sessionId,
        { expand: ['payment_intent'], stripeAccount: salon.stripe_connect_account_id }
      );
      paymentIntentId = expandedSession.payment_intent?.id || expandedSession.payment_intent || null;
    }
    // payment_intent might be a full object (expanded) — extract the id string
    if (paymentIntentId && typeof paymentIntentId === 'object') {
      paymentIntentId = paymentIntentId.id;
    }
    console.log('Resolved payment_intent_id:', paymentIntentId);

    // Extract appointment data from metadata
    const { serviceId, staffId, serviceName, date, timeSlot, customerEmail, customerName, customerPhone, price } = session.metadata;

    // Fetch staff name
    const staffRecord = await base44.asServiceRole.entities.Staff.get(staffId);
    const staffName = staffRecord?.name || '';

    // Idempotency check — prevent duplicate bookings if user navigates back
    const existing = await base44.asServiceRole.entities.Appointment.filter({
      stripe_payment_intent_id: paymentIntentId,
    });
    if (existing && existing.length > 0) {
      console.log('Appointment already exists for this payment intent, skipping creation:', existing[0].id);
      return Response.json({ success: true, appointmentId: existing[0].id, duplicate: true });
    }

    // Create the appointment
    const appointment = await base44.asServiceRole.entities.Appointment.create({
      salon_id: salonId,
      salon_owner_email: salon.owner_email,
      staff_id: staffId,
      service_id: serviceId,
      customer_email: customerEmail,
      customer_name: customerName,
      customer_phone: customerPhone,
      date,
      time_slot: timeSlot,
      service_name: serviceName,
      staff_name: staffName,
      salon_name: salon.name,
      price: parseFloat(price),
      duration_minutes: 30,
      status: 'confirmed',
      payment_type: 'Booking',
      payment_method: 'Stripe_App',
      gross_amount: parseFloat(price),
      stripe_payment_intent_id: paymentIntentId || null,
    });

    console.log('Appointment created:', appointment.id);

    return Response.json({ success: true, appointmentId: appointment.id });
  } catch (error) {
    console.error('Confirmation error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});