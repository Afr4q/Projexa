'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/supabaseClient'
import LeaderboardComponent from '@/app/components/Leaderboard'

interface Student {
  name: string
}

interface GroupMember {
  student_id: string
  role: 'leader' | 'member'
  users: {
    name: string
  }
}

interface ProjectGroup {
  name: string
  group_members?: GroupMember[]
}

interface Project {
  id: string
  title: string
  project_name?: string
  is_group_project: boolean
  group_id: string | null
  student_id?: string
  users?: {
    name: string
  }
  project_groups?: ProjectGroup[]
}

interface Phase {
  name: string
}

interface SubmissionProject {
  title: string
  project_name?: string
  users?: {
    name: string
  }
}

interface Submission {
  id: string
  created_at: string
  guide_status: 'pending' | 'accepted' | 'rejected'
  projects: SubmissionProject
  phases: Phase
}

interface DashboardData {
  assignedProjects: number
  pendingReviews: number
  recentSubmissions: Submission[]
  projectDetails: Project[]
}

export default function GuideDashboard() {
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    assignedProjects: 0,
    pendingReviews: 0,
    recentSubmissions: [],
    projectDetails: []
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
        .select(`
          id, 
          title, 
          project_name,
          is_group_project, 
          group_id,
          student_id,
          users!projects_student_id_fkey (name),
          project_groups (
            name,
            group_members (
              student_id, 
              role, 
              users (name)
            )
          )
        `)
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
            project_name,
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
        recentSubmissions: submissions || [],
        projectDetails: guideProjects || []
      })
    } catch (error) {
      console.error('Error fetching guide data:', error)
      setDashboardData({
        assignedProjects: 0,
        pendingReviews: 0,
        recentSubmissions: [],
        projectDetails: []
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

        {/* Leaderboard Widget */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <LeaderboardComponent userRole="guide" compact={true} maxEntries={3} />
          <div className="p-4 border-t border-gray-200">
            <a 
              href="/dashboard/guide/leaderboard" 
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            >
              View Full Leaderboard →
            </a>
          </div>
        </div>
      </div>

      {/* Assigned Projects */}
      <div className="mb-8 bg-white rounded-lg shadow-md border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Assigned Projects</h2>
        </div>
        {dashboardData.projectDetails.length > 0 ? (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboardData.projectDetails.map((project) => (
                <div key={project.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{project.title}</h3>
                      {project.project_name && (
                        <div className="mt-1 flex items-center">
                          <svg className="w-4 h-4 text-blue-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a.997.997 0 01-1.414 0l-7-7A1.997 1.997 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          <span className="text-blue-700 text-sm font-medium bg-blue-50 px-2 py-1 rounded truncate">
                            {project.project_name}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ml-2 ${
                      project.is_group_project 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {project.is_group_project ? 'Group' : 'Individual'}
                    </span>
                  </div>
                  
                  {project.is_group_project && project.project_groups && project.project_groups[0] && (
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-600">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Group: {project.project_groups[0].name}
                      </div>
                      {project.project_groups[0].group_members && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Members ({project.project_groups[0].group_members.length}):</span>
                          <div className="mt-1 space-y-1">
                            {project.project_groups[0].group_members.map((member, index) => (
                            <div key={index} className="flex items-center justify-between text-xs">
                              <span>{member.users.name}</span>
                              <span className={`px-1 py-0.5 rounded text-xs ${
                                member.role === 'leader' 
                                  ? 'bg-yellow-100 text-yellow-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {member.role}
                              </span>
                            </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {!project.is_group_project && project.users && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Student:</span> {project.users.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No assigned projects</h3>
            <p className="text-gray-500">Projects assigned to you will appear here.</p>
          </div>
        )}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{submission.projects?.users?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>
                        <div className="font-medium">{submission.projects?.title || 'Unknown Project'}</div>
                        {submission.projects?.project_name && (
                          <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mt-1 inline-block">
                            {submission.projects.project_name}
                          </div>
                        )}
                      </div>
                    </td>
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