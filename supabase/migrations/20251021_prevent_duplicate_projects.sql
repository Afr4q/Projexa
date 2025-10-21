-- Add unique constraint to prevent duplicate projects for same student and admin project
DO $$ 
BEGIN
    -- Check if the constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'projects_student_admin_project_unique'
    ) THEN
        -- Add unique constraint on student_id and admin_project_id combination
        ALTER TABLE public.projects 
        ADD CONSTRAINT projects_student_admin_project_unique 
        UNIQUE (student_id, admin_project_id);
    END IF;
END $$;

-- Create index to improve performance for this constraint
CREATE INDEX IF NOT EXISTS idx_projects_student_admin_project 
ON public.projects (student_id, admin_project_id);