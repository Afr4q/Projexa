-- Run this in your Supabase SQL editor to fix the missing columns

-- Add assigned_guide_id column to admin_projects table
ALTER TABLE public.admin_projects 
ADD COLUMN IF NOT EXISTS assigned_guide_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Add assigned_guide_id column to projects table  
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS assigned_guide_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Add group project fields if they don't exist
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.project_groups(id) ON DELETE SET NULL;

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS is_group_project BOOLEAN DEFAULT FALSE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_assigned_guide_id ON public.projects(assigned_guide_id);
CREATE INDEX IF NOT EXISTS idx_admin_projects_assigned_guide_id ON public.admin_projects(assigned_guide_id);
CREATE INDEX IF NOT EXISTS idx_projects_group_id ON public.projects(group_id);
CREATE INDEX IF NOT EXISTS idx_projects_is_group_project ON public.projects(is_group_project);

-- Add unique constraint to prevent duplicate group memberships
ALTER TABLE public.group_members 
ADD CONSTRAINT IF NOT EXISTS unique_student_group_membership 
UNIQUE (student_id, group_id);

-- Function to copy guide assignment from admin_projects to projects (for future use)
CREATE OR REPLACE FUNCTION copy_guide_assignment_to_projects()
RETURNS TRIGGER AS $$
BEGIN
    -- When a project is created, copy the assigned_guide_id from admin_projects
    IF TG_OP = 'INSERT' AND NEW.admin_project_id IS NOT NULL THEN
        -- Get the assigned_guide_id from admin_projects
        UPDATE public.projects 
        SET assigned_guide_id = (
            SELECT assigned_guide_id 
            FROM public.admin_projects 
            WHERE id = NEW.admin_project_id
        )
        WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically assign guides to projects (for future projects)
DROP TRIGGER IF EXISTS copy_guide_to_projects_trigger ON public.projects;
CREATE TRIGGER copy_guide_to_projects_trigger
    AFTER INSERT ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION copy_guide_assignment_to_projects();