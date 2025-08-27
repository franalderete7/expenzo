const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function setupResidentsTable() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '✓' : '✗');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('Connecting to Supabase...');

    // Check if residents table already exists
    const { data: existingTables, error: checkError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'residents');

    if (checkError) {
      console.log('Could not check existing tables, proceeding with table creation...');
    } else if (existingTables && existingTables.length > 0) {
      console.log('✅ Residents table already exists!');
      return;
    }

    console.log('Reading SQL file...');
    const sqlPath = path.join(__dirname, 'create_residents_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('⚠️  IMPORTANT: You need to execute the following SQL manually in your Supabase dashboard:');
    console.log('\n' + '='.repeat(80));
    console.log(sql);
    console.log('='.repeat(80));
    console.log('\n📋 Steps:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the SQL above');
    console.log('4. Click "Run" to execute');
    console.log('\n✅ After executing the SQL, the residents table will be created with proper RLS policies.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setupResidentsTable();
