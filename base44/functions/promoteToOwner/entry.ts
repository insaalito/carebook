import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { salon_id } = await req.json();

        if (!salon_id) {
            return Response.json({ error: 'Missing salon_id' }, { status: 400 });
        }

        // Verify the salon exists and belongs to this user
        const salons = await base44.asServiceRole.entities.Salon.filter({ id: salon_id, owner_email: user.email });
        if (!salons || salons.length === 0) {
            return Response.json({ error: 'Salon not found or does not belong to you' }, { status: 403 });
        }

        // Promote user to admin and stamp BusinessID using service role
        await base44.asServiceRole.entities.User.update(user.id, {
            role: 'admin',
            BusinessID: salon_id,
        });

        // Create a Staff profile for the salon owner
        await base44.asServiceRole.entities.Staff.create({
            salon_id: salon_id,
            user_email: user.email,
            name: user.full_name || 'Owner',
            role_title: 'Owner',
            is_active: true,
            is_owner_linked: true,
        });

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});