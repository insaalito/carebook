import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { salon_id } = await req.json();
        if (!salon_id) {
            return Response.json({ error: 'Missing salon_id' }, { status: 400 });
        }

        // Verify salon belongs to this user
        const salons = await base44.asServiceRole.entities.Salon.filter({ id: salon_id, owner_email: user.email });
        if (!salons || salons.length === 0) {
            return Response.json({ error: 'Salon not found or not authorized' }, { status: 403 });
        }

        // 1. Find all staff linked to this salon
        const staffList = await base44.asServiceRole.entities.Staff.filter({ salon_id });

        // 2. For each staff with a user_email, find their user and reset their role/BusinessID
        for (const staff of staffList) {
            if (staff.user_email) {
                const users = await base44.asServiceRole.entities.User.filter({ email: staff.user_email });
                if (users && users[0]) {
                    await base44.asServiceRole.entities.User.update(users[0].id, {
                        role: 'user',
                        BusinessID: '',
                    });
                    console.log(`Reset user ${staff.user_email}`);
                }
            }
        }

        // 3. Reset the owner themselves
        await base44.asServiceRole.entities.User.update(user.id, {
            role: 'user',
            BusinessID: '',
        });
        console.log(`Reset owner ${user.email}`);

        // 4. Delete all staff records for this salon
        for (const staff of staffList) {
            await base44.asServiceRole.entities.Staff.delete(staff.id);
            console.log(`Deleted staff record ${staff.id}`);
        }

        // 5. Delete the salon record
        await base44.asServiceRole.entities.Salon.delete(salon_id);
        console.log(`Deleted salon ${salon_id}`);

        return Response.json({ success: true });
    } catch (error) {
        console.error('deleteSalon error:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});