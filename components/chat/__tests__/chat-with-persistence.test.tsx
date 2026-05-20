import React from 'react';
import { render } from '@testing-library/react';
import { ChatWithPersistence } from '@/components/chat/chat-with-persistence';
import type { UseChatTranscriptResult } from '@/hooks/use-chat-transcript';

const transcriptState: UseChatTranscriptResult = {
  key: 'test',
  status: 'loading',
  hydrated: false,
  error: null,
  messages: [],
  context: null,
  hasContext: false,
  revision: null,
  append: jest.fn(),
  refresh: jest.fn(),
  syncContext: jest.fn(),
};

const persistenceMockReturn = {
  isLoading: false,
  isSaving: false,
  lastSaved: null,
  saveCount: 0,
  storageStrategy: 'test-storage',
  storageUsage: null,
  error: null,
  saveMessages: jest.fn(),
  saveMessagesImmediate: jest.fn(),
  loadMessages: jest.fn(),
  clearMessages: jest.fn(),
  exportMessages: jest.fn(),
  importMessages: jest.fn(),
  contextData: null,
};

jest.mock('@/hooks/use-chat-transcript', () => ({
  useChatTranscript: jest.fn(() => transcriptState),
}));

jest.mock('@/hooks/use-chat-persistence', () => ({
  useChatPersistence: jest.fn(() => persistenceMockReturn),
}));

jest.mock('@/lib/hooks/use-website-id', () => ({
  useWebsiteId: jest.fn(() => 'site-mock'),
}));

jest.mock('@/lib/auth/hooks', () => ({
  useUser: jest.fn(() => ({ id: 'user-1' })),
}));

describe('ChatWithPersistence', () => {
  beforeEach(() => {
    Object.assign(transcriptState, {
      status: 'loading',
      hydrated: false,
      messages: [],
      hasContext: false,
      revision: null,
    });
  });

  it('keeps children mounted after first hydration even if hydrated toggles false', () => {
    const { rerender, getByTestId, queryByTestId } = render(
      <ChatWithPersistence messages={[]} sessionId="session">
        <div data-testid="chat-body">Chat Body</div>
      </ChatWithPersistence>,
    );

    expect(getByTestId('chat-transcript-loading')).toBeInTheDocument();
    expect(queryByTestId('chat-body')).toBeNull();

    transcriptState.hydrated = true;
    transcriptState.status = 'success';
    rerender(
      <ChatWithPersistence messages={[]} sessionId="session">
        <div data-testid="chat-body">Chat Body</div>
      </ChatWithPersistence>,
    );

    expect(queryByTestId('chat-transcript-loading')).toBeNull();
    expect(getByTestId('chat-body')).toBeInTheDocument();

    transcriptState.hydrated = false;
    transcriptState.status = 'loading';
    rerender(
      <ChatWithPersistence messages={[]} sessionId="session">
        <div data-testid="chat-body">Chat Body</div>
      </ChatWithPersistence>,
    );

    expect(getByTestId('chat-body')).toBeInTheDocument();
    expect(queryByTestId('chat-transcript-loading')).toBeNull();
    expect(getByTestId('chat-sync-indicator')).toBeInTheDocument();

    transcriptState.hydrated = true;
    transcriptState.status = 'success';
    rerender(
      <ChatWithPersistence messages={[]} sessionId="session">
        <div data-testid="chat-body">Chat Body</div>
      </ChatWithPersistence>,
    );

    expect(queryByTestId('chat-sync-indicator')).toBeNull();
  });
});
