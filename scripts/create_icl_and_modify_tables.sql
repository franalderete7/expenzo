-- =====================================================
-- ICL Integration Schema Modifications
-- =====================================================
-- This script creates the ICL values table and modifies
-- existing contracts and rents tables for ICL-based rent adjustments

-- =====================================================
-- 1. Create ICL Values Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.icl_values (
  id SERIAL NOT NULL,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  icl_value NUMERIC(10, 4) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT icl_values_pkey PRIMARY KEY (id),
  CONSTRAINT icl_values_period_month_check CHECK (
    (period_month >= 1) AND (period_month <= 12)
  )
);

-- Create unique index for period lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_icl_values_period
ON public.icl_values USING btree (period_year, period_month);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_icl_values_year_month
ON public.icl_values USING btree (period_year, period_month);

-- Grant permissions
GRANT ALL ON public.icl_values TO authenticated;
GRANT ALL ON public.icl_values TO anon;

-- =====================================================
-- 2. Modify Contracts Table
-- =====================================================
-- Add ICL index type field with Argentine default
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS icl_index_type VARCHAR(50) DEFAULT 'indice para contratos de locacion';

-- Add comment for clarity
COMMENT ON COLUMN public.contracts.icl_index_type IS 'Type of ICL index to use for rent adjustments (e.g., indice para contratos de locacion, consumer_price_index)';

-- =====================================================
-- 3. Modify Rents Table
-- =====================================================
-- Add ICL calculation tracking fields
ALTER TABLE public.rents
ADD COLUMN IF NOT EXISTS base_amount NUMERIC(12, 2),
ADD COLUMN IF NOT EXISTS icl_adjustment_factor NUMERIC(10, 6),
ADD COLUMN IF NOT EXISTS base_icl_value NUMERIC(10, 4),
ADD COLUMN IF NOT EXISTS adjustment_icl_value NUMERIC(10, 4),
ADD COLUMN IF NOT EXISTS is_adjusted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS adjustment_period_month INTEGER,
ADD COLUMN IF NOT EXISTS adjustment_period_year INTEGER;

-- Add comments for clarity
COMMENT ON COLUMN public.rents.base_amount IS 'Original rent amount before ICL adjustment';
COMMENT ON COLUMN public.rents.icl_adjustment_factor IS 'ICL adjustment factor (new_ICL / old_ICL)';
COMMENT ON COLUMN public.rents.base_icl_value IS 'ICL value at contract start or last adjustment';
COMMENT ON COLUMN public.rents.adjustment_icl_value IS 'ICL value used for this adjustment';
COMMENT ON COLUMN public.rents.is_adjusted IS 'Whether this rent has been adjusted using ICL';
COMMENT ON COLUMN public.rents.adjustment_period_month IS 'Month when this adjustment was calculated';
COMMENT ON COLUMN public.rents.adjustment_period_year IS 'Year when this adjustment was calculated';

-- =====================================================
-- 4. Create Update Trigger for ICL Values
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to ICL values table
DROP TRIGGER IF EXISTS update_icl_values_updated_at ON public.icl_values;
CREATE TRIGGER update_icl_values_updated_at
    BEFORE UPDATE ON public.icl_values
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. Insert Sample ICL Data (Optional)
-- =====================================================
-- You can uncomment and modify these INSERT statements to add sample ICL values
/*
-- Example ICL values for 2024 (Argentine data)
INSERT INTO public.icl_values (period_month, period_year, icl_value) VALUES
(1, 2024, 1250.50),
(2, 2024, 1280.75),
(3, 2024, 1315.20),
(4, 2024, 1350.85),
(5, 2024, 1385.10),
(6, 2024, 1420.45),
(7, 2024, 1450.20),
(8, 2024, 1485.75),
(9, 2024, 1520.30),
(10, 2024, 1555.85),
(11, 2024, 1590.40),
(12, 2024, 1625.95)
ON CONFLICT (period_year, period_month) DO NOTHING;

-- Example ICL values for 2025
INSERT INTO public.icl_values (period_month, period_year, icl_value) VALUES
(1, 2025, 1660.50),
(2, 2025, 1695.25),
(3, 2025, 1730.80),
(4, 2025, 1765.35),
(5, 2025, 1800.90),
(6, 2025, 1835.45),
(7, 2025, 1870.00),
(8, 2025, 1905.55)
ON CONFLICT (period_year, period_month) DO NOTHING;
*/

-- =====================================================
-- 6. Verification Queries (Optional)
-- =====================================================
-- You can run these queries after execution to verify the changes:

-- Check ICL values table structure
-- SELECT * FROM information_schema.columns WHERE table_name = 'icl_values' ORDER BY ordinal_position;

-- Check contracts table new column
-- SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'icl_index_type';

-- Check rents table new columns
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'rents' AND column_name IN ('base_amount', 'icl_adjustment_factor', 'base_icl_value', 'adjustment_icl_value', 'is_adjusted', 'adjustment_period_month', 'adjustment_period_year');

-- =====================================================
-- END OF SCRIPT
-- =====================================================

COMMIT;
