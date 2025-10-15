# Plagiarism Detection System Setup Guide

## Overview
This system uses Google's Gemini AI to detect similarity between student Phase 1 submissions and previous year projects. It prevents academic plagiarism by comparing new submissions against a database of reference projects.

## Setup Instructions

### 1. Get Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Create a new API key
4. Copy the API key

### 2. Configure Environment Variables
Add your Gemini API key to `.env.local`:
```bash
GEMINI_API_KEY=your_actual_api_key_here
```

### 3. Database Migration
Run the database migration to add similarity score column:
```sql
-- This is already in supabase/migrations/20251014_add_similarity_score.sql
ALTER TABLE public.submissions 
ADD COLUMN similarity_score integer NULL DEFAULT 0;
```

### 4. Reference PDFs Management
The system currently uses PDFs in the project root directory. To add more reference PDFs:

1. Place PDF files in the project root directory
2. Update the `referencePDFPaths` array in `/src/app/api/check-similarity/route.ts`:

```typescript
const referencePDFPaths = [
  path.join(process.cwd(), '20MCA 246 - MAIN PROJECT [2023-24].PDF'),
  path.join(process.cwd(), 'your-new-reference-project.pdf'),
  // Add more reference PDFs here
]
```

## How It Works

### 1. Submission Process
- Student selects a Phase 1 submission
- System automatically detects if it's Phase 1
- PDF content is extracted and sent to Gemini AI
- Gemini compares against reference projects
- Returns similarity score (0-100%)

### 2. Similarity Threshold
- **0-49%**: Submission allowed (low similarity)
- **50-100%**: Submission blocked (high similarity)

### 3. User Experience
- **Low Similarity**: Green message, submission proceeds
- **High Similarity**: Red warning, submission blocked, guide contact required

## File Structure

```
src/
├── lib/
│   └── geminiService.ts          # Gemini AI integration
├── app/
│   ├── api/
│   │   └── check-similarity/
│   │       └── route.ts          # API endpoint for similarity check
│   └── dashboard/
│       └── student/
│           └── submissions/
│               └── page.tsx      # Updated submission form
└── supabase/
    └── migrations/
        └── 20251014_add_similarity_score.sql
```

## Key Features

### 1. Automatic Detection
- Only Phase 1 submissions trigger similarity checks
- Other phases proceed without plagiarism checking

### 2. Real-time Feedback
- Loading states during analysis
- Clear visual feedback with scores
- Detailed explanations from Gemini AI

### 3. Database Integration
- Similarity scores stored in submissions table
- Prevents duplicate submissions
- Tracks plagiarism scores for admin review

### 4. Security
- Server-side API processing
- Secure file handling
- Authentication required

## Monitoring and Administration

### View Similarity Scores
Similarity scores are stored in the `submissions` table:
```sql
SELECT 
  s.id,
  s.similarity_score,
  u.name as student_name,
  p.title as project_title,
  ph.name as phase_name
FROM submissions s
JOIN users u ON s.student_id = u.id
JOIN projects p ON s.project_id = p.id
JOIN phases ph ON s.phase_id = ph.id
WHERE s.similarity_score > 0
ORDER BY s.similarity_score DESC;
```

### Add New Reference Projects
1. Save new reference PDFs to project root
2. Update the API route with new file paths
3. Test with sample submissions

## Troubleshooting

### Common Issues

1. **"Error generating signed URL"**
   - Check if reference PDFs exist in project root
   - Verify file permissions

2. **"Similarity check failed"**
   - Verify Gemini API key is correct
   - Check internet connectivity
   - Ensure PDF is readable

3. **"No reference PDFs found"**
   - Verify PDF files are in project root directory
   - Check file paths in the API route

### Testing
1. Upload a Phase 1 submission
2. Check browser console for similarity check logs
3. Verify similarity score appears in database
4. Test with both similar and different content

## Future Enhancements

### Potential Improvements
1. **Reference PDF Storage**: Move to Supabase storage
2. **Admin Interface**: GUI for managing reference projects
3. **Batch Processing**: Check multiple files at once
4. **Advanced Analytics**: Similarity trend analysis
5. **Custom Thresholds**: Department-specific similarity limits

### Scaling Considerations
- Consider caching for frequently accessed reference PDFs
- Implement rate limiting for API calls
- Add error retry mechanisms
- Monitor Gemini AI usage and costs

## Cost Considerations

### Gemini AI Pricing
- Gemini 1.5 Flash is currently free with rate limits
- Monitor usage through Google AI Studio
- Consider upgrading for higher volume usage

### Optimization Tips
1. Cache extracted text from reference PDFs
2. Implement file size limits
3. Use text preprocessing to reduce API calls
4. Consider local similarity algorithms for pre-filtering