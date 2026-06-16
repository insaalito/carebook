import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Read code/state from POST body (sent by frontend via base44.functions.invoke)
    const body = await req.json().catch(() => ({}));
    const code = body.code;
    const state = body.state;
    const error = body.error;

    console.log('Stripe callback received — code:', code ? 'present' : 'missing', '| state:', state || 'missing');

    if (error) {
      console.error('Stripe OAuth error from body:', error);
      return Response.json({ error: `Stripe authorization failed: ${error}` }, { status: 400 });
    }

    if (!code || !state) {
      console.error('Missing code or state. body:', JSON.stringify(body));
      return Response.json({ error: 'Missing code or state' }, { status: 400 });
    }

    const clientSecret = (Deno.env.get('STRIPE_SECRET_KEY') || '').trim();

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://connect.stripe.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_secret: clientSecret,
      }).toString(),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Stripe token exchange error:', JSON.stringify(tokenData));
      return Response.json({ error: tokenData.error_description || 'Failed to exchange authorization code' }, { status: 400 });
    }

    const stripeAccountId = tokenData.stripe_user_id;
    const accessToken = tokenData.access_token;

    if (!stripeAccountId) {
      console.error('No stripe_user_id in token response:', JSON.stringify(tokenData));
      return Response.json({ error: 'No Stripe account ID returned' }, { status: 400 });
    }

    // Update salon with Stripe Connect credentials
    await base44.asServiceRole.entities.Salon.update(state, {
      stripe_connect_account_id: stripeAccountId,
      stripe_connect_access_token: accessToken,
    });

    console.log(`Salon ${state} successfully connected to Stripe account ${stripeAccountId}`);

    return Response.json({ success: true, salonId: state });
  } catch (error) {
    console.error('Stripe Connect callback error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});