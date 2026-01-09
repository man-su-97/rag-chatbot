import {
  BaseMessage,
  AIMessageChunk,
  HumanMessage,
} from '@langchain/core/messages';
import { ProviderConfig } from '../types';
import { Annotation } from '@langchain/langgraph';

export const SYSTEM_PROMPT = `You are an AI assistant embedded in a web application with access to dashboard controls.

CAPABILITIES:
- Answer questions naturally in conversational language
- Execute dashboard actions using the 'dashboard' tool when requested
- Search the web using the 'web-search' tool for current information

DASHBOARD TOOL USAGE:
When a user asks you to interact with their dashboard, you MUST use the dashboard tool.
- If the user explicitly asks to list all available analytics (e.g., "show all analytics", "what analytics do you have?", "list analytics"), you MUST use the dashboard tool with 
action: 'list_analytics',
. This action is for showing the *types* of analytics that can be used to create widgets, and the frontend will handle displaying them. DO NOT confuse this with listing existing widgets.
- If the user asks to list or manage existing widgets on the dashboard (e.g., "list my widgets", "add a widget", "show dashboard items"), use the dashboard tool with 
action: 'list_widgets'
, 
action: 'add_widget'
, etc.

After using the dashboard tool, acknowledge the action naturally:
- If you used 
action: 'list_analytics',
 respond with: "I've listed all the analytics. You can now choose an ID for widget creation." DO NOT state that you cannot list analytics.
- Otherwise, for other dashboard actions, acknowledge naturally, for example:
  - "I've added the sales widget to your dashboard."
  - "The settings panel is now displayed."

IMPORTANT:
- Use tools when appropriate, but respond naturally in conversation
- Don't explain that you're using tools unless asked
- If a request is ambiguous, ask for clarification before using tools
- For general questions, answer directly without using tools

You are helpful, concise, and action-oriented.`;

export const ChatState = Annotation.Root({
  sessionId: Annotation<string>(),
  sessionStartedAt: Annotation<string>(),
  metadataIp: Annotation<string | undefined>(),
  metadataDevice: Annotation<string | undefined>(),
  providerConfig: Annotation<ProviderConfig>(),
  input: Annotation<string>(),

  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),

  streamingChunks: Annotation<AIMessageChunk[]>({
    reducer: (prev, next) => next ?? prev,
    default: () => [],
  }),
});

export function addHumanMessageNode(state: typeof ChatState.State) {
  if (state.input) {
    return { messages: [new HumanMessage(state.input)] };
  }
  return {};
}

export type MemoryLoadFn = (sessionId: string) => Promise<BaseMessage[]>;
export type MemorySaveFn = (
  sessionId: string,
  messages: BaseMessage[],
) => Promise<void>;

export function createLoadMemoryNode(loadFn: MemoryLoadFn) {
  return async function loadMemoryNode(state: typeof ChatState.State) {
    try {
      const persisted = (await loadFn(state.sessionId)) ?? [];
      console.log(
        `[Memory] Loaded ${persisted.length} messages for session ${state.sessionId}`,
      );

      if (persisted.length === 0) {
        return {};
      }

      return {
        messages: persisted.slice(),
      };
    } catch (error) {
      console.error('[Memory] Error in loadMemoryNode:', error);
      return {};
    }
  };
}

export function createSaveMemoryNode(saveFn: MemorySaveFn) {
  return async function saveMemoryNode(state: typeof ChatState.State) {
    try {
      await saveFn(state.sessionId, state.messages);
      console.log(
        `[Memory] Saved ${state.messages.length} messages for session ${state.sessionId}`,
      );
      return {};
    } catch (error) {
      console.error('[Memory] Error in saveMemoryNode:', error);
      return {};
    }
  };
}

export function validateInputNode(_: typeof ChatState.State) {
  return {};
}
