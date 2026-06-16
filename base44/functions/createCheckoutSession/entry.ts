import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.7.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { salonId, serviceId, staffId, serviceName, price, date, timeSlot, customerEmail, customerName, customerPhone } = await req.json();

    if (!salonId || !serviceId || !staffId || !price || !date || !timeSlot) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get salon details for connected Stripe account
    const salon = await base44.asServiceRole.entities.Salon.get(salonId);

    if (!salon.stripe_connect_account_id) {
      return Response.json({ error: 'Salon has not connected a Stripe account yet.' }, { status: 400 });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    // Determine app domain from request origin header
    const origin = req.headers.get('origin') || 'https://snipbook.base44.app';
    const appDomain = origin.replace(/\/$/, '');

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: serviceName,
              description: `Appointment for ${serviceName}`,
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        salonId,
        serviceId,
        staffId,
        serviceName,
        price: String(price),
        date,
        timeSlot,
        customerEmail: customerEmail || '',
        customerName: customerName || '',
        customerPhone: customerPhone || '',
      },
      success_url: `${appDomain}/payment-success?session_id={CHECKOUT_SESSION_ID}&salon_id=${salonId}`,
      cancel_url: `${appDomain}/salon/${salonId}`,
    }, {
      stripeAccount: salon.stripe_connect_account_id,
    });

    console.log('Checkout session created:', session.id, 'for connected account:', salon.stripe_connect_account_id);

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Checkout session error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});