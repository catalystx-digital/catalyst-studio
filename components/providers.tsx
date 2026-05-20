'use client'

import React from 'react'
import { ProjectContextProvider } from '@/lib/context/project-context'
import { PreviewProvider } from '@/lib/context/preview-context'
import { ContentTypeProvider } from '@/lib/context/content-type-context'
import { WebsiteContextProvider } from '@/lib/context/website-context'
import { ProviderContextProvider } from '@/lib/cms-export/context'

interface ProvidersProps {
  children: React.ReactNode
  initialWebsiteId?: string | null
}

export function Providers({ children, initialWebsiteId }: ProvidersProps) {
  // Get provider ID from environment or use 'auto' for automatic detection
  const providerId = 'auto'

  return (
    <ProviderContextProvider providerId={providerId}>
      <ProjectContextProvider>
        <WebsiteContextProvider websiteId={initialWebsiteId ?? null}>
          <ContentTypeProvider>
            <PreviewProvider>
              {children}
            </PreviewProvider>
          </ContentTypeProvider>
        </WebsiteContextProvider>
      </ProjectContextProvider>
    </ProviderContextProvider>
  )
}
