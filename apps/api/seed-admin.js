/**
 * Seed / fix admin user in Supabase Auth.
 * Run once: node seed-admin.js
 * 
 * Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
    console.error('   Usage: SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=eyJ... node seed-admin.js');
    process.exit(1);
}

const ADMIN_EMAIL = 'admin@safinstitute.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@SAF2026!';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function seedAdmin() {
    console.log('🔍 Looking up admin user:', ADMIN_EMAIL);

    // List all users and find admin
    const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) {
        console.error('❌ Failed to list users:', listErr.message);
        process.exit(1);
    }

    const existing = users.find(u => u.email === ADMIN_EMAIL);

    if (existing) {
        console.log('✅ Admin user found. ID:', existing.id);
        console.log('   Current app_metadata:', JSON.stringify(existing.app_metadata));

        // Update password and set admin role
        const { error: updateErr } = await supabase.auth.admin.updateUserById(existing.id, {
            password: ADMIN_PASSWORD,
            app_metadata: { role: 'admin' },
            email_confirm: true,
        });

        if (updateErr) {
            console.error('❌ Failed to update admin user:', updateErr.message);
            process.exit(1);
        }

        console.log('✅ Admin user updated:');
        console.log('   Email:', ADMIN_EMAIL);
        console.log('   Role: admin');
    } else {
        console.log('➕ Admin user not found. Creating...');

        const { data, error: createErr } = await supabase.auth.admin.createUser({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            email_confirm: true,
            app_metadata: { role: 'admin' },
            user_metadata: {
                first_name: 'Admin',
                last_name: 'SAF',
            },
        });

        if (createErr) {
            console.error('❌ Failed to create admin user:', createErr.message);
            process.exit(1);
        }

        console.log('✅ Admin user created:');
        console.log('   ID:', data.user.id);
        console.log('   Email:', ADMIN_EMAIL);
        console.log('   Role: admin');
    }

    console.log('\n🎉 Done! Login at http://localhost:3000/admin/login');
    console.log('   Email:', ADMIN_EMAIL);
}

seedAdmin().catch(console.error);
