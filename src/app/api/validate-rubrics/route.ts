import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rubricValidationService } from '@/lib/rubricValidationService'

export async function POST(request: NextRequest) {
  try {
    // Use direct Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No authorization token' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    
    // Verify the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Parse the form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const phaseId = formData.get('phaseId') as string

    if (!file || !phaseId) {
      return NextResponse.json({ 
        error: 'Missing required fields: file or phaseId' 
      }, { status: 400 })
    }

    console.log('Starting rubric validation for phase:', phaseId)

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const pdfBuffer = Buffer.from(arrayBuffer)

    // Validate submission against rubrics
    const validationResult = await rubricValidationService.validateSubmission(
      pdfBuffer, 
      phaseId
    )

    return NextResponse.json({
      isValid: validationResult.isValid,
      foundRubrics: validationResult.foundRubrics,
      missingRubrics: validationResult.missingRubrics,
      reason: validationResult.reason,
      message: validationResult.isValid 
        ? 'All required sections found. Submission can proceed to guide review.'
        : `Submission automatically rejected. Missing required sections: ${validationResult.missingRubrics.join(', ')}`
    })

  } catch (error) {
    console.error('Error in rubric validation API:', error)
    return NextResponse.json({ 
      error: 'Internal server error during rubric validation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}