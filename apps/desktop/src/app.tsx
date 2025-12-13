import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AgentClient } from '@agent/api-client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<AgentClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const client = new AgentClient({
      baseUrl: 'http://localhost:3000',
      onError: (err) => {
        console.error('Agent client error:', err);
        setError(err.message);
      },
    });
    clientRef.current = client;

    client.checkHealth().then((healthy) => {
      setIsConnected(healthy);
      if (!healthy) {
        setError('Cannot connect to agent server. Run: pnpm server');
      }
    });

    return () => {
      client.endSession().catch(() => {});
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || isLoading || !clientRef.current) return;

    setInput('');
    setError(null);

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await clientRef.current.sendMessage(content);

      const assistantMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: response.text,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  const canSend = input.trim().length > 0 && !isLoading && isConnected;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-center gap-2 py-3 px-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <h1 className="text-lg font-semibold">AI Agent</h1>
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      </header>

      {/* Error Banner */}
      {error && (
        <div className="mx-4 mt-2 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <h2 className="text-xl font-semibold text-gray-500 dark:text-gray-400 mb-2">
              Start a conversation
            </h2>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Send a message to begin chatting with the AI agent
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-[85%] ${msg.role === 'user' ? 'self-end' : 'self-start'}`}
              >
                <div
                  className={`px-4 py-2.5 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-primary text-white rounded-br-sm'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'
                  }`}
                >
                  <p className="text-base leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
                <p className={`text-xs text-gray-400 mt-1 ${msg.role === 'user' ? 'text-right mr-1' : 'ml-1'}`}>
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 py-2 text-gray-500">
                <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                <span className="text-sm">Agent is thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-end gap-2">
          <div className="flex-1 flex items-end bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2 border border-gray-200 dark:border-gray-700">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                adjustTextareaHeight();
              }}
              onKeyDown={handleKeyDown}
              placeholder={isConnected ? 'Ask me anything...' : 'Connecting...'}
              disabled={!isConnected || isLoading}
              rows={1}
              className="flex-1 bg-transparent border-none outline-none resize-none text-base text-gray-900 dark:text-white placeholder-gray-400 max-h-[120px]"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-semibold transition-opacity ${
              canSend ? 'bg-primary hover:opacity-90' : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
            }`}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
