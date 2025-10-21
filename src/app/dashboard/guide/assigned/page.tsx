'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/supabaseClient'

interface Student {
  id: string
  name: string
  email: string
}

interface Submission {
  id: string
  guide_status: string
  created_at: string
}

interface Project {
  id: string
  title: string
  description: string
  status: string
  created_at: string
  project_name?: string
  student: Student
  latest_submission?: Submission[]
}

export default function AssignedProjects() {
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          users!projects_student_id_fkey (
            id,
            name,
            email
          ),
          submissions (
            id,
            guide_status,
            created_at
          )
        `)
        .eq('guide_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // Transform the data to match our interface
      const transformedData = (data || []).map((project: any) => ({
        ...project,
        student: project.users,
        latest_submission: project.submissions?.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ).slice(0, 1) || []
      }))
      
      setProjects(transformedData)
    } catch (error) {
      console.error('Error fetching projects:', error)
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading assigned projects...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Assigned Projects</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {projects.map((project) => (
              <div key={project.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="mb-4">
                  <h3 className="font-medium text-lg">{project.title}</h3>
                  {project.project_name && (
                    <div className="mt-1 flex items-center">
                      <svg className="w-4 h-4 text-blue-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a.997.997 0 01-1.414 0l-7-7A1.997 1.997 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span className="text-blue-700 text-sm font-medium bg-blue-50 px-2 py-1 rounded">
                        {project.project_name}
                      </span>
                    </div>
                  )}
                  <p className="text-gray-600 text-sm line-clamp-2 mt-2">
                    {project.description}
                  </p>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Student:</span>
                    <span className="font-medium">{project.student?.name || 'Unknown'}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-500">Status:</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      project.status === 'active' ? 'bg-green-100 text-green-800' :
                      project.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {project.status}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-500">Started:</span>
                    <span>{new Date(project.created_at).toLocaleDateString()}</span>
                  </div>

                  {project.latest_submission && project.latest_submission.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Last Submission:</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        project.latest_submission[0].guide_status === 'accepted' ? 'bg-green-100 text-green-800' :
                        project.latest_submission[0].guide_status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {project.latest_submission[0].guide_status}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-gray-500">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects assigned yet</h3>
            <p className="text-gray-500">You haven't been assigned any projects to guide.</p>
          </div>
        )}
      </div>
    </div>
  )
}