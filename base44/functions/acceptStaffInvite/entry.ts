import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'You must be logged in to accept an invite.' }, { status: 401 });
    }

    const { token } = await req.json();
    if (!token) {
      return Response.json({ error: 'Missing invite token.' }, { status: 400 });
    }

    // Find the pending invite by token
    const invites = await base44.asServiceRole.entities.StaffInvite.filter({
      token: token,
      status: 'pending',
    });

    if (invites.length === 0) {
      return Response.json({ error: 'Invalid, expired, or already accepted invite.' }, { status: 404 });
    }

    const invite = invites[0];

    // Verify the logged-in user's email matches the invite email
    if (user.email !== invite.email) {
      return Response.json({
        error: `This invite was sent to ${invite.email}. Please log in with that email address.`,
      }, { status: 403 });
    }

    // Check if user is already linked to a different salon
    if (user.LinkedBusinessID && user.LinkedBusinessID !== invite.salon_id) {
      return Response.json({
        error: 'You are already linked to another salon. Please contact support to change salons.',
      }, { status: 409 });
    }

    // Find or create Staff record for this user
    const existingStaff = await base44.asServiceRole.entities.Staff.filter({
      salon_id: invite.salon_id,
      user_email: user.email,
    });

    if (existingStaff.length > 0) {
      // Update existing staff record
      await base44.asServiceRole.entities.Staff.update(existingStaff[0].id, {
        is_owner_linked: true,
      });
    } else {
      // Create new staff record
      await base44.asServiceRole.entities.Staff.create({
        salon_id: invite.salon_id,
        user_email: user.email,
        name: user.full_name || user.email,
        role_title: 'Barber',
        is_owner_linked: true,
        is_active: false,
      });
    }

    // Link user to business
    await base44.asServiceRole.entities.User.update(user.id, {
      LinkedBusinessID: invite.salon_id,
    });

    // Mark invite as accepted
    await base44.asServiceRole.entities.StaffInvite.update(invite.id, {
      status: 'accepted',
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error accepting staff invite:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});