'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/app/supabaseClient'
import Link from 'next/link'
import LeaderboardComponent from '@/app/components/Leaderboard'

interface Project {
  id: string
  title: string
  description: string
  status: string
  admin_project_id?: string
  project_name?: string
}

interface Phase {
  id: string
  name: string
  deadline: string
  project_id: string
  admin_projects?: {
    id: string
    title: string
  }[]
}

interface Submission {
  id: string
  guide_status: string
  created_at: string
  marks_awarded: number | null
  phases: {
    name: string
  }
}

interface ProjectData {
  project: Project | null
  upcomingDeadlines: Phase[]
  recentSubmissions: Submission[]
  allProjects?: Project[]
}

export default function StudentDashboard() {
  const [loading, setLoading] = useState(true)
  const [projectData, setProjectData] = useState<ProjectData>({
    project: null,
    upcomingDeadlines: [],
    recentSubmissions: [],
    allProjects: []
  })

  useEffect(() => {
    fetchStudentData()
  }, [])

  const fetchStudentData = async () => {
    try {
      setLoading(true)
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error('No user found')

      // Fetch student's projects
      const { data: studentProjects } = await supabase
        .from('projects')
        .select('id, title, description, status, admin_project_id, project_name')
        .eq('student_id', user.id)

      // Get the first project for display (you can modify this logic as needed)
      const project = studentProjects && studentProjects.length > 0 ? studentProjects[0] : null

      // Get admin_project_ids for the student's projects
      const adminProjectIds = studentProjects?.map(p => p.admin_project_id) || []

      // Fetch upcoming deadlines only for student's projects
      let upcomingDeadlines: Phase[] = []
      if (adminProjectIds.length > 0) {
        console.log('Admin project IDs:', adminProjectIds)
        
        // First, get the phases
        const { data: phases, error: phasesError } = await supabase
          .from('phases')
          .select('*')
          .in('project_id', adminProjectIds)
          .gt('deadline', new Date().toISOString())
          .order('deadline', { ascending: true })
          .limit(5)

        if (phasesError) {
          console.error('Error fetching phases:', phasesError)
          upcomingDeadlines = []
        } else if (phases && phases.length > 0) {
          // Then get the admin projects to get the titles
          const { data: adminProjects, error: adminProjectsError } = await supabase
            .from('admin_projects')
            .select('id, title')
            .in('id', adminProjectIds)

          if (adminProjectsError) {
            console.error('Error fetching admin projects:', adminProjectsError)
          }

          // Combine the data
          upcomingDeadlines = phases.map(phase => ({
            ...phase,
            admin_projects: adminProjects?.filter(ap => ap.id === phase.project_id) || []
          }))
          
          console.log('Combined phases with projects:', upcomingDeadlines)
        } else {
          upcomingDeadlines = []
        }
      }

      // Fetch recent submissions
      const { data: submissions } = await supabase
        .from('submissions')
        .select('*, phases(name)')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      // Store all projects for reference
      setProjectData({
        project,
        upcomingDeadlines,
        recentSubmissions: submissions || [],
        allProjects: studentProjects || []
      })
    } catch (error) {
      console.error('Error fetching student data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Student Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Status */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Your Projects</h2>
          {projectData.allProjects && projectData.allProjects.length > 0 ? (
            <div className="space-y-3">
              {projectData.allProjects.map((proj) => (
                <div key={proj.id} className="border-l-4 border-green-400 pl-3">
                  <h3 className="font-medium text-gray-900">{proj.title}</h3>
                  {proj.project_name && (
                    <div className="mt-1 flex items-center">
                      <svg className="w-4 h-4 text-blue-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a.997.997 0 01-1.414 0l-7-7A1.997 1.997 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span className="text-blue-700 text-sm font-medium bg-blue-50 px-2 py-1 rounded">
                        {proj.project_name}
                      </span>
                    </div>
                  )}
                  <p className="text-sm text-gray-600 mt-2">{proj.description}</p>
                  <div className="mt-2">
                    <span className={`px-2 py-1 rounded text-sm ${
                      proj.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {proj.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Assigned</h3>
              <p className="text-gray-600">Projects will be assigned by your administrator and will appear here when available.</p>
            </div>
          )}
        </div>

        {/* Upcoming Deadlines */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Upcoming Deadlines</h2>
          {projectData.upcomingDeadlines.length > 0 ? (
            <ul className="space-y-3">
              {projectData.upcomingDeadlines.map((phase) => (
                <li key={phase.id} className="border-l-4 border-indigo-400 pl-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium text-gray-900">{phase.name}</span>
                      <p className="text-sm text-gray-600">
                        Project: {phase.admin_projects?.[0]?.title || 'Unknown Project'}
                      </p>
                    </div>
                    <span className="text-sm text-gray-600 whitespace-nowrap ml-2">
                      {new Date(phase.deadline).toLocaleDateString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600">No upcoming deadlines</p>
          )}
        </div>

        {/* Leaderboard */}
        <div className="bg-white rounded-lg shadow">
          <LeaderboardComponent userRole="student" compact={true} maxEntries={5} />
          <div className="p-4 border-t border-gray-200">
            <Link 
              href="/dashboard/student/leaderboard" 
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            >
              View Full Leaderboard →
            </Link>
          </div>
        </div>

        {/* Recent Submissions */}
        <div className="bg-white p-4 rounded-lg shadow lg:col-span-3">
          <h2 className="text-xl font-semibold mb-4">Recent Submissions</h2>
          {projectData.recentSubmissions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Phase</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-left py-2">Submitted On</th>
                    <th className="text-left py-2">Marks</th>
                  </tr>
                </thead>
                <tbody>
                  {projectData.recentSubmissions.map((submission) => (
                    <tr key={submission.id} className="border-b">
                      <td className="py-2">{submission.phases.name}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-sm ${
                          submission.guide_status === 'accepted' ? 'bg-green-100 text-green-800' : 
                          submission.guide_status === 'rejected' ? 'bg-red-100 text-red-800' : 
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {submission.guide_status}
                        </span>
                      </td>
                      <td className="py-2">{new Date(submission.created_at).toLocaleDateString()}</td>
                      <td className="py-2">{submission.marks_awarded || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-600">No submissions yet</p>
          )}
        </div>
      </div>
    </div>
  )
}