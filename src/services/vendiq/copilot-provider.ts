import { MicrosoftCopilotStudioService } from '@/generated/services/MicrosoftCopilotStudioService';

/**
 * Name of the published Copilot Studio agent (publisher prefix + name).
 * Found in Copilot Studio → Channels → Web app → connection URL.
 */
export const VENDIQ_AGENT_NAME = 'rpvms_VendorManagement';

const NOTIFICATION_URL_PLACEHOLDER = 'https://notificationurlplaceholder';

export interface AgentInvokeResult {
  responses: string[];
  lastResponse?: string;
  conversationId?: string;
  completed: boolean;
  raw: Record<string, unknown>;
}

function pickString(data: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}

function pickArray(data: Record<string, unknown>, ...keys: string[]): string[] {
  for (const k of keys) {
    const v = data[k];
    if (Array.isArray(v)) {
      return v.filter((x): x is string => typeof x === 'string');
    }
  }
  return [];
}

/**
 * Send a message to the vendIQ Copilot Studio agent and wait for the synchronous response.
 *
 * Uses `ExecuteCopilotAsyncV2` — the only method that returns agent replies synchronously.
 * Casing of response properties varies across Copilot Studio deployments, so all access
 * goes through defensive pickers.
 */
export async function invokeAgent(
  message: string,
  opts: { agentName?: string; conversationId?: string } = {},
): Promise<AgentInvokeResult> {
  const agentName = opts.agentName ?? VENDIQ_AGENT_NAME;

  // The generated signature types the return as `void`, but the connector actually
  // returns a payload. Cast through unknown to read it safely.
  const result = (await MicrosoftCopilotStudioService.ExecuteCopilotAsyncV2(
    agentName,
    { message, notificationUrl: NOTIFICATION_URL_PLACEHOLDER },
    opts.conversationId,
  )) as unknown as { success: boolean; data?: Record<string, unknown>; error?: { message?: string } };

  if (!result.success) {
    throw new Error(result.error?.message ?? 'Copilot agent call failed');
  }

  const data = (result.data ?? {}) as Record<string, unknown>;
  const responses = pickArray(data, 'responses', 'Responses');
  const lastResponse =
    pickString(data, 'lastResponse', 'LastResponse') ??
    (responses.length > 0 ? responses[responses.length - 1] : undefined);
  const conversationId = pickString(data, 'conversationId', 'ConversationId', 'conversationID');
  const completedRaw = data.completed ?? data.Completed;
  const completed = typeof completedRaw === 'boolean' ? completedRaw : true;

  return { responses, lastResponse, conversationId, completed, raw: data };
}
