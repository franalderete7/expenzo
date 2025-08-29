import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  try {
    // Use service role key for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing. Please check your environment variables.' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('Starting database setup...')

    // Execute SQL commands using Supabase's postgres client
    await supabaseAdmin
      .from('_temp_setup')
      .select('*')
      .limit(1)

    // Since we can't execute raw SQL directly, we'll provide instructions
    // and create a script that can be run manually in Supabase dashboard

    return NextResponse.json({
      message: 'Please run the SQL setup script manually in your Supabase dashboard',
      instructions: [
        '1. Go to your Supabase project dashboard',
        '2. Navigate to SQL Editor',
        '3. Copy and paste the contents of setup_expense_tables.sql',
        '4. Execute the script',
        '5. Verify tables were created successfully'
      ],
      sql_file_location: 'setup_expense_tables.sql',
      tables_to_create: [
        'monthly_expense_summaries',
        'expense_allocations'
      ],
      note: 'Raw SQL execution requires direct database access or manual execution in Supabase dashboard'
    })

  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json(
      { error: 'Internal server error during setup', details: error },
      { status: 500 }
    )
  }
}

// Alternative: Provide the SQL as a downloadable script
export async function GET() {
  const sqlScript = `-- Expense Management Tables Setup
-- Copy and paste this entire script into your Supabase SQL Editor

-- 1. Monthly Expense Summaries Table
CREATE TABLE IF NOT EXISTS monthly_expense_summaries (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  total_expenses DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (total_expenses >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(property_id, period_year, period_month)
);

-- 2. Expense Allocations Table
CREATE TABLE IF NOT EXISTS expense_allocations (
  id SERIAL PRIMARY KEY,
  monthly_expense_summary_id INTEGER NOT NULL REFERENCES monthly_expense_summaries(id) ON DELETE CASCADE,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  allocated_amount DECIMAL(10,2) NOT NULL CHECK (allocated_amount >= 0),
  allocation_percentage DECIMAL(5,2) NOT NULL CHECK (allocation_percentage >= 0 AND allocation_percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(monthly_expense_summary_id, unit_id)
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_monthly_expense_summaries_property_period
ON monthly_expense_summaries(property_id, period_year, period_month);

CREATE INDEX IF NOT EXISTS idx_expense_allocations_summary
ON expense_allocations(monthly_expense_summary_id);

CREATE INDEX IF NOT EXISTS idx_expense_allocations_unit
ON expense_allocations(unit_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE monthly_expense_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_allocations ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (assuming you have admin_id in properties)
CREATE POLICY \"Users can view monthly expense summaries for their properties\" ON monthly_expense_summaries
  FOR SELECT USING (
    property_id IN (
      SELECT id FROM properties WHERE admin_id = auth.uid()
    )
  );

CREATE POLICY \"Users can insert monthly expense summaries for their properties\" ON monthly_expense_summaries
  FOR INSERT WITH CHECK (
    property_id IN (
      SELECT id FROM properties WHERE admin_id = auth.uid()
    )
  );

CREATE POLICY \"Users can update monthly expense summaries for their properties\" ON monthly_expense_summaries
  FOR UPDATE USING (
    property_id IN (
      SELECT id FROM properties WHERE admin_id = auth.uid()
    )
  );

-- Expense Allocations policies
CREATE POLICY \"Users can view expense allocations for their properties\" ON expense_allocations
  FOR SELECT USING (
    monthly_expense_summary_id IN (
      SELECT mes.id FROM monthly_expense_summaries mes
      JOIN properties p ON mes.property_id = p.id
      WHERE p.admin_id = auth.uid()
    )
  );

CREATE POLICY \"Users can insert expense allocations for their properties\" ON expense_allocations
  FOR INSERT WITH CHECK (
    monthly_expense_summary_id IN (
      SELECT mes.id FROM monthly_expense_summaries mes
      JOIN properties p ON mes.property_id = p.id
      WHERE p.admin_id = auth.uid()
    )
  );

CREATE POLICY \"Users can update expense allocations for their properties\" ON expense_allocations
  FOR UPDATE USING (
    monthly_expense_summary_id IN (
      SELECT mes.id FROM monthly_expense_summaries mes
      JOIN properties p ON mes.property_id = p.id
      WHERE p.admin_id = auth.uid()
    )
  );

-- 6. Helper functions

-- Function to generate monthly expense summary
CREATE OR REPLACE FUNCTION generate_monthly_expense_summary(
  p_property_id INTEGER,
  p_year INTEGER,
  p_month INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_total_expenses DECIMAL(10,2) := 0;
  v_summary_id INTEGER;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  -- Calculate date range for the month
  v_start_date := DATE_TRUNC('month', MAKE_DATE(p_year, p_month, 1));
  v_end_date := v_start_date + INTERVAL '1 month' - INTERVAL '1 day';

  -- Calculate total expenses for the month
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_expenses
  FROM expenses
  WHERE property_id = p_property_id
    AND due_date >= v_start_date
    AND due_date <= v_end_date;

  -- Insert or update the monthly summary
  INSERT INTO monthly_expense_summaries (property_id, period_year, period_month, total_expenses)
  VALUES (p_property_id, p_year, p_month, v_total_expenses)
  ON CONFLICT (property_id, period_year, period_month)
  DO UPDATE SET
    total_expenses = EXCLUDED.total_expenses,
    updated_at = NOW()
  RETURNING id INTO v_summary_id;

  RETURN v_summary_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate expense allocations
CREATE OR REPLACE FUNCTION generate_expense_allocations(
  p_monthly_expense_summary_id INTEGER
) RETURNS VOID AS $$
DECLARE
  v_summary RECORD;
  v_unit RECORD;
BEGIN
  -- Get the monthly summary details
  SELECT * INTO v_summary
  FROM monthly_expense_summaries
  WHERE id = p_monthly_expense_summary_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Monthly expense summary not found';
  END IF;

  -- Delete existing allocations for this summary
  DELETE FROM expense_allocations WHERE monthly_expense_summary_id = p_monthly_expense_summary_id;

  -- Generate new allocations for each unit in the property
  FOR v_unit IN
    SELECT id, expense_percentage
    FROM units
    WHERE property_id = v_summary.property_id
  LOOP
    INSERT INTO expense_allocations (
      monthly_expense_summary_id,
      unit_id,
      allocated_amount,
      allocation_percentage
    ) VALUES (
      p_monthly_expense_summary_id,
      v_unit.id,
      v_summary.total_expenses * (v_unit.expense_percentage / 100),
      v_unit.expense_percentage
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_monthly_expense_summaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_monthly_expense_summaries_updated_at
  BEFORE UPDATE ON monthly_expense_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_monthly_expense_summaries_updated_at();

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Expense management tables created successfully!';
  RAISE NOTICE 'Available functions:';
  RAISE NOTICE '  - generate_monthly_expense_summary(property_id, year, month)';
  RAISE NOTICE '  - generate_expense_allocations(monthly_expense_summary_id)';
END $$;`

  return new Response(sqlScript, {
    headers: {
      'Content-Type': 'text/plain',
      'Content-Disposition': 'attachment; filename="setup_expense_tables.sql"'
    }
  })
}
