/**
 * Usage Examples for SafeHtml Component
 *
 * Demonstrates how to use SafeHtml in various scenarios
 */

import React from 'react'
import { SafeHtml } from '../safe-html'

export function BasicUsageExample() {
  const userContent = '<p>User submitted <strong>content</strong> with <em>formatting</em></p>'

  return (
    <div className="space-y-4">
      <h2>Basic Usage</h2>
      <SafeHtml html={userContent} />
    </div>
  )
}

export function CustomTagExample() {
  const content = '<b>This will be in a span container</b>'

  return (
    <div>
      <SafeHtml html={content} tag="span" className="inline-block" />
    </div>
  )
}

export function XssProtectionExample() {
  // Malicious content - will be sanitized
  const maliciousContent = `
    <p>Safe content</p>
    <script>alert('XSS Attack')</script>
    <img src="x" onerror="alert('XSS')" />
    <a href="javascript:alert('XSS')">Dangerous Link</a>
  `

  return (
    <div>
      <h2>XSS Protection (script tags removed)</h2>
      <SafeHtml html={maliciousContent} className="p-4 border rounded" />
    </div>
  )
}

export function RichContentExample() {
  const richContent = `
    <h1>Article Title</h1>
    <p>This is a paragraph with <a href="/page">a link</a>.</p>
    <ul>
      <li>List item 1</li>
      <li>List item 2</li>
    </ul>
    <blockquote>A famous quote</blockquote>
    <img src="/image.jpg" alt="Description" />
  `

  return (
    <div>
      <h2>Rich Content</h2>
      <SafeHtml html={richContent} tag="article" className="prose" />
    </div>
  )
}

export function DynamicContentExample() {
  const [content, setContent] = React.useState('<p>Initial content</p>')

  return (
    <div className="space-y-4">
      <h2>Dynamic Content (re-sanitizes on change)</h2>
      <SafeHtml html={content} />

      <button onClick={() => setContent('<p>Updated <strong>content</strong></p>')}>
        Update Content
      </button>
    </div>
  )
}

export function ErrorHandlingExample() {
  return (
    <div className="space-y-4">
      <h2>Error Handling</h2>

      <div>
        <h3>Empty String</h3>
        <SafeHtml html="" />
      </div>

      <div>
        <h3>Plain Text (No HTML)</h3>
        <SafeHtml html="Just plain text without any tags" />
      </div>

      <div>
        <h3>Malformed HTML (Auto-corrected)</h3>
        <SafeHtml html="<p>Unclosed paragraph <strong>Bold" />
      </div>
    </div>
  )
}
