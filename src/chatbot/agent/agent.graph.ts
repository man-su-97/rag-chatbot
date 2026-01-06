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
When a user asks you to interact with their dashboard (e.g., "show my analytics", "open settings", "add a widget"), use the dashboard tool with the appropriate action and parameters.

After using the dashboard tool, acknowledge the action naturally:
- "I've opened your analytics dashboard."
- "The settings panel is now displayed."
- "I've added the sales widget to your dashboard."

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
  // Future validation logic can be added here.
  return {};
}
