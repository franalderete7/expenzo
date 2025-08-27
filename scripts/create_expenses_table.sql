-- Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
    id serial not null,
    property_id integer not null,
    expense_type character varying(100) not null,
    amount numeric(10,2) not null,
    date date not null,
    description text,
    created_at timestamp with time zone null default now(),
    updated_at timestamp with time zone null default now(),
    constraint expenses_pkey primary key (id),
    constraint expenses_property_id_fkey foreign KEY (property_id) references properties (id) on delete CASCADE
) TABLESPACE pg_default;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_expenses_property_id ON public.expenses(property_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON public.expenses(expense_type);

-- Enable Row Level Security
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own expenses" ON public.expenses
    FOR SELECT USING (
        property_id IN (
            SELECT id FROM public.properties
            WHERE admin_id IN (
                SELECT id FROM public.admins WHERE user_id = auth.uid()::text
            )
        )
    );

CREATE POLICY "Users can insert their own expenses" ON public.expenses
    FOR INSERT WITH CHECK (
        property_id IN (
            SELECT id FROM public.properties
            WHERE admin_id IN (
                SELECT id FROM public.admins WHERE user_id = auth.uid()::text
            )
        )
    );

CREATE POLICY "Users can update their own expenses" ON public.expenses
    FOR UPDATE USING (
        property_id IN (
            SELECT id FROM public.properties
            WHERE admin_id IN (
                SELECT id FROM public.admins WHERE user_id = auth.uid()::text
            )
        )
    );

CREATE POLICY "Users can delete their own expenses" ON public.expenses
    FOR DELETE USING (
        property_id IN (
            SELECT id FROM public.properties
            WHERE admin_id IN (
                SELECT id FROM public.admins WHERE user_id = auth.uid()::text
            )
        )
    );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
