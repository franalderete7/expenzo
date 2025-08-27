const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Use the direct PostgreSQL connection string
const connectionString = process.env.SUPABASE_DB_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!connectionString || !supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const client = new Client({ connectionString });
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function updateUserUUID() {
  console.log('🔧 Updating property admin_id with real user UUID...');

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // 1. Get current user's UUID from auth
    console.log('📋 Getting current user UUID...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('❌ Could not get current user. Please make sure you are logged in.');
      console.log('');
      console.log('💡 To get your UUID manually:');
      console.log('   1. Go to your Supabase dashboard');
      console.log('   2. Go to Authentication > Users');
      console.log('   3. Find your user and copy the UUID');
      console.log('   4. Then run this SQL manually:');
      console.log('      UPDATE properties SET admin_id = \'your-uuid-here\';');
      return;
    }

    const currentUserUUID = user.id;
    console.log(`✅ Current user UUID: ${currentUserUUID}`);

    // 2. Update all properties with placeholder UUID to use real user UUID
    const result = await client.query(`
      UPDATE properties
      SET admin_id = $1
      WHERE admin_id = '00000000-0000-0000-0000-000000000001';
    `, [currentUserUUID]);

    console.log(`✅ Updated ${result.rowCount} properties with your UUID`);

    // 3. Show current properties
    const properties = await client.query(`
      SELECT id, name, admin_id
      FROM properties
      ORDER BY name;
    `);

    console.log('');
    console.log('📋 Current properties:');
    properties.rows.forEach(prop => {
      console.log(`   - ${prop.name} (ID: ${prop.id}) - Owner: ${prop.admin_id}`);
    });

    await client.end();

    console.log('');
    console.log('🎉 User UUID update completed successfully!');
    console.log('');
    console.log('🚀 Your properties should now load correctly in the app!');
    console.log('');
    console.log('💡 All properties now belong to your user account');

  } catch (error) {
    console.error('💥 Update failed:', error);
    await client.end();
    process.exit(1);
  }
}

// Alternative: Manual UUID update
function showManualInstructions() {
  console.log('🔧 Manual UUID Update Instructions:');
  console.log('');
  console.log('If you prefer to update manually:');
  console.log('');
  console.log('1. Get your user UUID:');
  console.log('   - Go to Supabase Dashboard > Authentication > Users');
  console.log('   - Find your user and copy the UUID');
  console.log('');
  console.log('2. Run this SQL in Supabase SQL Editor:');
  console.log('   UPDATE properties SET admin_id = \'your-uuid-here\';');
  console.log('');
  console.log('3. Replace \'your-uuid-here\' with your actual UUID');
}

// Run based on arguments
if (process.argv[2] === 'manual') {
  showManualInstructions();
} else {
  updateUserUUID();
}
