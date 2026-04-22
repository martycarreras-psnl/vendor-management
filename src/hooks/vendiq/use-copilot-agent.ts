import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { invokeAgent, VENDIQ_AGENT_NAME } from '@/services/vendiq/copilot-provider';

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useCopilotAgent(agentName: string = VENDIQ_AGENT_NAME) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();

  const mutation = useMutation({
    mutationFn: async (message: string) => {
      return invokeAgent(message, { agentName, conversationId });
    },
    onSuccess: (result) => {
      if (result.conversationId && result.conversationId !== conversationId) {
        setConversationId(result.conversationId);
      }
      const replies = result.responses.length > 0 ? result.responses : result.lastResponse ? [result.lastResponse] : [];
      if (replies.length === 0) {
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: 'agent',
            content: '(No response from the agent.)',
            timestamp: new Date(),
          },
        ]);
        return;
      }
      const now = new Date();
      setMessages((prev) => [
        ...prev,
        ...replies.map((content) => ({
          id: makeId(),
          role: 'agent' as const,
          content,
          timestamp: now,
        })),
      ]);
    },
    onError: (err) => {
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

  const clearChat = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
  }, []);

  return {
    messages,
    sendMessage,
    clearChat,
    isLoading: mutation.isPending,
    error: mutation.error,
    conversationId,
    agentName,
  };
}
