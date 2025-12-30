import { BaseMessage } from '@langchain/core/messages';
import { ProviderConfig } from '../types';
import { Annotation } from '@langchain/langgraph';

export const SYSTEM_PROMPT = `You are an AI assistant embedded in a web application.

Your job has TWO MODES:

MODE 1: GENERAL CHAT
- Answer normally in plain text.

MODE 2: DASHBOARD COMMAND
- Output ONLY valid JSON matching the command schema.

Never mix text and JSON.
Never explain the JSON.
`;

export const ChatState = Annotation.Root({
  sessionId: Annotation<string>(),
  sessionStartedAt: Annotation<string>(),
  metadataIp: Annotation<string | undefined>(),
  metadataDevice: Annotation<string | undefined>(),
  providerConfig: Annotation<ProviderConfig>(),

  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),
});

export type MemoryLoadFn = (sessionId: string) => Promise<BaseMessage[]>;
export type MemorySaveFn = (
  sessionId: string,
  messages: BaseMessage[],
) => Promise<void>;

export function createLoadMemoryNode(loadFn: MemoryLoadFn) {
  return async function loadMemoryNode(state: typeof ChatState.State) {
    const persisted = (await loadFn(state.sessionId)) ?? [];
    // The 'incoming' message (initial user message) is already in the state
    // and will be handled by the reducer. We only need to return the persisted history.
    return {
      messages: persisted,
    };
  };
}

export function createSaveMemoryNode(saveFn: MemorySaveFn) {
  return async function saveMemoryNode(state: typeof ChatState.State) {
    await saveFn(state.sessionId, state.messages);
    return {};
  };
}

export function validateInputNode(_: typeof ChatState.State) {
  return {};
}
