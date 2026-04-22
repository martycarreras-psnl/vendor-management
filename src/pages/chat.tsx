import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Send, Trash2, Sparkles, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useCopilotAgent, type ChatMessage } from '@/hooks/vendiq/use-copilot-agent';

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
          'max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm',
          isUser
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm border bg-card text-card-foreground',
        )}
      >
        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
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
  const { messages, sendMessage, clearChat, isLoading, agentName } = useCopilotAgent();
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
          onClick={clearChat}
          disabled={messages.length === 0 || isLoading}
          className="gap-2"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          Clear
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
