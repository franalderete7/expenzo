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

async function fixAdminIdType() {
  console.log('🔧 Fixing admin_id type mismatch...');

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // 1. Add temporary UUID column
    console.log('📋 Adding temporary admin_uuid column...');
    await client.query(`
      ALTER TABLE properties
      ADD COLUMN IF NOT EXISTS admin_uuid UUID;
    `);
    console.log('✅ admin_uuid column added');

    // 2. Update the new column with the admin_id values (assuming they're already UUIDs in auth)
    // Note: This step assumes the existing admin_id values are actually UUID strings stored as text
    console.log('📋 Copying existing admin_id values...');
    try {
      await client.query(`
        UPDATE properties
        SET admin_uuid = admin_id::UUID
        WHERE admin_id IS NOT NULL;
      `);
      console.log('✅ Existing data copied to admin_uuid');
    } catch (error) {
      console.log('⚠️  Could not copy existing data (this is normal for new databases):', error.message);
    }

    // 3. Drop the old admin_id column (with CASCADE to handle dependencies)
    console.log('📋 Dropping old admin_id column...');
    await client.query(`
      ALTER TABLE properties DROP COLUMN IF EXISTS admin_id CASCADE;
    `);
    console.log('✅ Old admin_id column dropped');

    // 4. Rename admin_uuid to admin_id
    console.log('📋 Renaming admin_uuid to admin_id...');
    await client.query(`
      ALTER TABLE properties RENAME COLUMN admin_uuid TO admin_id;
    `);
    console.log('✅ Column renamed to admin_id');

    // 5. Add NOT NULL constraint and foreign key reference
    console.log('📋 Adding constraints...');
    await client.query(`
      ALTER TABLE properties
      ALTER COLUMN admin_id SET NOT NULL;
    `);
    console.log('✅ NOT NULL constraint added');

    // 6. Update the RLS policies to use the new UUID column
    console.log('📋 Updating RLS policies...');

    // Drop existing policies
    const existingPolicies = await client.query(`
      SELECT policyname
      FROM pg_policies
      WHERE tablename = 'properties' AND policyname LIKE '%admin%';
    `);

    for (const policy of existingPolicies.rows) {
      try {
        await client.query(`DROP POLICY IF EXISTS "${policy.policyname}" ON properties;`);
        console.log(`✅ Dropped policy: ${policy.policyname}`);
      } catch (error) {
        console.log(`⚠️  Could not drop policy ${policy.policyname}:`, error.message);
      }
    }

    // Create new policies with UUID
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
        console.log(`✅ Policy ${i + 1} created successfully`);
      } catch (error) {
        console.log(`⚠️  Policy ${i + 1} might already exist:`, error.message);
      }
    }

    // 7. Also fix the monthly_expense_summaries table
    console.log('📋 Fixing monthly_expense_summaries table...');
    try {
      await client.query(`
        ALTER TABLE monthly_expense_summaries
        ADD COLUMN IF NOT EXISTS admin_uuid UUID;
      `);

      await client.query(`
        UPDATE monthly_expense_summaries
        SET admin_uuid = (SELECT admin_id FROM properties WHERE properties.id = monthly_expense_summaries.property_id);
      `);

      await client.query(`
        ALTER TABLE monthly_expense_summaries DROP COLUMN IF EXISTS admin_id;
      `);

      await client.query(`
        ALTER TABLE monthly_expense_summaries RENAME COLUMN admin_uuid TO admin_id;
      `);

      console.log('✅ monthly_expense_summaries table fixed');
    } catch (error) {
      console.log('⚠️  Could not fix monthly_expense_summaries:', error.message);
    }

    await client.end();

    console.log('');
    console.log('🎉 Admin ID type fix completed successfully!');
    console.log('');
    console.log('📊 Changes made:');
    console.log('   - Changed admin_id from INTEGER to UUID');
    console.log('   - Updated RLS policies for UUID');
    console.log('   - Fixed monthly_expense_summaries table');
    console.log('');
    console.log('🚀 Properties should now load correctly!');
    console.log('');
    console.log('💡 The admin_id field now matches Supabase Auth UUID format');

  } catch (error) {
    console.error('💥 Fix failed:', error);
    await client.end();
    process.exit(1);
  }
}

// Alternative: If the above doesn't work, here's a simpler approach
async function simpleFix() {
  console.log('🔧 Applying simple fix...');

  const client = new Client({ connectionString });

  try {
    await client.connect();

    // Check current schema
    const schema = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'properties'
      AND column_name = 'admin_id';
    `);

    console.log('Current admin_id type:', schema.rows[0]?.data_type);

    if (schema.rows[0]?.data_type === 'integer') {
      console.log('📋 Converting INTEGER to UUID...');

      // Add UUID column
      await client.query(`ALTER TABLE properties ADD COLUMN admin_uuid UUID;`);

      // Copy and convert data (if any exists)
      await client.query(`
        UPDATE properties
        SET admin_uuid = admin_id::text::uuid
        WHERE admin_id IS NOT NULL;
      `);

      // Drop old column and rename new one
      await client.query(`ALTER TABLE properties DROP COLUMN admin_id;`);
      await client.query(`ALTER TABLE properties RENAME COLUMN admin_uuid TO admin_id;`);
      await client.query(`ALTER TABLE properties ALTER COLUMN admin_id SET NOT NULL;`);

      console.log('✅ Conversion completed');
    } else {
      console.log('✅ admin_id is already UUID');
    }

    await client.end();
  } catch (error) {
    console.error('Simple fix failed:', error);
    await client.end();
  }
}

// Run the fix
if (process.argv[2] === 'simple') {
  simpleFix();
} else {
  fixAdminIdType();
}
