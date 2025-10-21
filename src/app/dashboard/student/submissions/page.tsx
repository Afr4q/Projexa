'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/supabaseClient'

interface Rubric {
  id: string
  name: string
  description: string
}

interface Phase {
  id: string
  name: string
  deadline: string
  max_marks: number
  department: string
  project_id: string
  created_at: string
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
  phases: Phase
}

interface RubricValidationResult {
  isValid: boolean
  foundRubrics: string[]
  missingRubrics: string[]
  reason: string
  message: string
}

interface UserData {
  department: string
}

interface Project {
  id: string
  title: string
  admin_project_id: string
  project_name?: string
  group_id?: string
  is_group_project: boolean
}

interface GroupMembership {
  id: string
  group_id: string
  student_id: string
  role: 'leader' | 'member'
  project_groups: {
    name: string
  }
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
  const [rubricValidationResult, setRubricValidationResult] = useState<RubricValidationResult | null>(null)
  const [validatingRubrics, setValidatingRubrics] = useState(false)
  const [isResubmission, setIsResubmission] = useState(false)
  const [resubmissionReason, setResubmissionReason] = useState<string>('')
  const [groupMembership, setGroupMembership] = useState<GroupMembership | null>(null)
  const [canSubmit, setCanSubmit] = useState(true)
  const [groupPermissions, setGroupPermissions] = useState({
    canSubmit: true,
    isLeader: false,
    groupName: null as string | null
  })
  const [phaseRubrics, setPhaseRubrics] = useState<Rubric[]>([])
  const [loadingRubrics, setLoadingRubrics] = useState(false)

  // Helper function to check if a phase is the initial phase (earliest by timestamp)
  const isInitialPhase = (phase: Phase, allPhases: Phase[]) => {
    if (!allPhases || allPhases.length === 0) return false
    
    // Sort phases by creation time and check if this is the first one
    const sortedPhases = [...allPhases].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    
    return sortedPhases[0]?.id === phase.id
  }

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
    
    // Set resubmission state
    setIsResubmission(true)
    
    // Determine and store resubmission reason
    const reason = submission.guide_status === 'rejected' 
      ? 'Submission was rejected by guide' 
      : submission.similarity_score >= 40 
        ? `High similarity detected (${submission.similarity_score}%)`
        : 'Resubmission requested'
    
    setResubmissionReason(reason)
    
    // Reset form state
    setFile(null)
    setSimilarityResult(null)
    
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
        .select('id, title, admin_project_id, project_name, group_id, is_group_project')
        .eq('student_id', user.id)
        .order('title', { ascending: true })

      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error('Error fetching projects:', error)
      setProjects([])
    }
  }

  const checkGroupPermissions = async (project: Project) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // If it's not a group project, user can submit
      if (!project.is_group_project || !project.group_id) {
        setCanSubmit(true)
        setGroupMembership(null)
        setGroupPermissions({
          canSubmit: true,
          isLeader: false,
          groupName: null
        })
        return
      }

      // Check if user is in the group and their role
      const { data: membership, error } = await supabase
        .from('group_members')
        .select(`
          id,
          group_id,
          student_id,
          role,
          project_groups (name)
        `)
        .eq('group_id', project.group_id)
        .eq('student_id', user.id)
        .single()

      if (error) {
        console.error('Error checking group membership:', error)
        setCanSubmit(false)
        setGroupMembership(null)
        setGroupPermissions({
          canSubmit: false,
          isLeader: false,
          groupName: null
        })
        return
      }

      setGroupMembership(membership)
      
      // Only group leaders can submit (you can change this logic)
      const isLeader = membership.role === 'leader'
      const groupName = membership.project_groups?.name || null
      
      setCanSubmit(isLeader)
      setGroupPermissions({
        canSubmit: isLeader,
        isLeader: isLeader,
        groupName: groupName
      })
    } catch (error) {
      console.error('Error checking group permissions:', error)
      setCanSubmit(false)
      setGroupPermissions({
        canSubmit: false,
        isLeader: false,
        groupName: null
      })
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
        .or(`project_id.eq.${project.admin_project_id},project_id.is.null`)
        .order('created_at', { ascending: true }) // Order by creation time to identify initial phase
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
            id,
            name,
            deadline,
            max_marks,
            created_at,
            department,
            project_id
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
    
    // Reset resubmission state when manually changing project
    setIsResubmission(false)
    setResubmissionReason('')
    
    if (project) {
      fetchPhases(project.id)
      checkGroupPermissions(project)
    } else {
      setCanSubmit(true)
      setGroupMembership(null)
      setGroupPermissions({
        canSubmit: true,
        isLeader: false,
        groupName: null
      })
    }
  }

  const fetchPhaseRubrics = async (phaseId: string) => {
    try {
      setLoadingRubrics(true)
      const { data: rubrics, error } = await supabase
        .from('rubrics')
        .select('id, name, description')
        .eq('phase_id', phaseId)
        .order('name')

      if (error) {
        console.error('Error fetching rubrics:', error)
        setPhaseRubrics([])
      } else {
        setPhaseRubrics(rubrics || [])
      }
    } catch (error) {
      console.error('Error fetching rubrics:', error)
      setPhaseRubrics([])
    } finally {
      setLoadingRubrics(false)
    }
  }

  const handlePhaseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const phaseId = e.target.value
    const phase = phases.find((p) => p.id === phaseId)
    setSelectedPhase(phase || null)
    
    // Reset resubmission state when manually changing phase
    setIsResubmission(false)
    setResubmissionReason('')
    
    // Fetch rubrics for the selected phase
    if (phaseId && phase) {
      fetchPhaseRubrics(phaseId)
    } else {
      setPhaseRubrics([])
    }
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
        const isPhase1 = isInitialPhase(selectedPhase, phases)
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

      // Step 1: Validate rubrics for all phases
      setValidatingRubrics(true)
      try {
        console.log('Starting rubric validation...')
        
        const rubricFormData = new FormData()
        rubricFormData.append('file', file)
        rubricFormData.append('phaseId', selectedPhase.id)

        // Get the current session token
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token

        const rubricResponse = await fetch('/api/validate-rubrics', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          body: rubricFormData
        })

        if (!rubricResponse.ok) {
          const errorText = await rubricResponse.text()
          console.error('Rubric validation failed:', errorText)
          throw new Error(`Failed to validate rubrics: ${rubricResponse.status} ${rubricResponse.statusText}`)
        }

        const rubricResult = await rubricResponse.json()
        console.log('Rubric validation result:', rubricResult)
        setRubricValidationResult(rubricResult)

        setValidatingRubrics(false)

        // If rubric validation fails, stop the submission process
        if (!rubricResult.isValid) {
          alert(`Submission rejected!\n\nReason: ${rubricResult.reason}\n\nMissing sections: ${rubricResult.missingRubrics.join(', ')}\n\nPlease ensure your PDF contains all required sections according to the rubrics.`)
          setLoading(false)
          return
        }

        // Show success message for rubric validation
        console.log('✅ Rubric validation passed:', rubricResult.message)
        
      } catch (rubricError) {
        console.error('Rubric validation failed:', rubricError)
        setValidatingRubrics(false)
        // Ask user if they want to proceed without rubric validation
        const proceed = confirm('Rubric validation failed. Do you want to proceed with submission anyway? Note: This may result in automatic rejection.')
        if (!proceed) {
          setLoading(false)
          return
        }
      }

      // Step 2: Check if this is initial phase - perform similarity check
      const isInitial = isInitialPhase(selectedPhase, phases)
                            
      console.log('Selected phase:', selectedPhase.name, '- Is initial phase:', isInitial)
      
      if (isInitial) {
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
      
      // Determine rubric check status based on validation result
      const rubricStatus = rubricValidationResult?.isValid === true ? 'passed' : 
                          rubricValidationResult?.isValid === false ? 'failed' : 'pending'

      // Create submission record with similarity score and rubric validation status
      const { error: submissionError } = await supabase
        .from('submissions')
        .insert({
          student_id: user.id,
          project_id: selectedProject.id,
          phase_id: selectedPhase.id,
          file_url: filePath,
          submission_date: new Date().toISOString(),
          rubric_check_status: rubricStatus,
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
      setRubricValidationResult(null)
      setIsResubmission(false)
      setResubmissionReason('')
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
      setValidatingRubrics(false)
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
            {isResubmission && selectedPhase && selectedProject && (
              <div className="mt-2 space-y-1">
                <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-md inline-block">
                  ⚠️ Resubmitting for {selectedPhase.name} - {selectedProject.title}
                  {selectedProject.project_name && ` (${selectedProject.project_name})`}
                </div>
                {resubmissionReason && (
                  <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded-md inline-block ml-2">
                    Reason: {resubmissionReason}
                  </div>
                )}
                {isInitialPhase(selectedPhase, phases) && (
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
                    {project.project_name && ` - ${project.project_name}`}
                  </option>
                ))}
              </select>
              {projects.length === 0 && (
                <p className="mt-1 text-sm text-amber-600">No projects assigned. Please contact your admin.</p>
              )}
              {selectedProject?.project_name && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center text-sm">
                    <svg className="w-4 h-4 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a.997.997 0 01-1.414 0l-7-7A1.997 1.997 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <span className="text-blue-800 font-medium">Project Name: </span>
                    <span className="text-blue-700 ml-1">{selectedProject.project_name}</span>
                  </div>
                </div>
              )}

              {/* Group submission warning */}
              {selectedProject?.is_group_project && !groupPermissions.canSubmit && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex items-center text-sm text-yellow-800">
                    <svg className="w-4 h-4 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0l-7.898 8.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <p className="font-medium">Group Project - Limited Access</p>
                      <p className="text-xs mt-1">Only the group leader can make submissions for this project. You are a group member.</p>
                    </div>
                  </div>
                </div>
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
                disabled={!selectedProject || (selectedProject?.is_group_project && !groupPermissions.canSubmit)}
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
            <div className="space-y-4">
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

              {/* Phase Rubrics */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center mb-3">
                  <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h4 className="font-medium text-green-800">Required Sections for {selectedPhase.name}</h4>
                </div>
                
                {loadingRubrics ? (
                  <div className="flex items-center text-sm text-green-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
                    Loading requirements...
                  </div>
                ) : phaseRubrics.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-green-700 mb-3">
                      Your PDF submission must include the following sections:
                    </p>
                    <ul className="space-y-2">
                      {phaseRubrics.map((rubric, index) => (
                        <li key={rubric.id} className="flex items-start">
                          <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium text-green-800 bg-green-100 rounded-full mr-3 mt-0.5 flex-shrink-0">
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-medium text-green-800 text-sm">{rubric.name}</p>
                            <p className="text-sm text-green-700 mt-1">{rubric.description}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-green-700">
                    No specific rubrics defined for this phase. Please follow general submission guidelines.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload PDF Document <span className="text-red-500">*</span>
            </label>
            <div className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-colors ${
              (selectedProject?.is_group_project && !groupPermissions.canSubmit)
                ? 'border-gray-200 bg-gray-100 cursor-not-allowed'
                : 'border-gray-300 hover:border-indigo-400 bg-gray-50 hover:bg-gray-100'
            }`}>
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
                      disabled={selectedProject?.is_group_project && !groupPermissions.canSubmit}
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

          {/* Rubric Validation Results */}
          {validatingRubrics && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                <div>
                  <h3 className="text-sm font-medium text-blue-800">Validating Rubrics</h3>
                  <p className="text-sm text-blue-600">Checking if your submission contains required sections...</p>
                </div>
              </div>
            </div>
          )}

          {rubricValidationResult && (
            <div className={`border rounded-md p-4 ${
              rubricValidationResult.isValid 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-start">
                <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 mr-3 ${
                  rubricValidationResult.isValid ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {rubricValidationResult.isValid ? (
                    <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className={`text-sm font-medium ${
                    rubricValidationResult.isValid ? 'text-green-800' : 'text-red-800'
                  }`}>
                    Rubric Validation: {rubricValidationResult.isValid ? 'Passed' : 'Failed'}
                  </h3>
                  <p className={`text-sm mt-1 ${
                    rubricValidationResult.isValid ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {rubricValidationResult.message}
                  </p>
                  {rubricValidationResult.foundRubrics.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-green-700">
                        <strong>✅ Found sections:</strong> {rubricValidationResult.foundRubrics.join(', ')}
                      </p>
                    </div>
                  )}
                  {!rubricValidationResult.isValid && (
                    <div className="mt-3 p-3 bg-red-100 rounded-md">
                      <p className="text-sm text-red-800">
                        <strong>❌ Missing Required Sections:</strong> {rubricValidationResult.missingRubrics.join(', ')}
                      </p>
                      <p className="text-xs text-red-700 mt-1">
                        Please ensure your PDF contains all required sections according to the phase rubrics.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

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
              disabled={loading || !file || !selectedPhase || !selectedProject || validatingRubrics || checkingSimilarity || (rubricValidationResult?.isValid === false) || (similarityResult?.isSimilar) || (selectedProject?.is_group_project && !groupPermissions.canSubmit)}
              className={`px-6 py-3 rounded-md font-medium text-white transition-colors duration-200 ${
                loading || !file || !selectedPhase || !selectedProject || validatingRubrics || checkingSimilarity || (rubricValidationResult?.isValid === false) || (similarityResult?.isSimilar) || (selectedProject?.is_group_project && !groupPermissions.canSubmit)
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
              }`}
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Uploading...
                </div>
              ) : validatingRubrics ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Validating Rubrics...
                </div>
              ) : checkingSimilarity ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Checking Similarity...
                </div>
              ) : similarityResult?.isSimilar ? (
                'Submission Blocked - Contact Guide'
              ) : (selectedProject?.is_group_project && !groupPermissions.canSubmit) ? (
                'Only Group Leader Can Submit'
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
                        {/* Show resubmit option for rejected submissions OR initial phase submissions with high similarity */}
                        {((submission.guide_status === 'rejected') || 
                          (submission.phases && isInitialPhase(submission.phases, phases) &&
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