import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const requestData = await req.json()
    const { email, name, role, department, specialization, year, semester, password } = requestData
    
    console.log('Received user data:', requestData) // Debug log

    // Verify that the admin has permission for this department
    const adminAuthData = await supabaseAdmin.auth.getUser(req.headers.get('authorization')?.split(' ')[1] || '')
    if (!adminAuthData.data?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('users')
      .select('department')
      .eq('id', adminAuthData.data.user.id)
      .single()

    if (adminError || !adminData?.department || adminData.department !== department) {
      return NextResponse.json(
        { message: 'Admin can only create users for their own department' },
        { status: 403 }
      )
    }

    // First create auth user with admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role,
        department,
        specialization,
        year,
        semester
      }
    });

    if (authError) {
      return NextResponse.json(
        { message: authError.message },
        { status: 400 }
      );
    }

    // Then add to users table
    const userData: any = {
      id: authData.user.id,
      email,
      name,
      role,
      department
    }

    // Add optional fields based on role
    if (specialization) {
      userData.specialization = specialization
    }
    if (role === 'student' && year !== undefined) {
      userData.year = year
    }
    if (role === 'student' && semester !== undefined) {
      userData.semester = semester
    }

    console.log('Inserting user data into database:', userData) // Debug log

    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert(userData);

    if (dbError) {
      // Attempt to clean up the auth user if database insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { message: dbError.message },
        { status: 400 }
      );
    }

    // User is created with password, no need for invitation email

    return NextResponse.json({ 
      message: 'User created successfully',
      user: authData.user 
    });
  } catch (error) {
    console.error('Error in create-user route:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}