'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/supabaseClient'

interface Submission {
  id: string
  file_url: string
  submission_date: string
  guide_status: string
  marks_awarded?: number
  remarks?: string
  late_days?: number
  projects: {
    id: string
    title: string
    project_name?: string
    student: {
      id: string
      name: string
      email: string
    }
  }
  phases: {
    name: string
    max_marks: number
    late_penalty_per_day: number
    deadline: string
  }
}

export default function Review() {
  const [loading, setLoading] = useState(true)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [marks, setMarks] = useState('')
  const [remarks, setRemarks] = useState('')
  const [fileViewUrl, setFileViewUrl] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [showProjectNameInput, setShowProjectNameInput] = useState(false)

  useEffect(() => {
    fetchSubmissions()
  }, [])

  // Generate signed URL for file viewing
  const generateSignedUrl = async (filePath: string) => {
    try {
      console.log('Original file path:', filePath)
      
      // The filePath in database is like "project files/user_id/project_id/phase_id_timestamp.pdf"
      // We need to remove the "project files/" prefix since the bucket name is "project files"
      let fileName = filePath
      
      if (filePath.startsWith('project files/')) {
        fileName = filePath.replace('project files/', '')
      }
      
      console.log('Bucket: project files')
      console.log('File name:', fileName)

      const { data, error } = await supabase.storage
        .from('project files')
        .createSignedUrl(fileName, 3600) // 1 hour expiry

      if (error) {
        console.error('Error generating signed URL:', error)
        return null
      }

      console.log('Generated signed URL successfully')
      return data.signedUrl
    } catch (error) {
      console.error('Error generating signed URL:', error)
      return null
    }
  }

  // Update selected submission and generate file URL
  const selectSubmission = async (submission: Submission) => {
    setSelectedSubmission(submission)
    setFileViewUrl(null)
    setProjectName(submission.projects.project_name || '')
    
    // Check if this is initial phase to show project name input
    const isInitialPhase = submission.phases.name.toLowerCase().includes('phase 1') || 
                          submission.phases.name.toLowerCase().includes('review 1') ||
                          submission.phases.name.toLowerCase().includes('initial') ||
                          submission.phases.name.toLowerCase().includes('proposal')
    
    setShowProjectNameInput(isInitialPhase)
    
    // Pre-populate existing marks and remarks for editing
    if (submission.marks_awarded !== null && submission.marks_awarded !== undefined && submission.marks_awarded > 0) {
      setMarks(submission.marks_awarded.toString())
    } else {
      setMarks('')
    }
    
    if (submission.remarks) {
      setRemarks(submission.remarks)
    } else {
      setRemarks('')
    }
    
    if (submission.file_url) {
      const signedUrl = await generateSignedUrl(submission.file_url)
      setFileViewUrl(signedUrl)
    }
  }

  const fetchSubmissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      // First get the projects assigned to this guide
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id')
        .eq('guide_id', user.id)

      if (projectsError) throw projectsError

      const projectIds = projects?.map(p => p.id) || []

      if (projectIds.length === 0) {
        setSubmissions([])
        return
      }

      // Then get submissions for those projects
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          projects!inner (
            id,
            title,
            project_name,
            users!projects_student_id_fkey (
              id,
              name,
              email
            )
          ),
          phases (
            name,
            max_marks,
            late_penalty_per_day,
            deadline
          )
        `)
        .in('project_id', projectIds)
        .order('submission_date', { ascending: false })
        .order('submission_date', { ascending: true })

      if (error) throw error
      
      // Transform the data to match our interface
      const transformedData = (data || []).map((submission: any) => ({
        ...submission,
        projects: {
          ...submission.projects,
          student: submission.projects.users
        }
      }))

      setSubmissions(transformedData)
    } catch (error) {
      console.error('Error fetching submissions:', error)
      setSubmissions([])
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (status: 'accepted' | 'rejected') => {
    if (!selectedSubmission) return

    // Check if this is the first phase acceptance and project name is required
    const isFirstPhase = selectedSubmission.phases.name.toLowerCase().includes('phase 1') || 
                        selectedSubmission.phases.name.toLowerCase().includes('review 1') ||
                        selectedSubmission.phases.name.toLowerCase().includes('initial') ||
                        selectedSubmission.phases.name.toLowerCase().includes('proposal')

    // If accepting first phase, project name is required
    if (status === 'accepted' && isFirstPhase && !projectName.trim()) {
      alert('Please enter a project name for the initial phase acceptance.')
      return
    }

    try {
      setLoading(true)

      // Update submission status
      const { error } = await supabase
        .from('submissions')
        .update({
          guide_status: status,
          marks_awarded: status === 'accepted' ? parseInt(marks) : null,
          remarks: remarks
        })
        .eq('id', selectedSubmission.id)

      if (error) throw error

      // Handle group project marking - propagate marks to all group members
      if (status === 'accepted' && selectedSubmission.projects) {
        // First, check if this is a group project
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('is_group_project, group_id, admin_project_id, phase_id')
          .eq('id', selectedSubmission.projects.id)
          .single()

        if (!projectError && projectData && projectData.is_group_project && projectData.group_id) {
          try {
            // Get all group members for this project
            const { data: groupMembers, error: groupMembersError } = await supabase
              .from('group_members')
              .select(`
                student_id,
                users!group_members_student_id_fkey (
                  id,
                  name,
                  email
                )
              `)
              .eq('group_id', projectData.group_id)

            if (!groupMembersError && groupMembers) {
              // Get all other group members' projects (excluding the current one)
              const otherStudentIds = groupMembers
                .map(member => member.student_id)
                .filter(id => id !== selectedSubmission.projects.student.id)

              if (otherStudentIds.length > 0) {
                // Find projects for other group members with same admin_project_id
                const { data: otherProjects, error: otherProjectsError } = await supabase
                  .from('projects')
                  .select('id')
                  .eq('admin_project_id', projectData.admin_project_id)
                  .in('student_id', otherStudentIds)

                if (!otherProjectsError && otherProjects) {
                  const otherProjectIds = otherProjects.map(p => p.id)

                  // Find submissions for these projects in the same phase
                  const { data: otherSubmissions, error: otherSubmissionsError } = await supabase
                    .from('submissions')
                    .select('id, project_id')
                    .in('project_id', otherProjectIds)
                    .eq('phase_id', selectedSubmission.phase_id)

                  if (!otherSubmissionsError && otherSubmissions) {
                    // Update all other group members' submissions with the same marks and remarks
                    const updatePromises = otherSubmissions.map(submission => 
                      supabase
                        .from('submissions')
                        .update({
                          guide_status: status,
                          marks_awarded: parseInt(marks),
                          remarks: `${remarks} (Group marking - same as group leader)`
                        })
                        .eq('id', submission.id)
                    )

                    const updateResults = await Promise.allSettled(updatePromises)
                    
                    // Log any failed updates but don't throw error
                    updateResults.forEach((result, index) => {
                      if (result.status === 'rejected') {
                        console.error(`Failed to update group member submission ${otherSubmissions[index].id}:`, result.reason)
                      }
                    })

                    // Send notifications to other group members
                    const notificationPromises = groupMembers
                      .filter(member => member.student_id !== selectedSubmission.projects.student.id)
                      .map(member => 
                        supabase
                          .from('notifications')
                          .insert({
                            user_id: member.student_id,
                            title: `Group Submission ${status}`,
                            message: `Your group submission for ${selectedSubmission.phases.name} has been ${status} (marks propagated from group leader). ${remarks}`,
                            is_read: false
                          })
                      )

                    await Promise.allSettled(notificationPromises)
                  }
                }
              }
            }
          } catch (groupError) {
            console.error('Error handling group project marking:', groupError)
            // Don't throw error here, as the main operation succeeded
          }
        }
      }

      // If accepting first phase, update project with the project name (whether new or updated)
      if (status === 'accepted' && isFirstPhase && projectName.trim()) {
        const { error: projectUpdateError } = await supabase
          .from('projects')
          .update({
            project_name: projectName.trim()
          })
          .eq('id', selectedSubmission.projects.id)

        if (projectUpdateError) {
          console.error('Error updating project name:', projectUpdateError)
          // Don't throw error here, as the main operation succeeded
        }
      }

      // Send notification to student
      const isEdit = selectedSubmission.guide_status !== 'pending'
      const actionText = isEdit ? `review updated to ${status}` : status
      const notificationMessage = status === 'accepted' && isFirstPhase && projectName
        ? `Your submission for ${selectedSubmission.phases.name} has been ${actionText}. Project Name: "${projectName}". ${remarks}`
        : `Your submission for ${selectedSubmission.phases.name} has been ${actionText}. ${remarks}`

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: selectedSubmission.projects.student.id,
          title: isEdit ? `Submission Review Updated` : `Submission ${status}`,
          message: notificationMessage,
          is_read: false
        })

      if (notificationError) {
        console.error('Error sending notification:', notificationError)
        // Don't throw error here, as the main operation succeeded
      }

      // Reset form and refresh submissions
      setSelectedSubmission(null)
      setMarks('')
      setRemarks('')
      setProjectName('')
      setShowProjectNameInput(false)
      setFileViewUrl(null)
      fetchSubmissions()

    } catch (error) {
      console.error('Error reviewing submission:', error)
      alert('Error updating submission. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading && submissions.length === 0) {
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
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Review Submissions</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submissions List */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">All Submissions</h2>
            <div className="flex space-x-2 text-xs">
              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Pending</span>
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">Accepted</span>
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full">Rejected</span>
            </div>
          </div>
          {submissions.length > 0 ? (
            <div className="space-y-4">
              {submissions.map((submission) => (
                <div
                  key={submission.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors
                    ${selectedSubmission?.id === submission.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-300'
                    }`}
                  onClick={() => selectSubmission(submission)}
                >
                  <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{submission.projects.title}</h3>
                      {submission.projects.project_name && (
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 text-xs rounded-full font-medium">
                          {submission.projects.project_name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {submission.projects.student.name}
                    </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          submission.guide_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          submission.guide_status === 'accepted' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {submission.guide_status}
                        </span>
                        {submission.late_days && submission.late_days > 0 ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                            {submission.late_days} day{submission.late_days > 1 ? 's' : ''} late
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <p>{submission.phases.name}</p>
                      <p>{new Date(submission.submission_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Submissions</h3>
              <p className="text-gray-500">No submissions found for your assigned projects.</p>
            </div>
          )}
        </div>

        {/* Review Form */}
        {selectedSubmission && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Review Submission</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Project Details</h3>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-gray-600">{selectedSubmission.projects.title}</p>
                  {selectedSubmission.projects.project_name && (
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 text-xs rounded-full font-medium">
                      {selectedSubmission.projects.project_name}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  By: {selectedSubmission.projects.student.name}
                </p>
              </div>

              <div>
                <h3 className="font-medium">Phase</h3>
                <p className="text-gray-600">{selectedSubmission.phases.name}</p>
                <p className="text-sm text-gray-500">
                  Maximum Marks: {selectedSubmission.phases.max_marks}
                </p>
              </div>

              <div>
                <h3 className="font-medium">Submission File</h3>
                <div className="mt-2">
                  {fileViewUrl ? (
                    <div className="space-y-2">
                      <a
                        href={fileViewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View PDF File
                      </a>
                      <div className="mt-4 border border-gray-300 rounded-lg">
                        <iframe
                          src={fileViewUrl}
                          width="100%"
                          height="400"
                          className="rounded-lg"
                          title="Submission PDF"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-20 border-2 border-dashed border-gray-300 rounded-lg">
                      <div className="text-center">
                        <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="mt-1 text-sm text-gray-500">Loading file...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-2">Submission Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Submitted:</span>
                    <p className="font-medium">{new Date(selectedSubmission.submission_date).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <p className={`font-medium ${
                      selectedSubmission.guide_status === 'pending' ? 'text-yellow-600' :
                      selectedSubmission.guide_status === 'accepted' ? 'text-green-600' :
                      'text-red-600'
                    }`}>
                      {selectedSubmission.guide_status.charAt(0).toUpperCase() + selectedSubmission.guide_status.slice(1)}
                    </p>
                  </div>
                  {selectedSubmission.late_days && selectedSubmission.late_days > 0 ? (
                    <div>
                      <span className="text-gray-500">Late Submission:</span>
                      <p className="font-medium text-orange-600">{selectedSubmission.late_days} day{selectedSubmission.late_days > 1 ? 's' : ''}</p>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Review Section Header */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {selectedSubmission.guide_status === 'pending' ? 
                      'Submit Review' : 
                      'Edit Review'
                    }
                  </h3>
                  {selectedSubmission.guide_status !== 'pending' && (
                    <div className="text-sm text-gray-600">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                        Previously {selectedSubmission.guide_status}
                      </span>
                    </div>
                  )}
                </div>
                {selectedSubmission.guide_status !== 'pending' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-blue-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <div className="flex-1 text-sm text-blue-800">
                        <p className="font-medium">Editing Previous Review</p>
                        <p>You can modify the status, marks, and remarks for this submission. The student will be notified of any changes.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Late Submission Penalty Information */}
              {selectedSubmission.late_days && selectedSubmission.late_days > 0 ? (
                <div className="bg-orange-50 border border-orange-200 rounded-md p-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-orange-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.96-.833-2.73 0L3.084 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="font-medium text-orange-900">Late Submission Penalty</h4>
                      <div className="mt-2 text-sm text-orange-800">
                        <p><strong>Days late:</strong> {selectedSubmission.late_days} day(s)</p>
                        <p><strong>Penalty per day:</strong> {selectedSubmission.phases.late_penalty_per_day} marks</p>
                        <p><strong>Total penalty:</strong> {selectedSubmission.late_days * selectedSubmission.phases.late_penalty_per_day} marks</p>
                        <div className="mt-2 p-2 bg-orange-100 rounded">
                          <p className="font-medium">Recommended final marks calculation:</p>
                          <p>Base marks - {selectedSubmission.late_days * selectedSubmission.phases.late_penalty_per_day} (penalty) = Final marks</p>
                          <p className="text-xs text-orange-700 mt-1">
                            Note: Final marks cannot be negative. Enter the final calculated marks below.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Marks {selectedSubmission.late_days && selectedSubmission.late_days > 0 ? (
                    <span className="text-orange-600 font-normal">(after applying late penalty)</span>
                  ) : null}
                </label>
                <input
                  type="number"
                  min="0"
                  max={selectedSubmission.phases.max_marks}
                  value={marks}
                  onChange={(e) => setMarks(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder={`Enter marks (0-${selectedSubmission.phases.max_marks})`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Remarks</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Enter your feedback and remarks..."
                />
              </div>

              {/* Project Name Input - Show for initial phases */}
              {showProjectNameInput && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <div className="flex items-center mb-3">
                    <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a.997.997 0 01-1.414 0l-7-7A1.997 1.997 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <h4 className="font-medium text-blue-900">Project Name (Required for Initial Phase)</h4>
                  </div>
                  <p className="text-sm text-blue-700 mb-3">
                    Please provide a specific project name that will be used throughout the project lifecycle to identify this project.
                  </p>
                  <label className="block text-sm font-medium text-blue-900 mb-2">Project Name *</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="block w-full px-3 py-2 bg-white border border-blue-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter the specific project name (e.g., 'E-Commerce Website with AI Recommendations')"
                    required
                  />
                  <p className="mt-2 text-xs text-blue-600">
                    This name will be displayed alongside the original project title for better identification.
                  </p>
                </div>
              )}

              <div className="flex gap-4">
                {(() => {
                  const isFirstPhase = selectedSubmission.phases.name.toLowerCase().includes('phase 1') || 
                                      selectedSubmission.phases.name.toLowerCase().includes('review 1') ||
                                      selectedSubmission.phases.name.toLowerCase().includes('initial') ||
                                      selectedSubmission.phases.name.toLowerCase().includes('proposal')
                  
                  return (
                    <>
                      <button
                        onClick={() => handleReview('accepted')}
                        disabled={!marks || loading || parseInt(marks) > selectedSubmission.phases.max_marks || (isFirstPhase && !projectName.trim())}
                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Processing...' : (
                          selectedSubmission.guide_status === 'pending' ? 
                            'Accept' :
                            'Update as Accepted'
                        )}
                      </button>
                      <button
                        onClick={() => handleReview('rejected')}
                        disabled={!remarks || loading}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Processing...' : (
                          selectedSubmission.guide_status === 'pending' ? 'Reject' : 'Update as Rejected'
                        )}
                      </button>
                    </>
                  )
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}