import { createClient } from '@supabase/supabase-js'

interface RubricValidationResult {
  isValid: boolean
  missingRubrics: string[]
  foundRubrics: string[]
  extractedText: string
  reason?: string
}

export class RubricValidationService {
  private supabase: ReturnType<typeof createClient>

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      // Use pdfreader which is designed for Node.js
      const { PdfReader } = await import('pdfreader')
      
      return new Promise((resolve, reject) => {
        let text = ''
        
        new PdfReader().parseBuffer(buffer, (err: any, item: any) => {
          if (err) {
            reject(err)
            return
          }
          
          if (!item) {
            // End of parsing - clean up the extracted text
            let cleanedText = text.trim()
            
            // Basic text cleanup
            cleanedText = cleanedText.replace(/\s+/g, ' ')
            cleanedText = cleanedText.toLowerCase() // Convert to lowercase for comparison
            
            resolve(cleanedText)
            return
          }
          
          if (item.text) {
            text += item.text + ' '
          }
        })
      })
    } catch (error) {
      console.error('Error extracting text from PDF:', error)
      throw new Error('Failed to extract text from PDF')
    }
  }

  async getRubricsForPhase(phaseId: string): Promise<{ name: string; description: string | null }[]> {
    try {
      const { data, error } = await this.supabase
        .from('rubrics')
        .select('name, description')
        .eq('phase_id', phaseId)

      if (error) {
        console.error('Error fetching rubrics:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getRubricsForPhase:', error)
      throw error
    }
  }

  validateRubricPresence(extractedText: string, rubrics: { name: string; description: string | null }[]): {
    foundRubrics: string[]
    missingRubrics: string[]
  } {
    const foundRubrics: string[] = []
    const missingRubrics: string[] = []

    // Convert extracted text to lowercase for case-insensitive matching
    const textLower = extractedText.toLowerCase()

    rubrics.forEach(rubric => {
      const rubricNameLower = rubric.name.toLowerCase()
      
      // Check if rubric name exists in the text
      // We'll use multiple matching strategies for better accuracy
      const isFound = this.isRubricFoundInText(textLower, rubricNameLower)

      if (isFound) {
        foundRubrics.push(rubric.name)
      } else {
        missingRubrics.push(rubric.name)
      }
    })

    return { foundRubrics, missingRubrics }
  }

  private isRubricFoundInText(text: string, rubricName: string): boolean {
    // Strategy 1: Exact match
    if (text.includes(rubricName)) {
      return true
    }

    // Strategy 2: Word boundary match (for partial words)
    const words = rubricName.split(/\s+/)
    const allWordsFound = words.every(word => {
      // Remove common words that might not be meaningful
      if (word.length <= 2 || ['the', 'and', 'or', 'of', 'in', 'to', 'for', 'with'].includes(word)) {
        return true
      }
      return text.includes(word)
    })

    if (allWordsFound && words.length > 1) {
      return true
    }

    // Strategy 3: Fuzzy matching for single significant words (length > 4)
    if (words.length === 1 && rubricName.length > 4) {
      // Check if the rubric name appears with small variations
      const regex = new RegExp(rubricName.replace(/./g, (char, i) => 
        i === 0 ? char : `${char}?`
      ), 'i')
      return regex.test(text)
    }

    return false
  }

  async validateSubmission(pdfBuffer: Buffer, phaseId: string): Promise<RubricValidationResult> {
    try {
      console.log('Starting rubric validation for phase:', phaseId)

      // Extract text from PDF
      const extractedText = await this.extractTextFromPDF(pdfBuffer)
      console.log('Extracted text length:', extractedText.length)
      console.log('Text preview:', extractedText.substring(0, 200))

      // Get rubrics for this phase
      const rubrics = await this.getRubricsForPhase(phaseId)
      console.log('Rubrics for phase:', rubrics.map(r => r.name))

      if (rubrics.length === 0) {
        console.log('No rubrics defined for this phase, accepting submission')
        return {
          isValid: true,
          missingRubrics: [],
          foundRubrics: [],
          extractedText,
          reason: 'No rubrics defined for this phase'
        }
      }

      // Validate rubric presence
      const { foundRubrics, missingRubrics } = this.validateRubricPresence(extractedText, rubrics)
      
      console.log('Found rubrics:', foundRubrics)
      console.log('Missing rubrics:', missingRubrics)

      // Determine if submission is valid
      const isValid = missingRubrics.length === 0

      return {
        isValid,
        missingRubrics,
        foundRubrics,
        extractedText,
        reason: isValid 
          ? 'All required rubrics found in submission'
          : `Missing required sections: ${missingRubrics.join(', ')}`
      }

    } catch (error) {
      console.error('Error in rubric validation:', error)
      throw error
    }
  }
}

export const rubricValidationService = new RubricValidationService()