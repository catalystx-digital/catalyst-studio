'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/atom-one-dark.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, Copy, Check } from 'lucide-react';
import { ChatPersistence } from './chat-persistence';

interface BaseChatProps {
  initialMessage?: string;
  websiteId?: string;
  onInitialMessageSent?: () => void;
}

/**
 * Extract text content from a UIMessage, handling AI SDK v5 parts array format.
 */
const getMessageTextContent = (message: UIMessage): string => {
  if ('parts' in message && Array.isArray(message.parts)) {
    return message.parts
      .filter((part): part is { type: 'text'; text: string } =>
        part && typeof part === 'object' && 'type' in part && part.type === 'text' && 'text' in part
      )
      .map(part => part.text)
      .join('')
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyMsg = message as any
  if (typeof anyMsg.content === 'string') {
    return anyMsg.content
  }
  return ''
}

/**
 * Component for rendering markdown messages with syntax highlighting
 */
interface MarkdownMessageProps {
  content: string;
}

const MarkdownMessage = ({ content }: MarkdownMessageProps) => {
  const [copiedCodeBlock, setCopiedCodeBlock] = useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeBlock(code);
    setTimeout(() => setCopiedCodeBlock(null), 2000);
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        code: ({ className, children }) => {
          const language = className?.replace('language-', '');
          const codeContent = String(children).replace(/\n$/, '');
          const isInline = !className && !String(children).includes('\n');

          if (isInline) {
            return (
              <code className="bg-gray-700 rounded px-1 py-0.5 text-xs font-mono">
                {children}
              </code>
            );
          }

          const isCopied = copiedCodeBlock === codeContent;

          return (
            <div className="relative my-2 bg-gray-800 rounded overflow-hidden border border-gray-700">
              <div className="flex justify-between items-center px-3 py-2 bg-gray-900 text-xs text-gray-400 border-b border-gray-700">
                <span className="font-mono">{language || 'code'}</span>
                <button
                  onClick={() => handleCopyCode(codeContent)}
                  className="hover:text-white transition-colors flex items-center gap-1"
                  title="Copy code"
                >
                  {isCopied ? (
                    <>
                      <Check className="h-3 w-3" />
                      <span className="text-xs">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span className="text-xs">Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="overflow-x-auto px-3 py-2 text-xs font-mono">
                <code className={className}>
                  {children}
                </code>
              </pre>
            </div>
          );
        },
        a: ({ children, href, ...props }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-catalyst-orange hover:underline"
            {...props}
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <table className="border-collapse border border-gray-600 my-2 text-sm">
            {children}
          </table>
        ),
        th: ({ children }) => (
          <th className="border border-gray-600 px-3 py-2 bg-gray-800 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-gray-600 px-3 py-2">
            {children}
          </td>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-catalyst-orange pl-3 my-2 italic text-gray-300">
            {children}
          </blockquote>
        ),
        h1: ({ children }) => (
          <h1 className="text-lg font-bold mt-3 mb-2">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-bold mt-3 mb-2">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="font-bold mt-2 mb-1">{children}</h3>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside ml-2 my-2 space-y-1">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside ml-2 my-2 space-y-1">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="ml-2">{children}</li>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default function BaseChat({ initialMessage, websiteId, onInitialMessageSent }: BaseChatProps = {}) {
  // AI SDK v5: input state must be managed manually
  const [input, setInput] = useState('');

  // AI SDK v5: Memoize transport to avoid infinite re-renders
  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/chat',
    body: websiteId ? { websiteId } : undefined,
  }), [websiteId]);

  // AI SDK v5: useChat API changed significantly
  const { messages, sendMessage, setMessages, status } = useChat({
    transport,
  });

  // AI SDK v5: isLoading is derived from status
  const isLoading = status === 'streaming' || status === 'submitted';
  const hasInitialized = useRef(false);

  // Send initial message if provided
  useEffect(() => {
    if (initialMessage && !hasInitialized.current && messages.length === 0) {
      hasInitialized.current = true;
      // AI SDK v5: sendMessage takes { text: string } format
      sendMessage({ text: initialMessage });
      if (onInitialMessageSent) {
        onInitialMessageSent();
      }
    }
  }, [initialMessage, messages.length, sendMessage, onInitialMessageSent]);

  return (
    <ChatPersistence
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages={messages as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMessages={setMessages as any}
      sessionId="default"
      websiteIdOverride={websiteId}
    >
      <div className="h-full flex flex-col bg-gray-900 max-h-screen">
        {/* Header - Fixed height */}
        <div className="flex-shrink-0 px-4 py-4 border-b border-gray-700">
          <h3 className="flex items-center gap-2 text-white font-semibold">
            <Bot className="h-5 w-5 text-catalyst-orange" />
            AI Assistant
          </h3>
          <p className="text-gray-400 text-sm mt-1">
            Chat with our AI assistant
          </p>
        </div>
        
        {/* Messages - Scrollable middle section */}
        <div className="flex-1 overflow-hidden px-4 py-4">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4 min-h-0">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  Start a conversation by typing a message below
                </div>
              )}
              
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`flex gap-3 max-w-[80%] ${
                      message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {message.role === 'user' ? (
                        <div className="h-8 w-8 rounded-full bg-catalyst-orange flex items-center justify-center">
                          <User className="h-4 w-4 text-white" />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gray-800 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-catalyst-orange" />
                        </div>
                      )}
                    </div>
                    
                    <div
                      className={`rounded-lg px-3 py-2 break-words ${
                        message.role === 'user'
                          ? 'bg-catalyst-orange text-white'
                          : 'bg-gray-800 text-gray-100'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <p className="text-sm whitespace-pre-wrap break-words">{getMessageTextContent(message)}</p>
                      ) : (
                        <div className="text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <MarkdownMessage content={getMessageTextContent(message)} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex gap-3 max-w-[80%]">
                    <div className="h-8 w-8 rounded-full bg-gray-800 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-catalyst-orange" />
                    </div>
                    <div className="rounded-lg px-3 py-2 bg-gray-800">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        
        {/* Input - Fixed at bottom */}
        <div className="flex-shrink-0 px-4 pb-4 pt-2 border-t border-gray-700">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!input.trim()) return;
              sendMessage({ text: input.trim() });
              setInput('');
            }}
            className="flex gap-2"
          >
            <Input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1 bg-gray-800 border-gray-600 text-white placeholder-gray-400"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-catalyst-orange hover:bg-catalyst-orange/80 text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </ChatPersistence>
  );
}
