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
        setError('Cannot connect to agent server. Make sure the server is running.');
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

  return (
    <div className="app">
      <header className="header">
        <h1>AI Agent</h1>
        <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
      </header>

      <div className="chat-container">
        {error && <div className="error-banner">{error}</div>}

        <div className="messages">
          {messages.length === 0 ? (
            <div className="empty-state">
              <h2>Start a conversation</h2>
              <p>Send a message to begin chatting with the AI agent</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.role}`}>
                <div>{msg.content}</div>
                <div className="message-time">{formatTime(msg.timestamp)}</div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="loading">
              <span>Agent is thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <div className="input-wrapper">
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
            />
          </div>
          <button
            className="send-button"
            onClick={handleSend}
            disabled={!input.trim() || !isConnected || isLoading}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
