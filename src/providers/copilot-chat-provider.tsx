import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useMutation } from '@tanstack/react-query';
import { invokeAgent, VENDIQ_AGENT_NAME } from '@/services/vendiq/copilot-provider';

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  /** True for intermediate chain-of-thought / interim responses (not the final answer). */
  isInterim?: boolean;
}

interface CopilotChatContextValue {
  messages: ChatMessage[];
  conversationId: string | undefined;
  isLoading: boolean;
  error: unknown;
  agentName: string;
  sendMessage: (message: string) => void;
  newChat: () => void;
}

const CopilotChatContext = createContext<CopilotChatContextValue | undefined>(undefined);

const STORAGE_KEY = 'vendiq.chat.v1';

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface PersistedState {
  messages: Array<Omit<ChatMessage, 'timestamp'> & { timestamp: string }>;
  conversationId?: string;
}

function loadPersisted(): { messages: ChatMessage[]; conversationId?: string } {
  if (typeof window === 'undefined') return { messages: [] };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { messages: [] };
    const parsed = JSON.parse(raw) as PersistedState;
    return {
      messages: (parsed.messages ?? []).map((m) => ({ ...m, timestamp: new Date(m.timestamp) })),
      conversationId: parsed.conversationId,
    };
  } catch {
    return { messages: [] };
  }
}

function savePersisted(messages: ChatMessage[], conversationId?: string) {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedState = {
      messages: messages.map((m) => ({ ...m, timestamp: m.timestamp.toISOString() })),
      conversationId,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export function CopilotChatProvider({
  children,
  agentName = VENDIQ_AGENT_NAME,
}: {
  children: ReactNode;
  agentName?: string;
}) {
  const initial = useRef(loadPersisted());
  const [messages, setMessages] = useState<ChatMessage[]>(initial.current.messages);
  const [conversationId, setConversationId] = useState<string | undefined>(initial.current.conversationId);

  // Keep conversationId accessible inside mutation without re-creating it on every change
  const conversationIdRef = useRef(conversationId);
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    savePersisted(messages, conversationId);
  }, [messages, conversationId]);

  // Drip-feed state: keeps isLoading true while interim messages are being revealed
  const [isDripping, setIsDripping] = useState(false);
  const dripTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Clean up drip timers on unmount
  useEffect(() => {
    return () => { dripTimers.current.forEach(clearTimeout); };
  }, []);

  const mutation = useMutation({
    mutationFn: async (message: string) => {
      return invokeAgent(message, { agentName, conversationId: conversationIdRef.current });
    },
    onSuccess: (result) => {
      if (result.conversationId && result.conversationId !== conversationIdRef.current) {
        setConversationId(result.conversationId);
      }
      const replies =
        result.responses.length > 0
          ? result.responses
          : result.lastResponse
          ? [result.lastResponse]
          : [];
      if (replies.length === 0) {
        setMessages((prev) => [
          ...prev,
          { id: makeId(), role: 'agent', content: '(No response from the agent.)', timestamp: new Date() },
        ]);
        return;
      }

      // Single response → show immediately
      if (replies.length === 1) {
        setMessages((prev) => [
          ...prev,
          { id: makeId(), role: 'agent', content: replies[0], timestamp: new Date() },
        ]);
        return;
      }

      // Multiple responses → drip-feed with staggered delays
      // Clear any previous drip timers
      dripTimers.current.forEach(clearTimeout);
      dripTimers.current = [];
      setIsDripping(true);

      const INTERIM_DELAY = 600; // ms between each interim step
      const FINAL_DELAY = 400;   // ms after last interim before final answer

      replies.forEach((content, i) => {
        const isLast = i === replies.length - 1;
        const delay = isLast
          ? (replies.length - 1) * INTERIM_DELAY + FINAL_DELAY
          : i * INTERIM_DELAY;

        const timer = setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: makeId(),
              role: 'agent' as const,
              content,
              timestamp: new Date(),
              isInterim: !isLast,
            },
          ]);
          if (isLast) {
            setIsDripping(false);
          }
        }, delay);
        dripTimers.current.push(timer);
      });
    },
    onError: (err) => {
      setIsDripping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: 'agent',
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: new Date(),
        },
      ]);
    },
  });

  const sendMessage = useCallback(
    (raw: string) => {
      const message = raw.trim();
      if (!message || mutation.isPending) return;
      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: 'user', content: message, timestamp: new Date() },
      ]);
      mutation.mutate(message);
    },
    [mutation],
  );

  const newChat = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const value = useMemo<CopilotChatContextValue>(
    () => ({
      messages,
      conversationId,
      isLoading: mutation.isPending || isDripping,
      error: mutation.error,
      agentName,
      sendMessage,
      newChat,
    }),
    [messages, conversationId, mutation.isPending, isDripping, mutation.error, agentName, sendMessage, newChat],
  );

  return <CopilotChatContext.Provider value={value}>{children}</CopilotChatContext.Provider>;
}

export function useCopilotChat(): CopilotChatContextValue {
  const ctx = useContext(CopilotChatContext);
  if (!ctx) {
    throw new Error('useCopilotChat must be used within a CopilotChatProvider');
  }
  return ctx;
}
