'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/supabaseClient'

interface Student {
  name: string
}

interface Project {
  title: string
  student: Student
}

interface Phase {
  name: string
}

interface Submission {
  id: string
  created_at: string
  guide_status: 'pending' | 'accepted' | 'rejected'
  projects: Project
  phases: Phase
}

interface DashboardData {
  assignedProjects: number
  pendingReviews: number
  recentSubmissions: Submission[]
}

export default function GuideDashboard() {
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    assignedProjects: 0,
    pendingReviews: 0,
    recentSubmissions: []
  })

  useEffect(() => {
    fetchGuideData()
  }, [])

  const fetchGuideData = async () => {
    try {
      setLoading(true)
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error('No user found')

      // First, get all project IDs for this guide
      const { data: guideProjects } = await supabase
        .from('projects')
        .select('id')
        .eq('guide_id', user.id)

      const projectIds = guideProjects?.map(p => p.id) || []

      // Fetch guide's statistics
      const { count: assignedProjects } = await supabase
        .from('projects')
        .select('*', { count: 'exact' })
        .eq('guide_id', user.id)

      const { count: pendingReviews } = await supabase
        .from('submissions')
        .select('*', { count: 'exact' })
        .eq('guide_status', 'pending')
        .in('project_id', projectIds)

      // Fetch recent submissions
      const { data: submissions } = await supabase
        .from('submissions')
        .select(`
          *,
          projects (
            title,
            student:users!projects_student_id_fkey (
              name
            )
          ),
          phases (
            name
          )
        `)
        .in('project_id', projectIds)
        .order('created_at', { ascending: false })
        .limit(5)

      setDashboardData({
        assignedProjects: assignedProjects || 0,
        pendingReviews: pendingReviews || 0,
        recentSubmissions: submissions || []
      })
    } catch (error) {
      console.error('Error fetching guide data:', error)
      setDashboardData({
        assignedProjects: 0,
        pendingReviews: 0,
        recentSubmissions: []
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Guide Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-full">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium text-gray-500">Assigned Projects</h2>
              <p className="text-2xl font-bold text-gray-900">{dashboardData.assignedProjects}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-full">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium text-gray-500">Pending Reviews</h2>
              <p className="text-2xl font-bold text-gray-900">{dashboardData.pendingReviews}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Recent Submissions</h2>
        </div>
        {dashboardData.recentSubmissions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phase</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted On</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dashboardData.recentSubmissions.map((submission) => (
                  <tr key={submission.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{submission.projects?.student?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{submission.projects?.title || 'Unknown Project'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{submission.phases?.name || 'Unknown Phase'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        submission.guide_status === 'accepted' ? 'bg-green-100 text-green-800' : 
                        submission.guide_status === 'rejected' ? 'bg-red-100 text-red-800' : 
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {submission.guide_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(submission.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No recent submissions</h3>
            <p className="text-gray-500">Submissions from your assigned projects will appear here.</p>
          </div>
        )}
      </div>
    </div>
  )
}