'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/supabaseClient'

interface Submission {
  id: string
  file_url: string
  submission_date: string
  guide_status: string
  rubric_check_status: string
  marks_awarded?: number
  remarks?: string
  late_days?: number
  projects: {
    id: string
    title: string
    student: {
      id: string
      name: string
      email: string
    }
  }
  phases: {
    name: string
    max_marks: number
  }
}

export default function Review() {
  const [loading, setLoading] = useState(true)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [marks, setMarks] = useState('')
  const [remarks, setRemarks] = useState('')
  const [fileViewUrl, setFileViewUrl] = useState<string | null>(null)

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
            users!projects_student_id_fkey (
              id,
              name,
              email
            )
          ),
          phases (
            name,
            max_marks
          )
        `)
        .eq('guide_status', 'pending')
        .in('project_id', projectIds)
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

      // Send notification to student
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: selectedSubmission.projects.student.id,
          title: `Submission ${status}`,
          message: `Your submission for ${selectedSubmission.phases.name} has been ${status}. ${remarks}`,
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
        {/* Pending Submissions List */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Pending Submissions</h2>
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
                      <h3 className="font-medium">{submission.projects.title}</h3>
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
                        {submission.late_days && submission.late_days > 0 && (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                            {submission.late_days} day{submission.late_days > 1 ? 's' : ''} late
                          </span>
                        )}
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
              <p className="text-gray-500">No pending submissions</p>
              <p className="text-sm text-gray-400 mt-2">
                All submissions have been reviewed or no projects assigned.
              </p>
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
                <p className="text-gray-600">{selectedSubmission.projects.title}</p>
                <p className="text-sm text-gray-500">
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
                  {selectedSubmission.late_days && selectedSubmission.late_days > 0 && (
                    <div>
                      <span className="text-gray-500">Late Submission:</span>
                      <p className="font-medium text-orange-600">{selectedSubmission.late_days} day{selectedSubmission.late_days > 1 ? 's' : ''}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">Rubric Check:</span>
                    <p className={`font-medium ${
                      selectedSubmission.rubric_check_status === 'pending' ? 'text-yellow-600' :
                      selectedSubmission.rubric_check_status === 'passed' ? 'text-green-600' :
                      'text-red-600'
                    }`}>
                      {selectedSubmission.rubric_check_status?.charAt(0).toUpperCase() + selectedSubmission.rubric_check_status?.slice(1)}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Marks</label>
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

              <div className="flex gap-4">
                <button
                  onClick={() => handleReview('accepted')}
                  disabled={!marks || loading || parseInt(marks) > selectedSubmission.phases.max_marks}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? 'Processing...' : 'Accept'}
                </button>
                <button
                  onClick={() => handleReview('rejected')}
                  disabled={!remarks || loading}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? 'Processing...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}