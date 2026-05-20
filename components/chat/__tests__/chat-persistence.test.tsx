import React from 'react'
import { render } from '@testing-library/react'
import { ChatPersistence } from '@/components/chat/chat-persistence'

const forwardedProps: any[] = []

jest.mock('@/components/chat/chat-with-persistence', () => ({
  ChatWithPersistence: (props: any) => {
    forwardedProps.push(props)
    return <>{props.children}</>
  }
}))

describe('ChatPersistence', () => {
  beforeEach(() => {
    forwardedProps.length = 0
  })

  it('forwards websiteIdOverride to ChatWithPersistence', () => {
    render(
      <ChatPersistence messages={[]} websiteIdOverride="site-abc">
        <div data-testid="child">child</div>
      </ChatPersistence>
    )

    expect(forwardedProps[0]).toEqual(
      expect.objectContaining({ websiteIdOverride: 'site-abc' })
    )
  })
})
