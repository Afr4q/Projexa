'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/app/supabaseClient'

interface Phase {
  id: string
  name: string
  description: string
  deadline: string
  max_marks: number
  late_penalty_per_day: number
  department: string
  project_id: string | null
  created_at: string
  created_by: string
  project?: {
    id: string
    title: string
  }
}

interface AdminProject {
  id: string
  title: string
  description: string
  department: string
  year: number
  semester: number
}

interface Rubric {
  id: string
  phase_id: string
  name: string
  description: string
  created_at: string
}

interface FormData {
  name: string
  description: string
  deadline: string
  maxMarks: string
  latePenaltyPerDay: string
  projectId: string
}

interface RubricFormData {
  name: string
  description: string
}

interface EditingRubric {
  id: string
  name: string
  description: string
}

export default function ManagePhases() {
  const [loading, setLoading] = useState(true)
  const [phases, setPhases] = useState<Phase[]>([])
  const [adminProjects, setAdminProjects] = useState<AdminProject[]>([])
  const [rubrics, setRubrics] = useState<{ [phaseId: string]: Rubric[] }>({})
  const [adminDepartment, setAdminDepartment] = useState<string | null>(null)
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null)
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all')
  const [showRubricForm, setShowRubricForm] = useState(false)
  const [editingRubric, setEditingRubric] = useState<EditingRubric | null>(null)
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    deadline: '',
    maxMarks: '',
    latePenaltyPerDay: '',
    projectId: ''
  })
  const [rubricFormData, setRubricFormData] = useState<RubricFormData>({
    name: '',
    description: ''
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
      
      // Fetch admin projects for this department
      await fetchAdminProjects(data.department)
      
      // Fetch phases with project information
      await fetchPhases(data.department)
      
    } catch (error) {
      console.error('Error fetching admin info:', error)
      alert('Error: Could not fetch admin department information')
    } finally {
      setLoading(false)
    }
  }

  const fetchAdminProjects = async (department: string) => {
    try {
      const { data, error } = await supabase
        .from('admin_projects')
        .select('id, title, description, department, year, semester')
        .eq('department', department)
        .eq('status', 'active')
        .order('title', { ascending: true })

      if (error) throw error
      setAdminProjects(data || [])
    } catch (error) {
      console.error('Error fetching admin projects:', error)
    }
  }

  const fetchPhases = async (department: string) => {
    try {
      const { data: phasesData, error: phasesError } = await supabase
        .from('phases')
        .select(`
          *,
          project:admin_projects(id, title)
        `)
        .eq('department', department)
        .order('created_at', { ascending: false })

      if (phasesError) throw phasesError
      setPhases(phasesData || [])

      // Fetch rubrics for all phases
      if (phasesData) {
        await fetchRubricsForPhases(phasesData.map(p => p.id))
      }
    } catch (error) {
      console.error('Error fetching phases:', error)
    }
  }

  const fetchRubricsForPhases = async (phaseIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('rubrics')
        .select('*')
        .in('phase_id', phaseIds)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Group rubrics by phase_id
      const rubricsByPhase = data?.reduce((acc: { [key: string]: Rubric[] }, rubric) => {
        if (!acc[rubric.phase_id]) {
          acc[rubric.phase_id] = []
        }
        acc[rubric.phase_id].push(rubric)
        return acc
      }, {})

      setRubrics(rubricsByPhase || {})
    } catch (error) {
      console.error('Error fetching rubrics:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!adminDepartment) {
      alert('Error: No department found for admin')
      return
    }

    try {
      setLoading(true)

      // Validate form data
      if (!formData.name.trim()) {
        throw new Error('Phase name is required')
      }
      if (!formData.description.trim()) {
        throw new Error('Description is required')
      }
      if (!formData.deadline) {
        throw new Error('Deadline is required')
      }
      if (!formData.maxMarks || isNaN(parseInt(formData.maxMarks)) || parseInt(formData.maxMarks) <= 0) {
        throw new Error('Maximum marks must be a positive number')
      }
      if (!formData.latePenaltyPerDay || isNaN(parseFloat(formData.latePenaltyPerDay)) || parseFloat(formData.latePenaltyPerDay) < 0) {
        throw new Error('Late penalty must be a non-negative number')
      }
      if (!formData.projectId) {
        throw new Error('Please select a project for this phase')
      }

      // Get current user for created_by field
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      const maxMarks = parseInt(formData.maxMarks)
      const latePenalty = parseFloat(formData.latePenaltyPerDay)

      const { data, error } = await supabase
        .from('phases')
        .insert({
          name: formData.name.trim(),
          description: formData.description.trim(),
          deadline: formData.deadline,
          max_marks: maxMarks,
          late_penalty_per_day: latePenalty,
          department: adminDepartment,
          project_id: formData.projectId,
          created_by: user.id
        })
        .select()
        .single()

      if (error) throw error

      // Clear form
      setFormData({
        name: '',
        description: '',
        deadline: '',
        maxMarks: '',
        latePenaltyPerDay: '',
        projectId: ''
      })

      // Refresh phases list
      await fetchPhases(adminDepartment)
      
      alert('Phase created successfully!')
    } catch (error: any) {
      console.error('Error creating phase:', error)
      const errorMessage = error.message || error.error_description || 'Unknown error occurred'
      alert(`Error creating phase: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAddRubric = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedPhase) {
      alert('Please select a phase first')
      return
    }

    try {
      setLoading(true)

      // Validate rubric form data
      if (!rubricFormData.name.trim()) {
        throw new Error('Rubric name is required')
      }
      if (!rubricFormData.description.trim()) {
        throw new Error('Description is required')
      }

      const { error } = await supabase
        .from('rubrics')
        .insert({
          phase_id: selectedPhase,
          name: rubricFormData.name.trim(),
          description: rubricFormData.description.trim()
        })

      if (error) throw error

      // Clear form
      setRubricFormData({
        name: '',
        description: ''
      })

      // Refresh rubrics
      await fetchRubricsForPhases([selectedPhase])
      setShowRubricForm(false)
      alert('Rubric added successfully!')
    } catch (error: any) {
      console.error('Error creating rubric:', error)
      const errorMessage = error.message || error.error_description || 'Unknown error occurred'
      alert(`Error creating rubric: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const handleEditRubric = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingRubric) {
      alert('No rubric selected for editing')
      return
    }

    try {
      setLoading(true)

      // Validate rubric form data
      if (!rubricFormData.name.trim()) {
        throw new Error('Rubric name is required')
      }
      if (!rubricFormData.description.trim()) {
        throw new Error('Description is required')
      }

      const { error } = await supabase
        .from('rubrics')
        .update({
          name: rubricFormData.name.trim(),
          description: rubricFormData.description.trim()
        })
        .eq('id', editingRubric.id)

      if (error) throw error

      // Clear form and close modal
      setRubricFormData({
        name: '',
        description: ''
      })
      setEditingRubric(null)

      // Refresh rubrics for the phase
      const phaseId = Object.keys(rubrics).find(phaseId => 
        rubrics[phaseId].some(r => r.id === editingRubric.id)
      )
      if (phaseId) {
        await fetchRubricsForPhases([phaseId])
      }
      
      alert('Rubric updated successfully!')
    } catch (error: any) {
      console.error('Error updating rubric:', error)
      const errorMessage = error.message || error.error_description || 'Unknown error occurred'
      alert(`Error updating rubric: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const openEditRubric = (rubric: Rubric) => {
    setEditingRubric({
      id: rubric.id,
      name: rubric.name,
      description: rubric.description
    })
    setRubricFormData({
      name: rubric.name,
      description: rubric.description
    })
  }

  const closeRubricModal = () => {
    setShowRubricForm(false)
    setEditingRubric(null)
    setSelectedPhase(null)
    setRubricFormData({ name: '', description: '' })
  }

  // Filter phases based on selected project
  const filteredPhases = phases.filter(phase => {
    if (selectedProjectFilter === 'all') return true
    if (selectedProjectFilter === 'no-project') return !phase.project_id
    return phase.project_id === selectedProjectFilter
  })

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Manage Phases</h1>

      {/* Display admin's department */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg shadow-md border border-indigo-200 p-4 mb-6">
        <label className="block text-sm font-medium text-indigo-700 mb-1">Your Department</label>
        <div className="text-lg font-semibold text-indigo-900 bg-white px-3 py-2 rounded-md border border-indigo-200">
          {adminDepartment || 'Loading...'}
        </div>
      </div>

      {/* Add Phase Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-6 text-gray-800">Add New Phase</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Project Selection - Full Width */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Project <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                required
              >
                <option value="">-- Select a project --</option>
                {adminProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title} (Year {project.year}, Semester {project.semester})
                  </option>
                ))}
              </select>
            </div>

            {/* Phase Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phase Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Phase 1, Project Proposal"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-400"
                required
              />
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deadline <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                required
              />
            </div>

            {/* Maximum Marks */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Marks <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={formData.maxMarks}
                onChange={(e) => setFormData({ ...formData, maxMarks: e.target.value })}
                placeholder="e.g., 100"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-400"
                required
              />
            </div>

            {/* Late Penalty per Day */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Late Penalty per Day <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={formData.latePenaltyPerDay}
                onChange={(e) => setFormData({ ...formData, latePenaltyPerDay: e.target.value })}
                placeholder="e.g., 2.5"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-400"
                required
              />
              <p className="mt-1 text-xs text-gray-500">Marks deducted per day after deadline</p>
            </div>

            {/* Description - Full Width */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the phase requirements, deliverables, and evaluation criteria..."
                rows={4}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-400 resize-vertical"
                required
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {loading ? 'Creating...' : 'Create Phase'}
            </button>
          </div>
        </form>
      </div>

      {/* Project Filter */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">Filter Phases by Project</label>
        <select
          value={selectedProjectFilter}
          onChange={(e) => setSelectedProjectFilter(e.target.value)}
          className="w-full md:w-80 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
        >
          <option value="all">📋 All Phases</option>
          {adminProjects.map((project) => (
            <option key={project.id} value={project.id}>
              📁 {project.title} (Year {project.year}, Semester {project.semester})
            </option>
          ))}
        </select>
      </div>

      {/* Phases List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Phases Overview</h3>
          <p className="text-sm text-gray-600 mt-1">
            {filteredPhases.length} phase{filteredPhases.length !== 1 ? 's' : ''} found
          </p>
        </div>
        
        {filteredPhases.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No phases found</h3>
            <p className="text-gray-500">
              {selectedProjectFilter === 'all' 
                ? 'Create your first phase using the form above.'
                : 'No phases found for the selected filter. Try selecting a different project.'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phase Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deadline
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Max Marks
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Late Penalty/Day
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPhases.map((phase) => (
                  <React.Fragment key={phase.id}>
                    <tr className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {phase.project ? (
                          <div className="text-sm">
                            <div className="font-medium text-gray-900 flex items-center">
                              <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                              {phase.project.title}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center text-gray-400 italic text-sm">
                            <span className="w-2 h-2 bg-gray-300 rounded-full mr-2"></span>
                            No project assigned
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{phase.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(phase.deadline).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(phase.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {phase.max_marks} pts
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          -{phase.late_penalty_per_day} pts/day
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedPhase(phase.id)
                            setShowRubricForm(true)
                          }}
                          className="text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 px-3 py-1 rounded-md transition-colors duration-150"
                        >
                          Add Rubric
                        </button>
                      </td>
                    </tr>
                    {/* Show rubrics for this phase */}
                    {rubrics[phase.id]?.map((rubric) => (
                      <tr key={rubric.id} className="bg-gray-50">
                        <td colSpan={6} className="px-10 py-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                                  Rubric
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900">{rubric.name}</div>
                                <p className="text-sm text-gray-600 mt-1">{rubric.description}</p>
                              </div>
                            </div>
                            <div className="flex-shrink-0 ml-4">
                              <button
                                onClick={() => openEditRubric(rubric)}
                                className="text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 px-2 py-1 rounded-md text-sm transition-colors duration-150"
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Rubric Modal */}
      {(showRubricForm || editingRubric) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md mx-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingRubric ? 'Edit Rubric' : 'Add New Rubric'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {editingRubric ? 'Update the evaluation criteria' : 'Add evaluation criteria for this phase'}
              </p>
            </div>
            
            <form onSubmit={editingRubric ? handleEditRubric : handleAddRubric} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rubric Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={rubricFormData.name}
                  onChange={(e) => setRubricFormData({ ...rubricFormData, name: e.target.value })}
                  placeholder="e.g., Code Quality, Documentation"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-400"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rubricFormData.description}
                  onChange={(e) => setRubricFormData({ ...rubricFormData, description: e.target.value })}
                  placeholder="Describe what will be evaluated in this rubric..."
                  rows={4}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-400 resize-vertical"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeRubricModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {loading ? (editingRubric ? 'Updating...' : 'Adding...') : (editingRubric ? 'Update Rubric' : 'Add Rubric')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}