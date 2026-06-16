import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { salonId } = await req.json().catch(() => ({}));

    if (!salonId) {
      return Response.json({ error: 'Salon ID required' }, { status: 400 });
    }

    // Always use the canonical app domain as redirect URI
    const origin = (req.headers.get('origin') || 'https://snipbook.base44.app').trim();
    const redirectUri = `${origin}/stripe-connect-callback`;

    // Trim the client ID to strip any stray whitespace/characters from the env value
    const clientId = (Deno.env.get('STRIPE_CONNECT_CLIENT_ID') || '').trim();

    if (!clientId) {
      console.error('STRIPE_CONNECT_CLIENT_ID is not set');
      return Response.json({ error: 'Stripe Connect not configured' }, { status: 500 });
    }

    console.log('Building Stripe Connect URL with client_id:', clientId);
    console.log('Redirect URI:', redirectUri);

    const stripeConnectUrl = new URL('https://connect.stripe.com/oauth/authorize');
    stripeConnectUrl.searchParams.set('response_type', 'code');
    stripeConnectUrl.searchParams.set('client_id', clientId);
    stripeConnectUrl.searchParams.set('state', salonId);
    stripeConnectUrl.searchParams.set('scope', 'read_write');
    stripeConnectUrl.searchParams.set('redirect_uri', redirectUri);
    stripeConnectUrl.searchParams.set('stripe_user[business_type]', 'individual');
    stripeConnectUrl.searchParams.set('stripe_user[country]', 'US');

    return Response.json({ url: stripeConnectUrl.toString() });
  } catch (error) {
    console.error('Stripe Connect URL error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});