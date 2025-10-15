-- Create admin_projects table for admin project templates
CREATE TABLE IF NOT EXISTS public.admin_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    department TEXT NOT NULL,
    year INTEGER NOT NULL CHECK (year IN (1, 2, 3, 4)),
    semester INTEGER NOT NULL CHECK (semester IN (1, 2)),
    created_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
    max_students INTEGER DEFAULT 1,
    status TEXT CHECK (status IN ('active', 'inactive', 'archived')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_admin_projects_updated_at() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_projects_updated_at
  BEFORE UPDATE ON public.admin_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_admin_projects_updated_at();

-- Add admin_project_id column to projects table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'admin_project_id'
    ) THEN
        ALTER TABLE public.projects 
        ADD COLUMN admin_project_id UUID REFERENCES public.admin_projects(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_projects_department ON public.admin_projects(department);
CREATE INDEX IF NOT EXISTS idx_admin_projects_year_semester ON public.admin_projects(year, semester);
CREATE INDEX IF NOT EXISTS idx_admin_projects_status ON public.admin_projects(status);
CREATE INDEX IF NOT EXISTS idx_admin_projects_created_by ON public.admin_projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_admin_project_id ON public.projects(admin_project_id);

-- Enable RLS
ALTER TABLE public.admin_projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_projects

-- Admins can view admin projects from their department
CREATE POLICY "Admins can view their department admin projects" ON public.admin_projects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'admin'
            AND department = admin_projects.department
        )
    );

-- Admins can create admin projects for their department
CREATE POLICY "Admins can create admin projects for their department" ON public.admin_projects
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'admin'
            AND department = admin_projects.department
        )
    );

-- Admins can update their own admin projects
CREATE POLICY "Admins can update their own admin projects" ON public.admin_projects
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'admin'
            AND department = admin_projects.department
        )
    );

-- Admins can delete their own admin projects
CREATE POLICY "Admins can delete their own admin projects" ON public.admin_projects
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'admin'
            AND department = admin_projects.department
        )
    );

-- Add year and semester columns to users table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'year'
    ) THEN
        ALTER TABLE public.users 
        ADD COLUMN year INTEGER CHECK (year IN (1, 2, 3, 4));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'semester'
    ) THEN
        ALTER TABLE public.users 
        ADD COLUMN semester INTEGER CHECK (semester IN (1, 2));
    END IF;
END $$;