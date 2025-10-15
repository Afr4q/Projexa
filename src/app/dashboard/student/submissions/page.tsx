'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/supabaseClient'

interface Phase {
  id: string
  name: string
  deadline: string
  max_marks: number
  department: string
  project_id: string
  project?: {
    id: string
    title: string
  }
}

interface PhaseInfo {
  name: string
  deadline: string
  max_marks: number
}

interface Submission {
  id: string
  student_id: string
  project_id: string
  phase_id: string
  file_url: string
  submission_date: string
  rubric_check_status: 'pending' | 'passed' | 'failed'
  guide_status: 'pending' | 'accepted' | 'rejected'
  marks_awarded: number | null
  late_days: number
  similarity_score: number
  phases: PhaseInfo
}

interface UserData {
  department: string
}

interface Project {
  id: string
  title: string
  admin_project_id: string
}

export default function Submissions() {
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [phases, setPhases] = useState<Phase[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [similarityResult, setSimilarityResult] = useState<{
    score: number
    isSimilar: boolean
    message: string
    explanation: string
  } | null>(null)
  const [checkingSimilarity, setCheckingSimilarity] = useState(false)

  // Add function to handle resubmission
  const handleResubmit = (submission: Submission) => {
    // Pre-select the phase for resubmission
    const phase = phases.find(p => p.id === submission.phase_id)
    if (phase) {
      setSelectedPhase(phase)
    }
    
    // Find and select the project
    const project = projects.find(p => p.id === submission.project_id)
    if (project) {
      setSelectedProject(project)
    }
    
    // Reset form state
    setFile(null)
    setSimilarityResult(null)
    
    // Show resubmission context
    const reason = submission.guide_status === 'rejected' 
      ? 'Submission was rejected by guide' 
      : submission.similarity_score >= 40 
        ? `High similarity detected (${submission.similarity_score}%)`
        : 'Resubmission requested'
    
    alert(`Resubmitting due to: ${reason}\n\nPlease upload your revised submission. For Phase 1, plagiarism check will be performed again.`)
    
    // Scroll to upload form
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    fetchProjects()
    fetchSubmissions()
  }, [])

  const fetchProjects = async () => {
    try {
      // Get current user's projects
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      const { data, error } = await supabase
        .from('projects')
        .select('id, title, admin_project_id')
        .eq('student_id', user.id)
        .order('title', { ascending: true })

      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error('Error fetching projects:', error)
      setProjects([])
    }
  }

  const fetchPhases = async (projectId: string) => {
    try {
      // Get current user's department
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('department')
        .eq('id', user.id)
        .single()

      if (userError || !userData) {
        throw new Error('Failed to get user department')
      }

      // Get the admin_project_id from the selected project
      const project = projects.find(p => p.id === projectId)
      if (!project) throw new Error('Project not found')

      // Fetch phases for the specific admin project
      const { data, error } = await supabase
        .from('phases')
        .select(`
          *,
          project:admin_projects(id, title)
        `)
        .eq('department', userData.department)
        .eq('project_id', project.admin_project_id)
        .order('deadline', { ascending: true })

      if (error) throw error
      setPhases(data || [])
    } catch (error) {
      console.error('Error fetching phases:', error)
      setPhases([])
    }
  }

  const getSignedUrl = async (filePath: string) => {
    try {
      console.log('Original file path:', filePath)
      
      // The filePath should be like "project files/user_id/project_id/phase_id_timestamp.pdf"
      // We need to extract the bucket name and file name correctly
      let bucketName = 'project files'
      let fileName = filePath
      
      // If the path already includes "project files/", extract the file name part
      if (filePath.startsWith('project files/')) {
        fileName = filePath.replace('project files/', '')
      }
      
      console.log('Bucket name:', bucketName)
      console.log('File name:', fileName)
      
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(fileName, 3600) // 1 hour expiry
      
      if (error) {
        console.error('Error creating signed URL:', error)
        return null
      }
      
      console.log('Generated signed URL:', data.signedUrl)
      return data.signedUrl
    } catch (error) {
      console.error('Error in getSignedUrl:', error)
      return null
    }
  }

  const handleViewPDF = async (filePath: string) => {
    const signedUrl = await getSignedUrl(filePath)
    if (signedUrl) {
      window.open(signedUrl, '_blank')
    } else {
      alert('Unable to access file. Please try again.')
    }
  }

  const fetchSubmissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          phases (
            name,
            deadline,
            max_marks
          )
        `)
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // Debug: Log the submissions data to check similarity_score
      console.log('Fetched submissions:', data)
      data?.forEach(sub => {
        console.log(`Submission ${sub.id}: similarity_score = ${sub.similarity_score} (type: ${typeof sub.similarity_score})`)
      })
      
      setSubmissions(data || [])
    } catch (error) {
      console.error('Error fetching submissions:', error)
      setSubmissions([])
    } finally {
      setLoading(false)
    }
  }

  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const projectId = e.target.value
    const project = projects.find((p) => p.id === projectId)
    setSelectedProject(project || null)
    setSelectedPhase(null) // Reset selected phase when project changes
    setPhases([]) // Clear phases
    
    if (project) {
      fetchPhases(project.id)
    }
  }

  const handlePhaseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const phaseId = e.target.value
    const phase = phases.find((p) => p.id === phaseId)
    setSelectedPhase(phase || null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !selectedPhase || !selectedProject) return

    try {
      setLoading(true)
      setSimilarityResult(null)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      // Check if submission already exists for this phase
      const { data: existingSubmission } = await supabase
        .from('submissions')
        .select('id, guide_status, similarity_score')
        .eq('student_id', user.id)
        .eq('phase_id', selectedPhase.id)
        .single()

      // Allow resubmission for rejected submissions OR high similarity pending submissions
      if (existingSubmission) {
        const isPhase1 = selectedPhase.name.toLowerCase().includes('phase 1')
        const isRejected = existingSubmission.guide_status === 'rejected'
        const wasRejectedForSimilarity = isPhase1 && 
                                       existingSubmission.guide_status === 'pending' && 
                                       existingSubmission.similarity_score >= 40

        const canResubmit = isRejected || wasRejectedForSimilarity

        if (!canResubmit) {
          throw new Error('You have already submitted for this phase.')
        }
        
        // If resubmitting, delete the old submission
        await supabase
          .from('submissions')
          .delete()
          .eq('id', existingSubmission.id)
      }

      // Check if this is Phase 1 - perform similarity check
      if (selectedPhase.name.toLowerCase().includes('phase 1')) {
        setCheckingSimilarity(true)
        
        try {
          const similarityFormData = new FormData()
          similarityFormData.append('file', file)
          similarityFormData.append('phaseId', selectedPhase.id)
          similarityFormData.append('projectId', selectedProject.id)

          // Get the current session token
          const { data: { session } } = await supabase.auth.getSession()
          const accessToken = session?.access_token

          const similarityResponse = await fetch('/api/check-similarity', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`
            },
            body: similarityFormData
          })

          if (!similarityResponse.ok) {
            const errorText = await similarityResponse.text()
            console.error('Similarity check failed:', errorText)
            throw new Error(`Failed to check similarity: ${similarityResponse.status} ${similarityResponse.statusText}`)
          }

          const result = await similarityResponse.json()
          console.log('Similarity check result:', result)
          setSimilarityResult({
            score: result.similarityScore,
            isSimilar: result.isSimilar,
            message: result.message,
            explanation: result.explanation
          })

          setCheckingSimilarity(false)

          // If similarity is too high, stop the submission process
          if (result.isSimilar) {
            setLoading(false)
            return // Don't proceed with submission
          }
        } catch (similarityError) {
          console.error('Similarity check failed:', similarityError)
          console.error('Similarity error details:', {
            message: similarityError instanceof Error ? similarityError.message : 'Unknown error',
            stack: similarityError instanceof Error ? similarityError.stack : undefined,
            type: typeof similarityError,
            errorObject: similarityError
          })
          setCheckingSimilarity(false)
          // Ask user if they want to proceed without similarity check
          const proceed = confirm('Similarity check failed. Do you want to proceed with submission anyway?')
          if (!proceed) {
            setLoading(false)
            return
          }
        }
      }

      // Upload file directly to your S3 endpoint with correct bucket name
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${selectedProject.id}/${selectedPhase.id}_${Date.now()}.${fileExt}`
      
      // Upload using FormData to your S3 endpoint with URL-encoded bucket name
      const formData = new FormData()
      formData.append('file', file)
      
      const uploadResponse = await fetch(`https://yizreuianmkswuiibhsd.storage.supabase.co/storage/v1/object/project%20files/${fileName}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: formData
      })

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error('Upload failed:', errorText)
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`)
      }

      // Store just the file path, we'll generate signed URLs when viewing
      const filePath = `project files/${fileName}`
      
      // Create submission record with similarity score
      const { error: submissionError } = await supabase
        .from('submissions')
        .insert({
          student_id: user.id,
          project_id: selectedProject.id,
          phase_id: selectedPhase.id,
          file_url: filePath,
          submission_date: new Date().toISOString(),
          rubric_check_status: 'pending',
          guide_status: 'pending',
          similarity_score: similarityResult?.score || 0
        })

      if (submissionError) throw submissionError

      // Reset form and refresh submissions
      setFile(null)
      setSelectedPhase(null)
      setSelectedProject(null)
      setPhases([])
      setSimilarityResult(null)
      const form = e.target as HTMLFormElement
      form.reset()
      await fetchSubmissions()
      
      alert('Submission successful!')
    } catch (error) {
      console.error('Error submitting file:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        type: typeof error,
        errorObject: error
      })
      alert(error instanceof Error ? error.message : 'Failed to submit file')
    } finally {
      setLoading(false)
      setCheckingSimilarity(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading submissions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Project Submissions</h1>

      {/* Upload Form */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-8">
        <div className="flex items-center mb-6">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div className="ml-3">
            <h2 className="text-xl font-semibold text-gray-900">New Submission</h2>
            <p className="text-sm text-gray-600">Upload your project submission for review</p>
            {selectedPhase && selectedProject && (
              <div className="mt-2 space-y-1">
                <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-md inline-block">
                  ⚠️ Resubmitting for {selectedPhase.name} - {selectedProject.title}
                </div>
                {selectedPhase.name.toLowerCase().includes('phase 1') && (
                  <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md inline-block ml-2">
                    🔍 Plagiarism check will be performed
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Project Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Project <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedProject?.id || ''}
                onChange={handleProjectChange}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                required
              >
                <option value="">-- Select a project --</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
              {projects.length === 0 && (
                <p className="mt-1 text-sm text-amber-600">No projects assigned. Please contact your admin.</p>
              )}
            </div>

            {/* Phase Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Phase <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedPhase?.id || ''}
                onChange={handlePhaseChange}
                disabled={!selectedProject}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                required
              >
                <option value="">
                  {selectedProject ? "-- Select a phase --" : "Select a project first"}
                </option>
                {phases.map((phase) => (
                  <option key={phase.id} value={phase.id}>
                    {phase.name} (Due: {new Date(phase.deadline).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Phase Info Display */}
          {selectedPhase && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-blue-800">Deadline:</span>
                  <p className="text-blue-700">{new Date(selectedPhase.deadline).toLocaleDateString()} at {new Date(selectedPhase.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div>
                  <span className="font-medium text-blue-800">Max Marks:</span>
                  <p className="text-blue-700">{selectedPhase.max_marks} points</p>
                </div>
                <div>
                  <span className="font-medium text-blue-800">Project:</span>
                  <p className="text-blue-700">{selectedProject?.title}</p>
                </div>
              </div>
            </div>
          )}

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload PDF Document <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-indigo-400 transition-colors bg-gray-50 hover:bg-gray-100">
              <div className="space-y-1 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="flex text-sm text-gray-600">
                  <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 px-2 py-1">
                    <span>Upload a file</span>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="sr-only"
                      required
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">PDF files only, up to 10MB</p>
                {file && (
                  <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                    <div className="flex items-center justify-center">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Selected: {file.name}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Similarity Check Results */}
          {checkingSimilarity && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                <div>
                  <h3 className="text-sm font-medium text-blue-800">Checking for Similarity</h3>
                  <p className="text-sm text-blue-600">Analyzing your submission against previous projects...</p>
                </div>
              </div>
            </div>
          )}

          {similarityResult && (
            <div className={`border rounded-md p-4 ${
              similarityResult.isSimilar 
                ? 'bg-red-50 border-red-200' 
                : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-start">
                <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 mr-3 ${
                  similarityResult.isSimilar ? 'bg-red-100' : 'bg-green-100'
                }`}>
                  {similarityResult.isSimilar ? (
                    <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className={`text-sm font-medium ${
                    similarityResult.isSimilar ? 'text-red-800' : 'text-green-800'
                  }`}>
                    Similarity Score: {similarityResult.score}%
                  </h3>
                  <p className={`text-sm mt-1 ${
                    similarityResult.isSimilar ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {similarityResult.message}
                  </p>
                  {similarityResult.isSimilar && (
                    <div className="mt-3 p-3 bg-red-100 rounded-md">
                      <p className="text-sm text-red-800">
                        <strong>⚠️ Submission Blocked:</strong> Your submission shows high similarity with previous projects. 
                        Please contact your guide before proceeding. Make sure your work is original and properly attributed.
                      </p>
                      <div className="mt-2">
                        <p className="text-xs text-red-700">
                          <strong>Analysis:</strong> {similarityResult.explanation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading || !file || !selectedPhase || !selectedProject || checkingSimilarity || (similarityResult?.isSimilar)}
              className={`px-6 py-3 rounded-md font-medium text-white transition-colors duration-200 ${
                loading || !file || !selectedPhase || !selectedProject || checkingSimilarity || (similarityResult?.isSimilar)
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
              }`}
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Uploading...
                </div>
              ) : checkingSimilarity ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Checking Similarity...
                </div>
              ) : similarityResult?.isSimilar ? (
                'Submission Blocked - Contact Guide'
              ) : (
                'Submit Assignment'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Submissions List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Submission History</h3>
          <p className="text-sm text-gray-600 mt-1">
            {submissions.length} submission{submissions.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {submissions.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No submissions yet</h3>
            <p className="text-gray-500">Your submissions will appear here once you upload them.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phase
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Marks
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Similarity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {submissions.map((submission) => (
                  <tr key={submission.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {submission.phases?.name || 'Unknown Phase'}
                      </div>
                      <div className="text-xs text-gray-500">
                        Due: {submission.phases?.deadline ? new Date(submission.phases.deadline).toLocaleDateString() : 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        submission.guide_status === 'accepted' ? 'bg-green-100 text-green-800' :
                        submission.guide_status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {submission.guide_status === 'accepted' ? 'Accepted' :
                         submission.guide_status === 'rejected' ? 'Rejected' : 'Pending Review'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(submission.submission_date).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {submission.late_days > 0 ? (
                          <span className="text-red-600">
                            {submission.late_days} day{submission.late_days > 1 ? 's' : ''} late
                          </span>
                        ) : (
                          <span className="text-green-600">On time</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {submission.marks_awarded !== null ? (
                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {submission.marks_awarded}/{submission.phases?.max_marks || 0} pts
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(submission.similarity_score !== null && submission.similarity_score !== undefined) ? (
                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          submission.similarity_score >= 40 
                            ? 'bg-red-100 text-red-800' 
                            : submission.similarity_score >= 25 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : 'bg-green-100 text-green-800'
                        }`}>
                          {submission.similarity_score}%
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          N/A
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewPDF(submission.file_url)}
                          className="text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 px-3 py-1 rounded-md transition-colors duration-150"
                        >
                          View PDF
                        </button>
                        {/* Show resubmit option for rejected submissions OR Phase 1 submissions with high similarity */}
                        {((submission.guide_status === 'rejected') || 
                          (submission.phases?.name?.toLowerCase().includes('phase 1') && 
                           submission.guide_status === 'pending' && 
                           submission.similarity_score >= 40)) && (
                          <button
                            onClick={() => handleResubmit(submission)}
                            className="text-orange-600 hover:text-orange-900 hover:bg-orange-50 px-3 py-1 rounded-md transition-colors duration-150 border border-orange-200"
                          >
                            Resubmit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}