'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '@/app/supabaseClient'

interface AdminProject {
  id: string
  title: string
  description: string
  department: string
  year: number
  semester: number
  created_by: string
  max_students: number
  status: string
  created_at: string
  assigned_students?: number
  project_type: 'individual' | 'group' | 'mixed'
  allow_group_formation: boolean
  min_group_size: number
  max_group_size: number
}

interface Student {
  id: string
  name: string
  email: string
  year: number
  semester: number
}

export default function AdminProjects() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [adminProjects, setAdminProjects] = useState<AdminProject[]>([])
  const [adminDepartment, setAdminDepartment] = useState<string | null>(null)
  const [selectedYearSem, setSelectedYearSem] = useState<{year: number, semester: number} | null>(null)
  const [studentsPreview, setStudentsPreview] = useState<Student[]>([])
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    year: 1,
    semester: 1,
    max_students: 1,
    project_type: 'individual' as 'individual' | 'group' | 'mixed',
    allow_group_formation: false,
    min_group_size: 2,
    max_group_size: 4
  })

  useEffect(() => {
    fetchAdminInfo()
  }, [])

  const fetchAdminInfo = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      // Get user's department
      const { data, error } = await supabase
        .from('users')
        .select('department')
        .eq('id', user.id)
        .single()

      if (error) throw error
      if (!data?.department) throw new Error('No department found')

      setAdminDepartment(data.department)
      // Fetch admin projects after we know the department
      fetchAdminProjects(data.department)
    } catch (error) {
      console.error('Error fetching admin info:', error)
      alert('Error: Could not fetch admin department information')
    }
  }

  const fetchAdminProjects = async (department: string) => {
    try {
      setLoading(true)
      
      // Fetch admin projects with student count
      const { data, error } = await supabase
        .from('admin_projects')
        .select(`
          *,
          projects!admin_project_id(count)
        `)
        .eq('department', department)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // Transform the data to include assigned_students count
      const projectsWithCount = data?.map(project => ({
        ...project,
        assigned_students: project.projects?.[0]?.count || 0
      })) || []

      setAdminProjects(projectsWithCount)
    } catch (error) {
      console.error('Error fetching admin projects:', error)
      alert('Error loading projects. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  const fetchStudentsPreview = async (year: number, semester: number) => {
    if (!adminDepartment) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, year, semester')
        .eq('role', 'student')
        .eq('department', adminDepartment)
        .eq('year', year)
        .eq('semester', semester)
        .order('name')

      if (error) throw error
      setStudentsPreview(data || [])
    } catch (error) {
      console.error('Error fetching students:', error)
      setStudentsPreview([])
    }
  }

  const handleYearSemesterChange = (year: number, semester: number) => {
    setFormData({ ...formData, year, semester })
    setSelectedYearSem({ year, semester })
    fetchStudentsPreview(year, semester)
  }

  const handleProjectTypeChange = (projectType: 'individual' | 'group' | 'mixed') => {
    setFormData({ 
      ...formData, 
      project_type: projectType,
      allow_group_formation: projectType !== 'individual'
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!adminDepartment) {
      alert('Error: No department found for admin')
      return
    }

    if (!formData.title.trim() || !formData.description.trim()) {
      alert('Please fill in all required fields')
      return
    }

    try {
      setSubmitting(true)

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No authentication token found')
      }

      // Create admin project using API route
      const response = await fetch('/api/admin/create-admin-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim(),
          department: adminDepartment,
          year: formData.year,
          semester: formData.semester,
          max_students: formData.max_students,
          project_type: formData.project_type,
          allow_group_formation: formData.allow_group_formation || formData.project_type !== 'individual',
          min_group_size: formData.min_group_size,
          max_group_size: formData.max_group_size
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Error creating project')
      }

      // Reset form
      setFormData({
        title: '',
        description: '',
        year: 1,
        semester: 1,
        max_students: 1,
        project_type: 'individual',
        allow_group_formation: false,
        min_group_size: 2,
        max_group_size: 4
      })
      setSelectedYearSem(null)
      setStudentsPreview([])

      // Refresh projects list
      if (adminDepartment) {
        fetchAdminProjects(adminDepartment)
      }

      alert(result.message)
    } catch (error) {
      console.error('Error creating project:', error)
      alert(error instanceof Error ? error.message : 'Error creating project. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin projects...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Manage Admin Projects</h1>

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

      {/* Add Project Form */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-8">
        <div className="flex items-center mb-6">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <div className="ml-3">
            <h2 className="text-xl font-semibold text-gray-900">Create New Project</h2>
            <p className="text-sm text-gray-600">Create projects for students in the selected year and semester. Configure individual, group, or mixed project types.</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 bg-white text-gray-900"
                required
                placeholder="Enter project title"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 bg-white text-gray-900"
                rows={4}
                required
                placeholder="Describe the project objectives, requirements, and expected outcomes..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
              <select
                value={formData.year}
                onChange={(e) => handleYearSemesterChange(parseInt(e.target.value), formData.semester)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 bg-white text-gray-900"
              >
                <option value={1}>1st Year</option>
                <option value={2}>2nd Year</option>
                <option value={3}>3rd Year</option>
                <option value={4}>4th Year</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
              <select
                value={formData.semester}
                onChange={(e) => handleYearSemesterChange(formData.year, parseInt(e.target.value))}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 bg-white text-gray-900"
              >
                <option value={1}>1st Semester</option>
                <option value={2}>2nd Semester</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project Type</label>
              <select
                value={formData.project_type}
                onChange={(e) => handleProjectTypeChange(e.target.value as 'individual' | 'group' | 'mixed')}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 bg-white text-gray-900"
              >
                <option value="individual">Individual Projects Only</option>
                <option value="group">Group Projects Only</option>
                <option value="mixed">Mixed (Individual + Group)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Allow Group Formation</label>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.allow_group_formation || formData.project_type !== 'individual'}
                  onChange={(e) => setFormData({ ...formData, allow_group_formation: e.target.checked })}
                  disabled={formData.project_type === 'group'} // Always true for group projects
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">
                  {formData.project_type === 'group' ? 'Required for group projects' : 'Enable group creation'}
                </span>
              </div>
            </div>
          </div>

          {/* Group Settings - Show only when groups are enabled */}
          {(formData.project_type === 'group' || formData.project_type === 'mixed' || formData.allow_group_formation) && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Group Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Group Size
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="10"
                    value={formData.min_group_size}
                    onChange={(e) => setFormData({ ...formData, min_group_size: parseInt(e.target.value) || 2 })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Group Size
                  </label>
                  <input
                    type="number"
                    min={formData.min_group_size}
                    max="10"
                    value={formData.max_group_size}
                    onChange={(e) => setFormData({ ...formData, max_group_size: parseInt(e.target.value) || 4 })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 bg-white text-gray-900"
                  />
                </div>
              </div>

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Group Project Guidelines:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong>Individual:</strong> Each student works on their own project</li>
                      <li><strong>Group:</strong> Students must form groups (no individual projects allowed)</li>
                      <li><strong>Mixed:</strong> Students can choose individual or group projects</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Students Preview */}
          {selectedYearSem && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Students in Year {selectedYearSem.year}, Semester {selectedYearSem.semester}
              </h3>
              {studentsPreview.length > 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <div className="flex items-center mb-3">
                    <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-green-800 font-medium">
                      {studentsPreview.length} students found
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                    {studentsPreview.map((student) => (
                      <div key={student.id} className="text-sm text-green-700">
                        {student.name}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <p className="text-yellow-800">
                      No students found for Year {selectedYearSem.year}, Semester {selectedYearSem.semester}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting || studentsPreview.length === 0}
              className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                ${submitting || studentsPreview.length === 0
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                } transition-colors`}
            >
              {submitting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating Project...
                </div>
              ) : (
                `Create Project for ${studentsPreview.length} Students`
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Admin Projects List */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Created Projects</h2>
        </div>
        
        {adminProjects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year/Semester</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {adminProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/dashboard/admin/admin-projects/${project.id}/students`} className="block">
                        <div>
                          <div className="text-sm font-medium text-gray-900 hover:text-indigo-600">{project.title}</div>
                          <div className="text-sm text-gray-500 line-clamp-2">{project.description}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={`/dashboard/admin/admin-projects/${project.id}/students`} className="block">
                        <div className="text-sm text-gray-900">
                          Year {project.year}, Sem {project.semester}
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={`/dashboard/admin/admin-projects/${project.id}/students`} className="block">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          project.project_type === 'individual' ? 'bg-blue-100 text-blue-800' :
                          project.project_type === 'group' ? 'bg-purple-100 text-purple-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                          {project.project_type || 'individual'}
                        </span>
                        {project.allow_group_formation && (
                          <div className="text-xs text-gray-500 mt-1">
                            Groups: {project.min_group_size || 2}-{project.max_group_size || 4}
                          </div>
                        )}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={`/dashboard/admin/admin-projects/${project.id}/students`} className="block">
                        <div className="text-sm font-medium text-gray-900">
                          {project.assigned_students} students
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={`/dashboard/admin/admin-projects/${project.id}/students`} className="block">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          project.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {project.status}
                        </span>
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <Link href={`/dashboard/admin/admin-projects/${project.id}/students`} className="block">
                        {new Date(project.created_at).toLocaleDateString()}
                      </Link>
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects created yet</h3>
            <p className="text-gray-500">Create your first project to assign to students.</p>
          </div>
        )}
      </div>
    </div>
  )
}