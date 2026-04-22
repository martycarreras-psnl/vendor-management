import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Send, MessageSquarePlus, Sparkles, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useCopilotChat, type ChatMessage } from '@/providers/copilot-chat-provider';

const SUGGESTIONS = [
  'Which contracts are expiring in the next 90 days?',
  'Show me my highest-spend vendors this year',
  'Which vendors have PHI and no SIG assessment?',
  'Summarize risk for the top 5 critical vendors',
];

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-sidebar text-sidebar-foreground',
        )}
        aria-hidden
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          'rounded-2xl px-4 py-2 text-sm shadow-sm',
          isUser
            ? 'max-w-[75%] rounded-br-sm bg-primary text-primary-foreground'
            : 'max-w-[90%] rounded-bl-sm border bg-card text-card-foreground',
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
        ) : (
          <div
            className={cn(
              'break-words text-sm leading-relaxed',
              // Prose-like styling without tailwind-typography plugin
              '[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
              '[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5',
              '[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5',
              '[&_li]:my-0.5',
              '[&_strong]:font-semibold',
              '[&_em]:italic',
              '[&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:text-base [&_h1]:font-semibold',
              '[&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-sm [&_h2]:font-semibold',
              '[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold',
              '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_code]:font-mono',
              '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2',
              '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
              '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:opacity-80',
              '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground',
              '[&_hr]:my-3 [&_hr]:border-border',
              '[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs',
              '[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold',
              '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_td]:align-top',
            )}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ node: _n, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        )}
        <div
          className={cn(
            'mt-1 text-[10px] opacity-60',
            isUser ? 'text-right' : 'text-left',
          )}
        >
          {formatTime(msg.timestamp)}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar text-sidebar-foreground"
        aria-hidden
      >
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border bg-card px-4 py-3 shadow-sm">
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/70" />
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { messages, sendMessage, newChat, isLoading, agentName } = useCopilotChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    sendMessage(trimmed);
    setInput('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const empty = messages.length === 0 && !isLoading;

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col gap-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden />
            Ask vendIQ
          </h1>
          <p className="text-sm text-muted-foreground">
            Conversational assistant powered by Microsoft Copilot Studio ·{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{agentName}</code>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={newChat}
          disabled={messages.length === 0 || isLoading}
          className="gap-2"
          title="Start a new conversation"
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden />
          New chat
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-background shadow-sm">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4" role="log" aria-label="Chat transcript">
          {empty ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <h2 className="text-base font-semibold">How can vendIQ help?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ask questions about vendors, contracts, spend, or risk.
                </p>
              </div>
              <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendMessage(s)}
                    className="rounded-lg border bg-card px-3 py-2 text-left text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <MessageBubble key={m.id} msg={m} />
              ))}
              {isLoading ? <TypingIndicator /> : null}
            </>
          )}
        </div>

        <div className="border-t bg-card/50 p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about vendors, contracts, spend, or risk…"
              rows={1}
              className="min-h-[40px] max-h-40 flex-1 resize-none"
              disabled={isLoading}
            />
            <Button onClick={handleSend} disabled={!input.trim() || isLoading} className="gap-2">
              <Send className="h-4 w-4" aria-hidden />
              Send
            </Button>
          </div>
          <p className="mt-1 px-1 text-[11px] text-muted-foreground">
            Enter to send · Shift+Enter for newline
          </p>
        </div>
      </div>
    </div>
  );
}
