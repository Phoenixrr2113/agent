'use client';

import { useState } from 'react';
import { useAgentChat, type ChatMessage } from '@/hooks/use-agent-chat';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
  MessageToolbar,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit,
  PromptInputAttachments,
  PromptInputAttachment,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionAddAttachments,
} from '@/components/ai-elements/prompt-input';
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from '@/components/ai-elements/reasoning';
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { Loader } from '@/components/ai-elements/loader';
import { Suggestions, Suggestion } from '@/components/ai-elements/suggestion';
import { Button } from '@/components/ui/button';
import {
  BotIcon,
  PlusIcon,
  TrashIcon,
  CopyIcon,
  RefreshCcwIcon,
  CheckIcon,
} from 'lucide-react';
import type { ToolUIPart } from 'ai';

const SUGGESTIONS = [
  'Search the web for the latest AI news',
  'What files are in my current directory?',
  'Help me write a function to parse JSON',
  'Explain how async/await works in JavaScript',
];

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <MessageAction onClick={handleCopy} tooltip={copied ? 'Copied!' : 'Copy'}>
      {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
    </MessageAction>
  );
}

function AssistantMessage({
  message,
  isLast,
  onRegenerate,
  isLoading,
}: {
  message: ChatMessage;
  isLast: boolean;
  onRegenerate: () => void;
  isLoading: boolean;
}) {
  return (
    <Message from="assistant">
      <MessageContent>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-4 space-y-2">
            {message.toolCalls.map((toolCall) => (
              <Tool key={toolCall.id} defaultOpen={false}>
                <ToolHeader
                  title={toolCall.name}
                  type="tool-invocation"
                  state={
                    toolCall.status === 'completed'
                      ? 'output-available'
                      : toolCall.status === 'error'
                        ? 'output-error'
                        : 'input-available'
                  }
                />
                <ToolContent>
                  <ToolInput input={toolCall.input as ToolUIPart['input']} />
                  {toolCall.output !== undefined && toolCall.output !== null ? (
                    <ToolOutput
                      output={toolCall.output as ToolUIPart['output']}
                      errorText={undefined}
                    />
                  ) : null}
                </ToolContent>
              </Tool>
            ))}
          </div>
        )}
        <MessageResponse>{message.content}</MessageResponse>
      </MessageContent>
      {isLast && !isLoading && (
        <MessageToolbar>
          <MessageActions>
            <CopyButton content={message.content} />
            <MessageAction onClick={onRegenerate} tooltip="Regenerate">
              <RefreshCcwIcon className="size-3" />
            </MessageAction>
          </MessageActions>
        </MessageToolbar>
      )}
    </Message>
  );
}

export default function Home() {
  const {
    session,
    messages,
    isLoading,
    error,
    agentState,
    initSession,
    send,
    regenerate,
    clear,
    endSession,
  } = useAgentChat();

  const handleSubmit = async ({ text }: { text: string }) => {
    await send(text);
  };

  const handleSuggestionClick = (suggestion: string) => {
    send(suggestion);
  };

  const getChatStatus = () => {
    if (!isLoading) return 'ready' as const;
    if (agentState.status === 'thinking') return 'submitted' as const;
    return 'streaming' as const;
  };

  const lastAssistantIndex = messages
    .map((m) => m.role)
    .lastIndexOf('assistant');

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <BotIcon className="size-6" />
          <h1 className="text-lg font-semibold">Agent Testing UI</h1>
        </div>
        <div className="flex items-center gap-2">
          {session && (
            <>
              <span className="text-sm text-muted-foreground">
                Session: {session.sessionId.slice(0, 8)}...
              </span>
              <Button variant="outline" size="sm" onClick={clear}>
                <TrashIcon className="mr-2 size-4" />
                Clear
              </Button>
              <Button variant="outline" size="sm" onClick={endSession}>
                End Session
              </Button>
            </>
          )}
          {!session && (
            <Button onClick={initSession}>
              <PlusIcon className="mr-2 size-4" />
              New Session
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex flex-1 flex-col">
          <Conversation className="flex-1">
            <ConversationContent className="mx-auto max-w-3xl">
              {messages.length === 0 && !isLoading ? (
                <ConversationEmptyState
                  title="Start a conversation"
                  description="Send a message to begin testing the agent"
                  icon={<BotIcon className="size-8" />}
                >
                  <div className="mt-6 flex flex-col items-center gap-4">
                    <BotIcon className="size-8 text-muted-foreground" />
                    <div className="space-y-1 text-center">
                      <h3 className="font-medium text-sm">Start a conversation</h3>
                      <p className="text-muted-foreground text-sm">
                        Try one of these suggestions or type your own message
                      </p>
                    </div>
                    <Suggestions className="mt-2">
                      {SUGGESTIONS.map((suggestion) => (
                        <Suggestion
                          key={suggestion}
                          suggestion={suggestion}
                          onClick={handleSuggestionClick}
                        />
                      ))}
                    </Suggestions>
                  </div>
                </ConversationEmptyState>
              ) : (
                <>
                  {messages.map((message, index) => (
                    message.role === 'user' ? (
                      <Message key={message.id} from="user">
                        <MessageContent>
                          <p>{message.content}</p>
                        </MessageContent>
                      </Message>
                    ) : (
                      <AssistantMessage
                        key={message.id}
                        message={message}
                        isLast={index === lastAssistantIndex}
                        onRegenerate={regenerate}
                        isLoading={isLoading}
                      />
                    )
                  ))}

                  {isLoading && (
                    <Message from="assistant">
                      <MessageContent>
                        {agentState.thought && (
                          <Reasoning isStreaming={agentState.status === 'thinking'}>
                            <ReasoningTrigger />
                            <ReasoningContent>{agentState.thought}</ReasoningContent>
                          </Reasoning>
                        )}

                        {agentState.toolCalls.map((toolCall) => (
                          <Tool key={toolCall.id}>
                            <ToolHeader
                              title={toolCall.name}
                              type="tool-invocation"
                              state={
                                toolCall.status === 'completed'
                                  ? 'output-available'
                                  : toolCall.status === 'error'
                                    ? 'output-error'
                                    : toolCall.status === 'running'
                                      ? 'input-available'
                                      : 'input-streaming'
                              }
                            />
                            <ToolContent>
                              <ToolInput input={toolCall.input as ToolUIPart['input']} />
                              {toolCall.output !== undefined && toolCall.output !== null ? (
                                <ToolOutput
                                  output={toolCall.output as ToolUIPart['output']}
                                  errorText={undefined}
                                />
                              ) : null}
                            </ToolContent>
                          </Tool>
                        ))}

                        {agentState.status === 'thinking' && agentState.toolCalls.length === 0 && !agentState.thought && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader size={16} />
                            <Shimmer>Thinking...</Shimmer>
                          </div>
                        )}

                        {agentState.status === 'responding' && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader size={16} />
                            <Shimmer>Generating response...</Shimmer>
                          </div>
                        )}
                      </MessageContent>
                    </Message>
                  )}
                </>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {error && (
            <div className="border-t border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="border-t p-4">
            <PromptInput
              onSubmit={handleSubmit}
              className="mx-auto max-w-3xl"
              accept="image/*,.pdf,.txt,.md,.json"
              multiple
            >
              <PromptInputAttachments>
                {(attachment) => (
                  <PromptInputAttachment data={attachment} />
                )}
              </PromptInputAttachments>
              <PromptInputTextarea
                placeholder="Send a message to the agent..."
                disabled={isLoading}
              />
              <PromptInputFooter>
                <PromptInputTools>
                  <PromptInputActionMenu>
                    <PromptInputActionMenuTrigger />
                    <PromptInputActionMenuContent>
                      <PromptInputActionAddAttachments />
                    </PromptInputActionMenuContent>
                  </PromptInputActionMenu>
                  {isLoading && (
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader size={14} />
                      Step {agentState.currentStep} • {agentState.status}
                    </span>
                  )}
                </PromptInputTools>
                <PromptInputSubmit status={getChatStatus()} disabled={isLoading} />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </main>

        {session && agentState.toolCalls.length > 0 && (
          <aside className="w-80 border-l overflow-y-auto hidden lg:block">
            <div className="p-4">
              <h2 className="mb-4 font-semibold">Tool Execution</h2>
              <div className="space-y-3">
                {agentState.toolCalls.map((toolCall) => (
                  <div
                    key={toolCall.id}
                    className="rounded-lg border p-3 text-sm"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium">{toolCall.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          toolCall.status === 'completed'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : toolCall.status === 'error'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                        }`}
                      >
                        {toolCall.status}
                      </span>
                    </div>
                    {toolCall.endTime && toolCall.startTime && (
                      <div className="text-xs text-muted-foreground">
                        Duration: {toolCall.endTime - toolCall.startTime}ms
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
