-- Add similarity_score column to submissions table
ALTER TABLE public.submissions 
ADD COLUMN similarity_score integer NULL DEFAULT 0;

-- Add comment to describe the column
COMMENT ON COLUMN public.submissions.similarity_score IS 'Similarity score (0-100) from plagiarism check using Gemini AI. Only applicable for Phase 1 submissions.';

-- Update existing records to have default similarity score of 0
UPDATE public.submissions 
SET similarity_score = 0 
WHERE similarity_score IS NULL;