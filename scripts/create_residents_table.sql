-- Create residents table
CREATE TABLE IF NOT EXISTS public.residents (
    id serial not null,
    name character varying(100) not null,
    email character varying(100) null,
    phone character varying(20) null,
    role character varying(10) not null,
    admin_id integer not null,
    unit_id integer null,
    created_at timestamp with time zone null default now(),
    updated_at timestamp with time zone null default now(),
    property_id integer null,
    constraint residents_pkey primary key (id),
    constraint residents_admin_id_fkey foreign KEY (admin_id) references admins (id) on delete CASCADE,
    constraint residents_property_id_fkey foreign KEY (property_id) references properties (id),
    constraint residents_unit_id_fkey foreign KEY (unit_id) references units (id) on delete set null,
    constraint residents_role_check check (
      (
        (role)::text = any (
          (
            array[
              'owner'::character varying,
              'tenant'::character varying
            ]
          )::text[]
        )
      )
    )
) TABLESPACE pg_default;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_residents_property_id ON public.residents(property_id);
CREATE INDEX IF NOT EXISTS idx_residents_unit_id ON public.residents(unit_id);
CREATE INDEX IF NOT EXISTS idx_residents_admin_id ON public.residents(admin_id);
CREATE INDEX IF NOT EXISTS idx_residents_name ON public.residents(name);

-- Enable Row Level Security
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own residents" ON public.residents
    FOR SELECT USING (admin_id IN (
        SELECT id FROM public.admins WHERE user_id = auth.uid()::text
    ));

CREATE POLICY "Users can insert their own residents" ON public.residents
    FOR INSERT WITH CHECK (admin_id IN (
        SELECT id FROM public.admins WHERE user_id = auth.uid()::text
    ));

CREATE POLICY "Users can update their own residents" ON public.residents
    FOR UPDATE USING (admin_id IN (
        SELECT id FROM public.admins WHERE user_id = auth.uid()::text
    ));

CREATE POLICY "Users can delete their own residents" ON public.residents
    FOR DELETE USING (admin_id IN (
        SELECT id FROM public.admins WHERE user_id = auth.uid()::text
    ));

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_residents_updated_at BEFORE UPDATE ON public.residents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
