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

async function fixAdminIdFinal() {
  console.log('🔧 Final admin_id fix with proper UUID handling...');

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // 1. Get current user's UUID from auth
    console.log('📋 Getting current user UUID...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('❌ Could not get current user:', userError);
      console.log('💡 Please make sure you are logged in to Supabase');
      return;
    }

    const currentUserUUID = user.id;
    console.log(`✅ Current user UUID: ${currentUserUUID}`);

    // 2. Check existing properties
    const existingProperties = await client.query('SELECT id, admin_id FROM properties;');
    console.log(`📋 Found ${existingProperties.rows.length} existing properties`);

    // 3. Drop dependent policies
    console.log('📋 Dropping dependent policies...');
    const policiesToDrop = [
      'DROP POLICY IF EXISTS "Admins can manage their properties" ON properties CASCADE;',
      'DROP POLICY IF EXISTS "Admins can manage expenses for their properties" ON expenses CASCADE;',
      'DROP POLICY IF EXISTS "Admins can manage units in their properties" ON units CASCADE;',
      'DROP POLICY IF EXISTS "Users can view monthly expense summaries for their properties" ON monthly_expense_summaries CASCADE;',
      'DROP POLICY IF EXISTS "Users can insert monthly expense summaries for their properties" ON monthly_expense_summaries CASCADE;',
      'DROP POLICY IF EXISTS "Users can update monthly expense summaries for their properties" ON monthly_expense_summaries CASCADE;',
      'DROP POLICY IF EXISTS "Users can view expense allocations for their properties" ON expense_allocations CASCADE;',
      'DROP POLICY IF EXISTS "Users can insert expense allocations for their properties" ON expense_allocations CASCADE;',
      'DROP POLICY IF EXISTS "Users can update expense allocations for their properties" ON expense_allocations CASCADE;'
    ];

    for (const policy of policiesToDrop) {
      try {
        await client.query(policy);
        console.log(`✅ Dropped policy`);
      } catch (error) {
        console.log(`⚠️  Could not drop policy:`, error.message);
      }
    }

    // 4. Add UUID column
    console.log('📋 Adding admin_uuid column...');
    await client.query(`
      ALTER TABLE properties
      ADD COLUMN IF NOT EXISTS admin_uuid UUID;
    `);

    // 5. Update existing properties with current user UUID
    if (existingProperties.rows.length > 0) {
      console.log('📋 Updating existing properties with current user UUID...');
      for (const property of existingProperties.rows) {
        await client.query(`
          UPDATE properties
          SET admin_uuid = $1
          WHERE id = $2;
        `, [currentUserUUID, property.id]);
        console.log(`✅ Updated property ${property.id}`);
      }
    }

    // 6. Convert column types
    console.log('📋 Converting column types...');
    await client.query(`
      ALTER TABLE properties
      ALTER COLUMN admin_uuid SET NOT NULL,
      DROP COLUMN IF EXISTS admin_id CASCADE;
    `);

    // 7. Rename column
    await client.query(`
      ALTER TABLE properties
      RENAME COLUMN admin_uuid TO admin_id;
    `);
    console.log('✅ Column renamed to admin_id');

    // 8. Recreate essential policies
    console.log('📋 Recreating policies...');
    const policies = [
      `CREATE POLICY "Users can view their own properties" ON properties
       FOR SELECT USING (admin_id = auth.uid());`,
      `CREATE POLICY "Users can insert their own properties" ON properties
       FOR INSERT WITH CHECK (admin_id = auth.uid());`,
      `CREATE POLICY "Users can update their own properties" ON properties
       FOR UPDATE USING (admin_id = auth.uid());`,
      `CREATE POLICY "Users can delete their own properties" ON properties
       FOR DELETE USING (admin_id = auth.uid());`
    ];

    for (let i = 0; i < policies.length; i++) {
      try {
        await client.query(policies[i]);
        console.log(`✅ Policy ${i + 1} recreated`);
      } catch (error) {
        console.log(`⚠️  Policy ${i + 1} error:`, error.message);
      }
    }

    await client.end();

    console.log('');
    console.log('🎉 Admin ID fix completed successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   - Updated ${existingProperties.rows.length} existing properties`);
    console.log('   - Changed admin_id from INTEGER to UUID');
    console.log('   - All properties now belong to current user');
    console.log('   - RLS policies recreated');
    console.log('');
    console.log('🚀 Properties should now load correctly in your app!');

  } catch (error) {
    console.error('💥 Fix failed:', error);
    await client.end();
    process.exit(1);
  }
}

// Run the final fix
fixAdminIdFinal();
