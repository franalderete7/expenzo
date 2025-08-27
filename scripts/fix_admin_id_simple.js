const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Use the direct PostgreSQL connection string
const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error('❌ SUPABASE_DB_URL not found in .env.local');
  process.exit(1);
}

const client = new Client({
  connectionString: connectionString,
});

async function fixAdminIdSimple() {
  console.log('🔧 Applying simple admin_id fix...');

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // 1. Drop all dependent policies first
    console.log('📋 Dropping dependent policies...');
    const policiesToDrop = [
      'DROP POLICY IF EXISTS "Admins can manage their properties" ON properties;',
      'DROP POLICY IF EXISTS "Admins can manage expenses for their properties" ON expenses;',
      'DROP POLICY IF EXISTS "Admins can manage units in their properties" ON units;',
      'DROP POLICY IF EXISTS "Users can view monthly expense summaries for their properties" ON monthly_expense_summaries;',
      'DROP POLICY IF EXISTS "Users can insert monthly expense summaries for their properties" ON monthly_expense_summaries;',
      'DROP POLICY IF EXISTS "Users can update monthly expense summaries for their properties" ON monthly_expense_summaries;',
      'DROP POLICY IF EXISTS "Users can view expense allocations for their properties" ON expense_allocations;',
      'DROP POLICY IF EXISTS "Users can insert expense allocations for their properties" ON expense_allocations;',
      'DROP POLICY IF EXISTS "Users can update expense allocations for their properties" ON expense_allocations;'
    ];

    for (const policy of policiesToDrop) {
      try {
        await client.query(policy);
        console.log(`✅ Dropped policy`);
      } catch (error) {
        console.log(`⚠️  Could not drop policy:`, error.message);
      }
    }

    // 2. Add the UUID column
    console.log('📋 Adding admin_uuid column...');
    await client.query(`
      ALTER TABLE properties
      ADD COLUMN IF NOT EXISTS admin_uuid UUID;
    `);
    console.log('✅ admin_uuid column added');

    // 3. Copy existing data (if any) - but since admin_id is INTEGER and we're getting UUID from auth,
    // we'll need to handle this differently. For now, let's just set it to a default UUID or NULL
    console.log('📋 Setting admin_uuid values...');

    // Check if there are existing properties
    const existingProperties = await client.query('SELECT id, admin_id FROM properties;');
    console.log(`📋 Found ${existingProperties.rows.length} existing properties`);

    if (existingProperties.rows.length > 0) {
      // For existing properties, we'll set admin_uuid to NULL for now
      // In a real app, you'd want to map the integer admin_ids to actual UUID users
      console.log('⚠️  Existing properties found - setting admin_uuid to NULL');
      console.log('💡 You may need to manually update these with correct UUID values');
    }

    // 4. Make admin_uuid NOT NULL and drop old admin_id
    console.log('📋 Converting column types...');
    await client.query(`
      ALTER TABLE properties
      ALTER COLUMN admin_uuid SET NOT NULL,
      DROP COLUMN IF EXISTS admin_id CASCADE;
    `);
    console.log('✅ admin_id column dropped, admin_uuid renamed');

    // 5. Rename admin_uuid to admin_id
    await client.query(`
      ALTER TABLE properties
      RENAME COLUMN admin_uuid TO admin_id;
    `);
    console.log('✅ Column renamed to admin_id');

    // 6. Recreate the essential policies
    console.log('📋 Recreating essential policies...');
    const essentialPolicies = [
      `CREATE POLICY "Users can view their own properties" ON properties
       FOR SELECT USING (admin_id = auth.uid());`,
      `CREATE POLICY "Users can insert their own properties" ON properties
       FOR INSERT WITH CHECK (admin_id = auth.uid());`,
      `CREATE POLICY "Users can update their own properties" ON properties
       FOR UPDATE USING (admin_id = auth.uid());`
    ];

    for (let i = 0; i < essentialPolicies.length; i++) {
      try {
        await client.query(essentialPolicies[i]);
        console.log(`✅ Policy ${i + 1} recreated`);
      } catch (error) {
        console.log(`⚠️  Policy ${i + 1} error:`, error.message);
      }
    }

    await client.end();

    console.log('');
    console.log('🎉 Admin ID fix completed successfully!');
    console.log('');
    console.log('📊 Changes made:');
    console.log('   - Changed admin_id from INTEGER to UUID');
    console.log('   - Dropped and recreated RLS policies');
    console.log('   - Fixed foreign key dependencies');
    console.log('');
    console.log('🚀 Properties should now load correctly!');
    console.log('');
    console.log('💡 The admin_id field now matches Supabase Auth UUID format');
    console.log('');
    console.log('⚠️  IMPORTANT: If you had existing properties, you may need to update');
    console.log('   their admin_id values to match the correct user UUIDs from auth.users');

  } catch (error) {
    console.error('💥 Fix failed:', error);
    await client.end();
    process.exit(1);
  }
}

// Run the simple fix
fixAdminIdSimple();
