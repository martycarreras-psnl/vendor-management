import { MicrosoftCopilotStudioService } from '@/generated/services/MicrosoftCopilotStudioService';
import type { CurrentRecord } from '@/providers/current-record-provider';

/**
 * Name of the published Copilot Studio agent (publisher prefix + name).
 * Found in Copilot Studio → Channels → Web app → connection URL.
 */
export const VENDIQ_AGENT_NAME = 'rpvms_VendorManagement';

const NOTIFICATION_URL_PLACEHOLDER = 'https://notificationurlplaceholder';

/**
 * Record-aware payload contract sent to the Copilot Studio agent.
 *
 * When the user is viewing a record page (vendor / supplier / contract / review),
 * the body of `ExecuteCopilotAsyncV2` includes — in addition to `message` and
 * `notificationUrl` — the following fields:
 *
 *   - `recordContext`     : structured { type, id, displayName?, summary?, routePath? }
 *   - `recordContextText` : one-line human-readable breadcrumb, e.g.
 *                           "User is viewing vendor \"Contoso Logistics\" (id: abc-123)."
 *
 * Agent author contract (Copilot Studio side, outside this repo):
 *   Map inbound activity payload → global variables for use in topics /
 *   generative answers grounding:
 *     - Global.RecordType        ← recordContext.type
 *     - Global.RecordId          ← recordContext.id
 *     - Global.RecordDisplayName ← recordContext.displayName
 *     - Global.RecordSummary     ← recordContext.summary (object)
 *     - Global.RecordRoutePath   ← recordContext.routePath
 *
 * When the user is NOT on a record page, neither field is present and the body
 * shape matches the original `{ message, notificationUrl }` contract.
 */
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

/** Build the one-line plain-text breadcrumb used as a generative-answers fallback. */
function formatRecordContextText(rc: CurrentRecord): string {
  const label = rc.displayName ? `"${rc.displayName}"` : `id ${rc.id}`;
  const summary = rc.summary && Object.keys(rc.summary).length > 0
    ? ` Summary: ${Object.entries(rc.summary)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')}.`
    : '';
  return `User is viewing ${rc.type} ${label} (id: ${rc.id}).${summary}`;
}

/**
 * Send a message to the vendIQ Copilot Studio agent and wait for the synchronous response.
 *
 * Uses `ExecuteCopilotAsyncV2` — the only method that returns agent replies synchronously.
 * Casing of response properties varies across Copilot Studio deployments, so all access
 * goes through defensive pickers.
 *
 * When `opts.recordContext` is provided, the current-record payload is attached to the
 * body so the agent can ground its answer on the record the user is viewing.
 */
export async function invokeAgent(
  message: string,
  opts: { agentName?: string; conversationId?: string; recordContext?: CurrentRecord } = {},
): Promise<AgentInvokeResult> {
  const agentName = opts.agentName ?? VENDIQ_AGENT_NAME;

  const body: Record<string, unknown> = {
    message,
    notificationUrl: NOTIFICATION_URL_PLACEHOLDER,
  };
  if (opts.recordContext) {
    body.recordContext = opts.recordContext;
    body.recordContextText = formatRecordContextText(opts.recordContext);
  }

  // The generated signature types the return as `void`, but the connector actually
  // returns a payload. Cast through unknown to read it safely.
  const result = (await MicrosoftCopilotStudioService.ExecuteCopilotAsyncV2(
    agentName,
    body,
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
