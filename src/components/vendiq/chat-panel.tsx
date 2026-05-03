import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Send, MessageSquarePlus, Sparkles, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useVendiq } from '@/services/vendiq/provider-context';
import { useCopilotChat } from '@/providers/copilot-chat-provider';
import { MessageBubble, TypingIndicator } from '@/components/vendiq/chat-bubbles';

const FALLBACK_SUGGESTIONS = [
  'Which contracts are expiring in the next 90 days?',
  'Show me my highest-spend vendors this year',
  'Which vendors have PHI and no SIG assessment?',
  'Summarize risk for the top 5 critical vendors',
];

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ChatPanel({ open, onClose }: ChatPanelProps) {
  const { messages, sendMessage, newChat, isLoading, agentName } = useCopilotChat();
  const provider = useVendiq();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const suggestionsQuery = useQuery({
    queryKey: ['vendiq', 'promptSuggestions', 'active'],
    queryFn: () => provider.promptSuggestions.listActive(),
    staleTime: 5 * 60_000,
  });
  const suggestions =
    suggestionsQuery.data && suggestionsQuery.data.length > 0
      ? suggestionsQuery.data.map((s) => s.promptText)
      : FALLBACK_SUGGESTIONS;

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

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleEsc(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  const empty = messages.length === 0 && !isLoading;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/20 transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <aside
        className={cn(
          'fixed right-0 top-12 bottom-0 z-50 flex w-[500px] max-w-[90vw] flex-col border-l bg-background shadow-2xl transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        aria-label="vendIQ chat panel"
        role="complementary"
      >
        {/* Panel header */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            <span className="text-sm font-semibold">Ask vendIQ</span>
            <span className="text-[10px] text-muted-foreground">{agentName}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={newChat}
              disabled={messages.length === 0 || isLoading}
              title="New chat"
              className="h-8 w-8"
            >
              <MessageSquarePlus className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              title="Close panel"
              className="h-8 w-8"
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4" role="log" aria-label="Chat transcript">
          {empty ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-sm font-semibold">How can vendIQ help?</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ask about vendors, contracts, spend, or risk.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendMessage(s)}
                    className="rounded-lg border bg-card px-3 py-2 text-left text-xs shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
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

        {/* Input */}
        <div className="border-t bg-card/50 p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about vendors, contracts, spend, or risk…"
              rows={1}
              className="min-h-[40px] max-h-32 flex-1 resize-none text-sm"
              disabled={isLoading}
            />
            <Button onClick={handleSend} disabled={!input.trim() || isLoading} size="sm" className="gap-1.5">
              <Send className="h-3.5 w-3.5" aria-hidden />
              Send
            </Button>
          </div>
          <p className="mt-1 px-1 text-[10px] text-muted-foreground">
            Enter to send · Shift+Enter for newline
          </p>
        </div>
      </aside>
    </>
  );
}
