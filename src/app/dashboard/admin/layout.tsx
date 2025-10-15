import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin Dashboard - Projexa',
  description: 'Project Management System Admin Dashboard',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex flex-col">
        {/* Main Content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}