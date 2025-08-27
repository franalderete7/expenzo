const fs = require('fs');
const path = require('path');

console.log('🔍 EXPENSES DEBUGGING SCRIPT');
console.log('=====================================\n');

// Check if expenses table SQL exists
const sqlFilePath = path.join(__dirname, 'create_expenses_table.sql');
if (fs.existsSync(sqlFilePath)) {
  console.log('✅ create_expenses_table.sql exists');

  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
  console.log('📋 SQL Preview (first 200 chars):');
  console.log(sqlContent.substring(0, 200) + '...\n');
} else {
  console.log('❌ create_expenses_table.sql not found');
}

// Show setup instructions
console.log('🚀 SETUP INSTRUCTIONS:');
console.log('1. Go to your Supabase dashboard');
console.log('2. Navigate to SQL Editor');
console.log('3. Copy and paste the following SQL:');
console.log('');

try {
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
  console.log('```sql');
  console.log(sqlContent);
  console.log('```');
} catch (error) {
  console.log('❌ Error reading SQL file:', error.message);
}

console.log('');
console.log('4. Click "Run" to execute');
console.log('5. After creating the table, try the expenses tab again');
console.log('');
console.log('📞 If you still get errors, check the browser console and server logs for detailed error information.');
