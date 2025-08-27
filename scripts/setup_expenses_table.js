const fs = require('fs');
const path = require('path');

// Read the SQL file
const sqlFilePath = path.join(__dirname, 'create_expenses_table.sql');
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

console.log('📋 EXPENSES TABLE SQL CONTENT:');
console.log('================================================================================');
console.log(sqlContent);
console.log('================================================================================');

console.log('\n📋 INSTRUCTIONS:');
console.log('1. Go to your Supabase dashboard');
console.log('2. Navigate to SQL Editor');
console.log('3. Copy and paste the SQL above');
console.log('4. Click "Run" to execute');
console.log('\n✅ This will create the expenses table with proper RLS policies.');
console.log('✅ After executing, you can use the expenses functionality in your app.');
