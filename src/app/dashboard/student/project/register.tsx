'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/app/supabaseClient'

interface PreviousTopic {
  id: string
  title: string
}

interface FormData {
  title: string
  description: string
  department: string
}

interface UserData {
  department: string
}

interface Guide {
  id: string
}

export default function RegisterProject() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [similarTopics, setSimilarTopics] = useState<PreviousTopic[]>([])
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    department: ''
  })

  const checkTopicSimilarity = async () => {
    try {
      if (!formData.title || formData.title.length < 3) {
        setSimilarTopics([])
        return
      }

      const { data, error } = await supabase
        .from('previous_topics')
        .select('*')
        .textSearch('title', formData.title, {
          type: 'websearch',
          config: 'english'
        })
        .limit(5)

      if (error) {
        console.error('Error checking topic similarity:', error)
        return
      }
      
      setSimilarTopics(data || [])
    } catch (error) {
      console.error('Error checking topic similarity:', error)
      setSimilarTopics([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      // Get department and find a guide
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('department')
        .eq('id', user.id)
        .single()

      if (userError || !userData) {
        throw new Error('Failed to get user department')
      }

      // Find an available guide in the same department
      const { data: guide, error: guideError } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'guide')
        .eq('department', userData.department)
        .order('random()')
        .limit(1)
        .single()

      if (guideError || !guide) {
        throw new Error('No guide available in your department')
      }

      // Create project
      const { error: projectError } = await supabase
        .from('projects')
        .insert({
          title: formData.title,
          description: formData.description,
          student_id: user.id,
          guide_id: guide.id,
          department: userData.department,
          status: 'active'
        })

      if (projectError) throw projectError

      // Redirect to dashboard
      router.push('/dashboard/student')
    } catch (error) {
      console.error('Error registering project:', error)
      alert(error instanceof Error ? error.message : 'Failed to register project')
    } finally {
      setLoading(false)
    }
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setFormData({ ...formData, title: newTitle })
    
    // Debounce the similarity check
    if (newTitle.length > 3) {
      const timeoutId = setTimeout(() => {
        checkTopicSimilarity()
      }, 500)
      
      // Clear previous timeout
      return () => clearTimeout(timeoutId)
    } else {
      setSimilarTopics([])
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Register New Project</h1>
          <p className="mt-2 text-gray-600">
            Create your project proposal and get matched with a guide from your department.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={handleTitleChange}
                placeholder="Enter a descriptive title for your project"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2"
                required
                minLength={5}
                maxLength={200}
              />
              <p className="mt-1 text-xs text-gray-500">
                Minimum 5 characters. Be specific and descriptive.
              </p>
              {similarTopics.length > 0 && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm font-medium text-yellow-800">⚠️ Similar topics found:</p>
                  <ul className="mt-2 text-sm text-yellow-700">
                    {similarTopics.map((topic) => (
                      <li key={topic.id} className="ml-4 list-disc">
                        {topic.title}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-yellow-600">
                    Please ensure your project topic is unique and not a duplicate.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your project objectives, methodology, and expected outcomes..."
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2"
                rows={6}
                required
                minLength={50}
                maxLength={1000}
              />
              <p className="mt-1 text-xs text-gray-500">
                Minimum 50 characters. Include objectives, methodology, and expected outcomes.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">What happens next?</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Your project will be automatically assigned to a guide from your department</li>
                      <li>You'll receive notification once a guide accepts your project</li>
                      <li>You can then start working on your project phases</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || formData.title.length < 5 || formData.description.length < 50}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                  ${loading || formData.title.length < 5 || formData.description.length < 50
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                  }`}
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Registering Project...
                  </div>
                ) : (
                  'Register Project'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}