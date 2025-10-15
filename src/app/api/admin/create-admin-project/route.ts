import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: Request) {
  try {
    const { title, description, department, year, semester, max_students } = await req.json()

    console.log('Creating admin project:', { title, description, department, year, semester, max_students })

    // Get and verify auth token
    const authToken = req.headers.get('authorization')?.split(' ')[1]
    if (!authToken) {
      return NextResponse.json({ message: 'No authorization token provided' }, { status: 401 })
    }

    // Verify that the admin has permission for this department
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authToken)
    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('users')
      .select('department')
      .eq('id', user.id)
      .single()

    if (adminError || !adminData?.department || adminData.department !== department) {
      return NextResponse.json(
        { message: 'Admin can only create projects for their own department' },
        { status: 403 }
      )
    }

    // Create admin project (trigger will automatically create individual projects)
    const { data: adminProject, error: adminProjectError } = await supabaseAdmin
      .from('admin_projects')
      .insert({
        title,
        description,
        department,
        year,
        semester,
        created_by: user.id,
        max_students: max_students || 1,
        status: 'active'
      })
      .select()
      .single()

    if (adminProjectError) {
      console.error('Error creating admin project:', adminProjectError)
      return NextResponse.json(
        { message: adminProjectError.message },
        { status: 400 }
      )
    }

    // Get count of students that will be assigned (for response message)
    const { data: students, error: studentsError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', 'student')
      .eq('department', department)
      .eq('year', year)
      .eq('semester', semester)

    const studentCount = students?.length || 0

    return NextResponse.json({ 
      message: `Admin project created successfully! Individual projects will be automatically assigned to ${studentCount} students.`,
      adminProject,
      assignedStudents: studentCount
    })
  } catch (error) {
    console.error('Error in create-admin-project route:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}