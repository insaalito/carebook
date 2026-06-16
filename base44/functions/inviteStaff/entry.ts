import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { salon_id, email } = await req.json();

    if (!salon_id || !email) {
      return Response.json({ error: 'Missing salon_id or email' }, { status: 400 });
    }

    // Verify the requesting user owns this salon
    const salons = await base44.asServiceRole.entities.Salon.filter({ id: salon_id });
    if (!salons[0] || salons[0].owner_email !== user.email) {
      return Response.json({ error: 'Forbidden: You do not own this salon' }, { status: 403 });
    }

    // Generate a secure random token
    const token = crypto.randomUUID() + '-' + crypto.randomUUID();

    // Create the StaffInvite record
    await base44.asServiceRole.entities.StaffInvite.create({
      salon_id,
      email,
      token,
      status: 'pending',
    });

    // Build the invite link
    const origin = req.headers.get('origin') || req.headers.get('referer') || '';
    const baseUrl = origin.replace(/\/$/, '').split('/').slice(0, 3).join('/');
    const inviteLink = `${baseUrl}/staff-join?token=${token}`;

    // Try to send email via platform invite (works for existing app users)
    // Fall back gracefully if the recipient isn't in the app yet — the link is returned too
    let emailSent = false;
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: `You've been invited to join ${salons[0].name} on SnipBook`,
        body: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0d0d0d;color:#f0f0f0;padding:32px;border-radius:12px;">
            <h2 style="color:#c9a84c;font-size:28px;margin-bottom:8px;">You're Invited!</h2>
            <p style="color:#aaa;margin-bottom:24px;">You've been invited to join <strong style="color:#f0f0f0;">${salons[0].name}</strong> as a staff member on SnipBook.</p>
            <a href="${inviteLink}" style="display:inline-block;background:#c9a84c;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">Accept Invitation</a>
            <p style="color:#666;font-size:12px;margin-top:24px;">Or copy this link:<br/>${inviteLink}</p>
            <p style="color:#555;font-size:11px;">This invite was sent to ${email}. If you weren't expecting this, you can ignore it.</p>
          </div>
        `,
      });
      emailSent = true;
    } catch (emailErr) {
      console.log('Email send failed (user may not be in app yet):', emailErr.message);
      // Non-fatal — we still return the invite link so the owner can share it manually
    }

    return Response.json({ success: true, invite_link: inviteLink, email_sent: emailSent });
  } catch (error) {
    console.error('inviteStaff error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});