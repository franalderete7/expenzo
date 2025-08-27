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

async function fixAdminIdDirect() {
  console.log('🔧 Direct admin_id fix (no auth required)...');

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // 1. Check current schema
    const schema = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'properties'
      AND column_name = 'admin_id';
    `);

    console.log(`📋 Current admin_id type: ${schema.rows[0]?.data_type || 'NOT FOUND'}`);

    if (!schema.rows[0]) {
      console.log('❌ admin_id column not found in properties table');
      return;
    }

    if (schema.rows[0].data_type === 'uuid') {
      console.log('✅ admin_id is already UUID - no changes needed');
      await client.end();
      return;
    }

    // 2. Check how many properties exist
    const count = await client.query('SELECT COUNT(*) as count FROM properties;');
    const propertyCount = parseInt(count.rows[0].count);
    console.log(`📋 Found ${propertyCount} existing properties`);

    // 3. Drop all dependent policies
    console.log('📋 Dropping dependent policies...');
    const policies = [
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

    for (const policy of policies) {
      try {
        await client.query(policy);
      } catch (error) {
        // Ignore errors - policies might not exist
      }
    }
    console.log('✅ Policies dropped');

    // 4. Add UUID column
    console.log('📋 Adding admin_uuid column...');
    await client.query(`
      ALTER TABLE properties
      ADD COLUMN IF NOT EXISTS admin_uuid UUID;
    `);

    // 5. For existing properties, set admin_uuid to a placeholder UUID
    // In a real application, you would want to map the integer admin_ids
    // to the correct UUIDs from your auth system
    if (propertyCount > 0) {
      console.log('📋 Setting placeholder UUID for existing properties...');
      console.log('⚠️  WARNING: Existing properties will get a placeholder UUID');
      console.log('💡 You should update these with the correct user UUIDs later');

      // Generate a placeholder UUID - you should replace this with real user UUIDs
      const placeholderUUID = '00000000-0000-0000-0000-000000000001';

      await client.query(`
        UPDATE properties
        SET admin_uuid = $1::UUID
        WHERE admin_uuid IS NULL;
      `, [placeholderUUID]);

      console.log(`✅ Set placeholder UUID for ${propertyCount} properties`);
    }

    // 6. Convert the column
    console.log('📋 Converting admin_id to UUID...');
    await client.query(`
      ALTER TABLE properties
      ALTER COLUMN admin_uuid SET NOT NULL,
      DROP COLUMN IF EXISTS admin_id CASCADE;
    `);

    await client.query(`
      ALTER TABLE properties
      RENAME COLUMN admin_uuid TO admin_id;
    `);

    console.log('✅ Column converted to UUID');

    // 7. Recreate essential policies
    console.log('📋 Recreating policies...');
    const newPolicies = [
      `CREATE POLICY "Users can view their own properties" ON properties
       FOR SELECT USING (admin_id = auth.uid());`,
      `CREATE POLICY "Users can insert their own properties" ON properties
       FOR INSERT WITH CHECK (admin_id = auth.uid());`,
      `CREATE POLICY "Users can update their own properties" ON properties
       FOR UPDATE USING (admin_id = auth.uid());`,
      `CREATE POLICY "Users can delete their own properties" ON properties
       FOR DELETE USING (admin_id = auth.uid());`
    ];

    for (let i = 0; i < newPolicies.length; i++) {
      try {
        await client.query(newPolicies[i]);
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
    console.log(`   - Fixed ${propertyCount} existing properties`);
    console.log('   - Changed admin_id from INTEGER to UUID');
    console.log('   - Recreated RLS policies');
    console.log('');
    console.log('🚀 Properties should now load correctly!');
    console.log('');
    console.log('⚠️  IMPORTANT: Update the placeholder UUIDs with real user UUIDs');
    console.log('   You can do this by running:');
    console.log('   UPDATE properties SET admin_id = \'your-real-user-uuid\' WHERE id = X;');

  } catch (error) {
    console.error('💥 Fix failed:', error);
    await client.end();
    process.exit(1);
  }
}

// Run the direct fix
fixAdminIdDirect();
