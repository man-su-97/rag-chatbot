import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { createModel } from '../models/model.factory';
import { ProviderConfig, ChatMessage } from '../types';

export const ChatState = Annotation.Root({
  sessionId: Annotation<string>(),
  sessionStartedAt: Annotation<string>(),
  metadataIp: Annotation<string | undefined>(),
  metadataDevice: Annotation<string | undefined>(),

  providerConfig: Annotation<ProviderConfig>(),

  messages: Annotation<Array<ChatMessage>>(),
  lastResponse: Annotation<string | undefined>(),
});

export type MemoryLoadFn = (sessionId: string) => Promise<ChatMessage[]>;
export type MemorySaveFn = (
  sessionId: string,
  messages: ChatMessage[],
) => Promise<void>;

export function createLoadMemoryNode(loadFn: MemoryLoadFn) {
  return async function loadMemoryNode(state: typeof ChatState.State) {
    const sessionId = state.sessionId;

    const persisted = (await loadFn(sessionId)) ?? [];
    const incoming = state.messages ?? [];

    return {
      messages: [...persisted, ...incoming],
    };
  };
}

export function createSaveMemoryNode(saveFn: MemorySaveFn) {
  return async function saveMemoryNode(state: typeof ChatState.State) {
    await saveFn(state.sessionId, state.messages);
    return {};
  };
}

export async function llmNode(state: typeof ChatState.State) {
  const messages = state.messages;
  if (!messages?.length) throw new Error('No messages found.');

  const llm = createModel(state.providerConfig);

  const result = await llm.invoke(
    messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  );

  const reply = result.content ?? '';

  return {
    messages: [
      ...messages,
      {
        role: 'assistant',
        content: reply,
        createdAt: new Date().toISOString(),
      },
    ],
    lastResponse: reply,
  };
}

export function validateInputNode(state: typeof ChatState.State) {
  if (!state.messages?.length) throw new Error('No messages found.');

  const last = state.messages[state.messages.length - 1];

  if (last.role !== 'user')
    throw new Error('Last message must come from a user.');
  if (!last.content?.trim()) throw new Error('User message is empty.');
  if (last.content.length > 5000) throw new Error('Message too long.');

  if (!state.providerConfig?.apiKey) throw new Error('API key missing.');
  if (!state.providerConfig?.model) throw new Error('Model missing.');
  if (!state.sessionId) throw new Error('Session ID missing.');

  return {};
}

export function buildChatGraph(
  loadMemory: MemoryLoadFn,
  saveMemory: MemorySaveFn,
) {
  return new StateGraph(ChatState)
    .addNode('validateInputNode', validateInputNode)
    .addNode('loadMemoryNode', createLoadMemoryNode(loadMemory))
    .addNode('llmNode', llmNode)
    .addNode('saveMemoryNode', createSaveMemoryNode(saveMemory))
    .addEdge(START, 'validateInputNode')
    .addEdge('validateInputNode', 'loadMemoryNode')
    .addEdge('loadMemoryNode', 'llmNode')
    .addEdge('llmNode', 'saveMemoryNode')
    .addEdge('saveMemoryNode', END)
    .compile();
}
