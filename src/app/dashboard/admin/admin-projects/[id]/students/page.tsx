'use client'

import { useState, useEffect, use } from 'react'
import { supabase } from '@/app/supabaseClient'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

interface Student {
  id: string
  name: string
  email: string
  department: string
  project_id: string
  guide_id: string | null
  guide?: {
    id: string
    name: string
    email: string
  } | undefined
}

interface Guide {
  id: string
  name: string
  email: string
  department: string
}

interface AdminProject {
  id: string
  title: string
  description: string
  department: string
}

export default function ProjectStudentsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const [adminProject, setAdminProject] = useState<AdminProject | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [guides, setGuides] = useState<Guide[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    fetchProjectAndStudents()
    fetchGuides()
  }, [resolvedParams.id])

  const fetchProjectAndStudents = async () => {
    try {
      console.log('Fetching project with ID:', resolvedParams.id)
      
      // Check if we can access admin_projects table at all
      const { data: allProjects, error: allProjectsError } = await supabase
        .from('admin_projects')
        .select('id, title')
        .limit(1)

      if (allProjectsError) {
        console.error('Cannot access admin_projects table:', allProjectsError)
        alert('Error: Cannot access admin projects. Please check your permissions.')
        return
      }

      console.log('Can access admin_projects table. Sample data:', allProjects)

      // Fetch admin project details
      const { data: projectData, error: projectError } = await supabase
        .from('admin_projects')
        .select('*')
        .eq('id', resolvedParams.id)
        .single()

      if (projectError) {
        console.error('Project fetch error details:', {
          error: projectError,
          message: projectError.message,
          details: projectError.details,
          hint: projectError.hint,
          code: projectError.code
        })
        
        if (projectError.code === 'PGRST116') {
          alert('Project not found. Please check if the project ID is correct.')
          return
        }
        
        throw new Error(`Failed to fetch project: ${projectError.message || 'Unknown error'}`)
      }

      console.log('Project data:', projectData)
      setAdminProject(projectData)

      // Check if we can access projects table
      const { data: allUserProjects, error: allUserProjectsError } = await supabase
        .from('projects')
        .select('id, admin_project_id')
        .limit(1)

      if (allUserProjectsError) {
        console.error('Cannot access projects table:', allUserProjectsError)
        alert('Error: Cannot access projects table. Please check your permissions.')
        return
      }

      console.log('Can access projects table. Sample data:', allUserProjects)

      // First, let's try a simple query to see if basic projects fetching works
      const { data: basicProjectsData, error: basicError } = await supabase
        .from('projects')
        .select('*')
        .eq('admin_project_id', resolvedParams.id)

      if (basicError) {
        console.error('Basic projects fetch error details:', {
          error: basicError,
          message: basicError.message,
          details: basicError.details,
          hint: basicError.hint,
          code: basicError.code
        })
        throw new Error(`Failed to fetch projects: ${basicError.message || 'Unknown error'}`)
      }

      console.log('Basic projects data:', basicProjectsData)

      // Now try to fetch students with a simpler approach
      if (basicProjectsData && basicProjectsData.length > 0) {
        const studentIds = basicProjectsData.map(p => p.student_id).filter(Boolean)
        console.log('Student IDs to fetch:', studentIds)
        
        if (studentIds.length === 0) {
          console.log('No students found for this project')
          setStudents([])
          return
        }
        
        const { data: studentsData, error: studentsError } = await supabase
          .from('users')
          .select('id, name, email, department')
          .in('id', studentIds)

        if (studentsError) {
          console.error('Students fetch error details:', {
            error: studentsError,
            message: studentsError.message,
            details: studentsError.details,
            hint: studentsError.hint,
            code: studentsError.code
          })
          throw new Error(`Failed to fetch students: ${studentsError.message || 'Unknown error'}`)
        }

        console.log('Students data:', studentsData)

        // Combine the data manually
        const formattedStudents: Student[] = basicProjectsData.map((project: any) => {
          const student = studentsData.find(s => s.id === project.student_id)
          return {
            id: project.student_id,
            name: student?.name || 'Unknown',
            email: student?.email || 'Unknown',
            department: student?.department || 'Unknown',
            project_id: project.id,
            guide_id: project.guide_id,
            guide: undefined // We'll fetch guides separately if needed
          }
        }).filter(s => s.name !== 'Unknown') // Filter out any invalid entries

        console.log('Formatted students:', formattedStudents)
        setStudents(formattedStudents)

        // Fetch guide information for students who have guides assigned
        const guideIds = basicProjectsData.map(p => p.guide_id).filter(Boolean)
        if (guideIds.length > 0) {
          console.log('Guide IDs to fetch:', guideIds)
          
          const { data: guidesData, error: guidesError } = await supabase
            .from('users')
            .select('id, name, email')
            .in('id', guideIds)

          if (!guidesError && guidesData) {
            console.log('Guides data:', guidesData)
            
            // Update students with guide information
            const updatedStudents = formattedStudents.map(student => {
              const project = basicProjectsData.find(p => p.id === student.project_id)
              if (project?.guide_id) {
                const guide = guidesData.find(g => g.id === project.guide_id)
                if (guide) {
                  return {
                    ...student,
                    guide: {
                      id: guide.id,
                      name: guide.name,
                      email: guide.email
                    }
                  }
                }
              }
              return student
            })
            setStudents(updatedStudents)
          } else if (guidesError) {
            console.error('Guides fetch error:', guidesError)
            // Don't throw error here, just continue without guide info
          }
        }
      } else {
        console.log('No projects found for admin_project_id:', resolvedParams.id)
        setStudents([])
      }
    } catch (error) {
      console.error('Error fetching project and students:', error)
      console.error('Error type:', typeof error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      })
      
      // Show user-friendly error message
      if (error instanceof Error) {
        alert(`Error: ${error.message}`)
      } else {
        alert('An unexpected error occurred. Please check the console for details.')
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchGuides = async () => {
    try {
      // Get current user to filter guides by department
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      const { data: userData } = await supabase
        .from('users')
        .select('department')
        .eq('id', user.id)
        .single()

      if (!userData) return

      // Fetch all guides from the same department
      const { data: guidesData, error } = await supabase
        .from('users')
        .select('id, name, email, department')
        .eq('role', 'guide')
        .eq('department', userData.department)

      if (error) throw error
      setGuides(guidesData || [])
    } catch (error) {
      console.error('Error fetching guides:', error)
    }
  }

  const assignGuide = async (studentId: string, projectId: string, guideId: string) => {
    setSaving(studentId)
    try {
      const { error } = await supabase
        .from('projects')
        .update({ guide_id: guideId })
        .eq('id', projectId)

      if (error) throw error

      // Update local state
      setStudents(students.map(student => {
        if (student.id === studentId) {
          const selectedGuide = guides.find(g => g.id === guideId)
          return {
            ...student,
            guide_id: guideId,
            guide: selectedGuide ? {
              id: selectedGuide.id,
              name: selectedGuide.name,
              email: selectedGuide.email
            } : undefined
          }
        }
        return student
      }))

      alert('Guide assigned successfully!')
    } catch (error) {
      console.error('Error assigning guide:', error)
      alert('Failed to assign guide. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!adminProject) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Project not found</h2>
        <Link href="/dashboard/admin/admin-projects" className="text-indigo-600 hover:text-indigo-500 mt-4 inline-block">
          ← Back to Projects
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link
          href="/dashboard/admin/admin-projects"
          className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500 mb-4 font-medium"
        >
          ← Back to Projects
        </Link>
        
        <div className="border-b border-gray-200 pb-6">
          <div className="flex items-start justify-between">
            <div>
              <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
                <Link href="/dashboard/admin/admin-projects" className="hover:text-gray-700">
                  Admin Projects
                </Link>
                <span>/</span>
                <span className="text-gray-900">{adminProject.title}</span>
              </nav>
              <h1 className="text-3xl font-bold text-gray-900">{adminProject.title}</h1>
              <p className="mt-2 text-gray-600">{adminProject.description}</p>
              <div className="mt-4 flex items-center space-x-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  {adminProject.department}
                </span>
                <span className="text-sm text-gray-500">
                  {students.length} student{students.length !== 1 ? 's' : ''} assigned
                </span>
              </div>
            </div>
            <div className="flex space-x-3">
              <Link
                href={`/dashboard/admin/admin-projects/${resolvedParams.id}/groups`}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Manage Groups
              </Link>
            </div>
          </div>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 48 48">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M34 40h10v-4a6 6 0 00-10.712-3.714M34 40H14m20 0v-4a9.971 9.971 0 00-.712-3.714M14 40H4v-4a6 6 0 0110.712-3.714M14 40v-4a9.971 9.971 0 01.712-3.714M22 20a8 8 0 1116 0 8 8 0 01-16 0zm6 12a4 4 0 118 0v-1a6 6 0 00-6-6H16a6 6 0 00-6 6v1a4 4 0 118 0z" />
            </svg>
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No students assigned</h3>
          <p className="mt-1 text-sm text-gray-500">
            Students will appear here once they are assigned to this project.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Student Management</h2>
            <p className="mt-1 text-sm text-gray-500">
              Assign guides to students for this project
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Guide
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assign Guide
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students.map((student) => (
                  <tr key={`${student.id}-${student.project_id}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{student.name}</div>
                        <div className="text-sm text-gray-500">{student.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                        {student.department}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {student.guide ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">{student.guide.name}</div>
                          <div className="text-sm text-gray-500">{student.guide.email}</div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500 italic">No guide assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <select
                          value={student.guide_id || ''}
                          onChange={(e) => assignGuide(student.id, student.project_id, e.target.value)}
                          disabled={saving === student.id}
                          className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:bg-gray-50"
                        >
                          <option value="">Select a guide</option>
                          {guides.map((guide) => (
                            <option key={guide.id} value={guide.id}>
                              {guide.name}
                            </option>
                          ))}
                        </select>
                        {saving === student.id && (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}