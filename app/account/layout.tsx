import { ReactNode } from 'react'

// Force dynamic rendering to avoid SSG issues with hooks
export const dynamic = 'force-dynamic'

export default function AccountLayout({ children }: { children: ReactNode }) {
  return children
}
