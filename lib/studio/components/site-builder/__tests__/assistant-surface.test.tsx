import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssistantSurface } from '@/lib/studio/components/site-builder/assistant-surface'

jest.mock('@/components/chat/chat-persistence', () => ({
  ChatPersistence: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

jest.mock('ai', () => ({
  DefaultChatTransport: jest.fn().mockImplementation((options) => ({ options }))
}))

const useChatMock = jest.fn()

jest.mock('@ai-sdk/react', () => ({
  useChat: (...args: unknown[]) => useChatMock(...args)
}))

describe('AssistantSurface', () => {
  beforeEach(() => {
    useChatMock.mockReset()
    useChatMock.mockReturnValue({
      messages: [],
      input: '',
      setInput: jest.fn(),
      handleInputChange: jest.fn(),
      handleSubmit: jest.fn(),
      sendMessage: jest.fn(),
      status: 'ready',
      setMessages: jest.fn()
    })
  })

  it('shows entire site scope when no nodes are selected', () => {
    render(
      <AssistantSurface
        websiteId="site-123"
        selectedNodes={[]}
        onFocusScope={jest.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /assistant for entire site/i })).toBeInTheDocument()
  })

  it('focuses current node scope when view change is clicked', async () => {
    const onFocusScope = jest.fn()

    useChatMock.mockReturnValue({
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Updated the hero section.'
        }
      ],
      input: '',
      setInput: jest.fn(),
      handleInputChange: jest.fn(),
      handleSubmit: jest.fn(),
      sendMessage: jest.fn(),
      status: 'ready',
      setMessages: jest.fn()
    })

    render(
      <AssistantSurface
        websiteId="site-123"
        selectedNodes={[{ id: 'node-42', label: 'Homepage' }]}
        onFocusScope={onFocusScope}
      />
    )

    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /assistant for homepage/i }))

    expect(screen.getByText(/updated the hero section/i)).toBeInTheDocument()
    expect(await screen.findAllByText('Homepage')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: /view change/i }))

    expect(onFocusScope).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'node', nodeId: 'node-42', label: 'Homepage' })
    )
  })
})
