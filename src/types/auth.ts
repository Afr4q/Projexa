interface UserRole {
  role: 'admin' | 'student' | 'guide'
}

interface AuthError {
  message: string
}

export type { UserRole, AuthError }