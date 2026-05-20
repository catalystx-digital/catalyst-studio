/**
 * Usage Examples for External Link Helper
 *
 * Demonstrates how to use openExternalLink and isExternalUrl
 */

import { openExternalLink, isExternalUrl } from '../open-external-link'

// Example 1: Basic Usage - Open in New Tab
export function basicExample() {
  const handleClick = () => {
    try {
      openExternalLink('https://example.com')
      if (process.env.NODE_ENV === 'development') {
      console.log('Link opened successfully')
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Failed to open link:', error)
      }
    }
  }

  // In React component:
  // <button onClick={handleClick}>Visit Example.com</button>
}

// Example 2: Open in Same Tab
export function sameTabExample() {
  const handleClick = () => {
    try {
      openExternalLink('https://example.com', '_self')
      // Page will navigate away
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Failed to navigate:', error)
      }
    }
  }
}

// Example 3: Relative URLs
export function relativeUrlExample() {
  const handleClick = () => {
    try {
      // Works with relative paths
      openExternalLink('/contact')
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Failed to navigate:', error)
      }
    }
  }
}

// Example 4: Error Handling for Invalid URLs
export function errorHandlingExample() {
  const handleUnsafeClick = (url: string) => {
    try {
      openExternalLink(url)
    } catch (error) {
      if (error instanceof Error) {
        // Show error to user
        alert(`Cannot open link: ${error.message}`)
      }
    }
  }

  // These will throw errors:
  // handleUnsafeClick('javascript:alert("XSS")')  // Invalid protocol
  // handleUnsafeClick('not-a-url')                 // Invalid format
  // handleUnsafeClick('')                          // Empty string
}

// Example 5: Check if URL is External
export function checkExternalExample() {
  const url = 'https://example.com'

  if (isExternalUrl(url)) {
    if (process.env.NODE_ENV === 'development') {
    console.log('This is an external link')
    }
    // Show warning or open in new tab
    openExternalLink(url, '_blank')
  } else {
    if (process.env.NODE_ENV === 'development') {
    console.log('This is an internal link')
    }
    // Navigate normally
    window.location.href = url
  }
}

// Example 6: Dynamic Link Handler
export function dynamicLinkHandler(url: string, isExternal?: boolean) {
  // Auto-detect if not specified
  const shouldOpenExternal = isExternal ?? isExternalUrl(url)

  try {
    if (shouldOpenExternal) {
      openExternalLink(url, '_blank')
    } else {
      openExternalLink(url, '_self')
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
    console.error('Link navigation failed:', error)
    }
  }
}

// Example 7: Popup Blocker Handling
export function popupBlockerExample() {
  const handleClick = () => {
    try {
      openExternalLink('https://example.com')
    } catch (error) {
      if (error instanceof Error && error.message.includes('Popup blocked')) {
        // Inform user to allow popups
        alert('Please allow popups to open this link')
      }
    }
  }
}

// Example 8: React Component Integration
export function reactComponentExample() {
  // In a React component:
  /*
  import { openExternalLink, isExternalUrl } from '@/lib/studio/components/cms/_core/open-external-link'

  export function ExternalLinkButton({ href, children }: { href: string; children: React.ReactNode }) {
    const external = isExternalUrl(href)

    const handleClick = () => {
      try {
        openExternalLink(href, external ? '_blank' : '_self')
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
        console.error('Failed to open link:', error)
        }
        // Show toast notification to user
      }
    }

    return (
      <button onClick={handleClick} className="text-blue-600 hover:underline">
        {children}
        {external && <span className="ml-1">↗</span>}
      </button>
    )
  }
  */
}

// Example 9: Link Validation Before Opening
export function validationExample() {
  const handleDynamicLink = (userInput: string) => {
    // Always validate user input
    if (!userInput.trim()) {
      alert('Please enter a URL')
      return
    }

    try {
      openExternalLink(userInput)
    } catch (error) {
      if (error instanceof Error) {
        // Provide helpful feedback
        if (error.message.includes('Invalid URL')) {
          alert('Please enter a valid http:// or https:// URL')
        } else if (error.message.includes('Popup blocked')) {
          alert('Please allow popups in your browser')
        } else {
          alert('Failed to open link')
        }
      }
    }
  }
}

// Example 10: Batch Link Processing
export function batchLinkExample() {
  const links = [
    'https://example.com',
    '/contact',
    'https://google.com',
    '#section',
  ]

  const externalLinks = links.filter(isExternalUrl)
  if (process.env.NODE_ENV === 'development') {
  console.log('External links:', externalLinks)
  }
  // Output: ['https://example.com', 'https://google.com']

  const internalLinks = links.filter(url => !isExternalUrl(url))
  if (process.env.NODE_ENV === 'development') {
  console.log('Internal links:', internalLinks)
  }
  // Output: ['/contact', '#section']
}
