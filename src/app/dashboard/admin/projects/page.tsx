'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/app/supabaseClient'

interface Project {
  id: string
  title: string
  description: string
  student_id: string
  guide_id: string | null
  department: string
  status: 'pending' | 'active' | 'completed'
  created_at: string
  admin_project_id: string | null
  student: {
    name: string
    email: string
    year: number
    semester: number
  }
  guide: {
    name: string
  } | null
}

interface AdminProject {
  id: string
  title: string
  year: number
  semester: number
  assigned_students: number
}

export default function AdminProjectsOverview() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [adminProjects, setAdminProjects] = useState<AdminProject[]>([])
  const [adminDepartment, setAdminDepartment] = useState<string | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all')
  const [selectedYearSem, setSelectedYearSem] = useState<string>('all')

  useEffect(() => {
    fetchAdminInfo()
  }, [])

  const fetchAdminInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      const { data, error } = await supabase
        .from('users')
        .select('department')
        .eq('id', user.id)
        .single()

      if (error) throw error
      if (!data?.department) throw new Error('No department found')

      setAdminDepartment(data.department)
      fetchProjects(data.department)
      fetchAdminProjects(data.department)
    } catch (error) {
      console.error('Error fetching admin info:', error)
    }
  }

  const fetchProjects = async (department: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          student:users!projects_student_id_fkey (
            name,
            email,
            year,
            semester
          ),
          guide:users!projects_guide_id_fkey (
            name
          )
        `)
        .eq('department', department)
        .order('created_at', { ascending: false })

      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAdminProjects = async (department: string) => {
    try {
      const { data, error } = await supabase
        .from('admin_projects')
        .select(`
          *,
          projects!admin_project_id(count)
        `)
        .eq('department', department)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      const projectsWithCount = data?.map(project => ({
        ...project,
        assigned_students: project.projects?.[0]?.count || 0
      })) || []

      setAdminProjects(projectsWithCount)
    } catch (error) {
      console.error('Error fetching admin projects:', error)
    }
  }

  const filteredProjects = projects.filter(project => {
    const statusMatch = selectedFilter === 'all' || project.status === selectedFilter
    const yearSemMatch = selectedYearSem === 'all' || 
      `${project.student?.year}-${project.student?.semester}` === selectedYearSem
    
    return statusMatch && yearSemMatch
  })

  const uniqueYearSemCombinations = Array.from(
    new Set(projects.map(p => `${p.student?.year}-${p.student?.semester}`))
  ).sort()

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading projects...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Projects Overview</h1>
        <button
          onClick={() => router.push('/dashboard/admin/admin-projects')}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
        >
          Create New Project
        </button>
      </div>

      {/* Department Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center">
          <div className="p-2 bg-blue-100 rounded-lg">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Department</h3>
            <p className="text-blue-700">{adminDepartment}</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-indigo-600">{adminProjects.length}</div>
          <div className="text-sm text-gray-600">Admin Projects</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-green-600">{projects.length}</div>
          <div className="text-sm text-gray-600">Total Individual Projects</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-yellow-600">
            {projects.filter(p => p.status === 'pending').length}
          </div>
          <div className="text-sm text-gray-600">Pending Assignment</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-blue-600">
            {projects.filter(p => p.status === 'active').length}
          </div>
          <div className="text-sm text-gray-600">Active Projects</div>
        </div>
      </div>

      {/* Admin Projects Summary */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Created Project Templates</h2>
        </div>
        <div className="p-6">
          {adminProjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {adminProjects.map((project) => (
                <div key={project.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <h3 className="font-medium text-lg mb-2">{project.title}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Year/Semester:</span>
                      <span>Year {project.year}, Sem {project.semester}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Students:</span>
                      <span className="font-medium">{project.assigned_students}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No project templates created yet</p>
              <button
                onClick={() => router.push('/dashboard/admin/admin-projects')}
                className="mt-2 text-indigo-600 hover:text-indigo-800"
              >
                Create your first project template
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status Filter</label>
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value as any)}
              className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year/Semester</label>
            <select
              value={selectedYearSem}
              onChange={(e) => setSelectedYearSem(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
            >
              <option value="all">All Year/Semester</option>
              {uniqueYearSemCombinations.map(combo => {
                const [year, semester] = combo.split('-')
                return (
                  <option key={combo} value={combo}>
                    Year {year}, Semester {semester}
                  </option>
                )
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Individual Projects List */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Individual Student Projects</h2>
        </div>
        
        {filteredProjects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year/Sem</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guide</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{project.title}</div>
                        <div className="text-sm text-gray-500 line-clamp-2">{project.description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{project.student?.name}</div>
                        <div className="text-sm text-gray-500">{project.student?.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        Year {project.student?.year}, Sem {project.student?.semester}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {project.guide?.name || 'Not assigned'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        project.status === 'active' ? 'bg-green-100 text-green-800' :
                        project.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {project.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(project.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-gray-500">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
            <p className="text-gray-500">No projects match the current filters.</p>
          </div>
        )}
      </div>
    </div>
  )
}