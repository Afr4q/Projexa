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
  }
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
      // Fetch admin project details
      const { data: projectData, error: projectError } = await supabase
        .from('admin_projects')
        .select('*')
        .eq('id', resolvedParams.id)
        .single()

      if (projectError) throw projectError
      setAdminProject(projectData)

      // Fetch students assigned to this project with their current guide info
      const { data: studentsData, error: studentsError } = await supabase
        .from('projects')
        .select(`
          id,
          student_id,
          guide_id,
          users!student_id (
            id,
            name,
            email,
            department
          ),
          guides:users!guide_id (
            id,
            name,
            email
          )
        `)
        .eq('admin_project_id', resolvedParams.id)

      if (studentsError) throw studentsError

      const formattedStudents: Student[] = studentsData.map((project: any) => ({
        id: project.student_id,
        name: project.users.name,
        email: project.users.email,
        department: project.users.department,
        project_id: project.id,
        guide_id: project.guide_id,
        guide: project.guides ? {
          id: project.guides.id,
          name: project.guides.name,
          email: project.guides.email
        } : undefined
      }))

      setStudents(formattedStudents)
    } catch (error) {
      console.error('Error fetching project and students:', error)
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
                  <tr key={student.id} className="hover:bg-gray-50">
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