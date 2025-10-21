-- Add group project fields to projects table
DO $$ 
BEGIN
    -- Add group_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'group_id'
    ) THEN
        ALTER TABLE public.projects 
        ADD COLUMN group_id UUID REFERENCES public.project_groups(id) ON DELETE SET NULL;
    END IF;

    -- Add is_group_project column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'is_group_project'
    ) THEN
        ALTER TABLE public.projects 
        ADD COLUMN is_group_project BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add project_name column if it doesn't exist (seems to be in your table)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'project_name'
    ) THEN
        ALTER TABLE public.projects 
        ADD COLUMN project_name TEXT;
    END IF;

    -- Add score column if it doesn't exist (seems to be in your table)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects'
        AND column_name = 'score'
    ) THEN
        ALTER TABLE public.projects 
        ADD COLUMN score INTEGER;
    END IF;

    -- Add assigned_guide_id column to admin_projects table if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_projects'
        AND column_name = 'assigned_guide_id'
    ) THEN
        ALTER TABLE public.admin_projects 
        ADD COLUMN assigned_guide_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;

    -- Add assigned_guide_id column to projects table if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects'
        AND column_name = 'assigned_guide_id'
    ) THEN
        ALTER TABLE public.projects 
        ADD COLUMN assigned_guide_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_group_id ON public.projects(group_id);
CREATE INDEX IF NOT EXISTS idx_projects_is_group_project ON public.projects(is_group_project);

-- Add unique constraint to prevent duplicate group memberships per project
DO $$
BEGIN
    -- First ensure we have a way to link group members to admin projects
    -- through the project_groups table. The constraint will be enforced in application logic
    -- since we can't create a direct database constraint across these tables easily.
    
    -- Instead, let's create a simple constraint to prevent duplicate group memberships
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_student_group_membership' 
        AND table_name = 'group_members'
    ) THEN
        -- This prevents a student from being added to the same group twice
        ALTER TABLE public.group_members 
        ADD CONSTRAINT unique_student_group_membership 
        UNIQUE (student_id, group_id);
    END IF;
END $$;

-- Function to update projects when a group is created
CREATE OR REPLACE FUNCTION update_projects_for_new_group(
    p_group_id UUID,
    p_admin_project_id UUID
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update projects for all students in the group
    UPDATE public.projects 
    SET 
        is_group_project = TRUE, 
        group_id = p_group_id
    WHERE 
        admin_project_id = p_admin_project_id
        AND student_id IN (
            SELECT user_id 
            FROM public.group_members 
            WHERE group_id = p_group_id
        );
END;
$$;

-- Function to copy guide assignment from admin_projects to projects
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

-- Create trigger to automatically assign guides to projects
DROP TRIGGER IF EXISTS copy_guide_to_projects_trigger ON public.projects;
CREATE TRIGGER copy_guide_to_projects_trigger
    AFTER INSERT ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION copy_guide_assignment_to_projects();