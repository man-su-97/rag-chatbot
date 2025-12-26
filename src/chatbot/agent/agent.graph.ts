import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { createModel } from '../models/model.factory';
import { ProviderConfig, ChatMessage } from '../types';

export const ChatState = Annotation.Root({
  sessionId: Annotation<string>(),
  sessionStartedAt: Annotation<string>(),
  metadataIp: Annotation<string | undefined>(),
  metadataDevice: Annotation<string | undefined>(),

  providerConfig: Annotation<ProviderConfig>(),

  messages: Annotation<Array<ChatMessage>>(),
});

export type MemoryLoadFn = (sessionId: string) => Promise<ChatMessage[]>;

export type MemorySaveFn = (
  sessionId: string,
  messages: ChatMessage[],
) => Promise<void>;

export function createLoadMemoryNode(loadFn: MemoryLoadFn) {
  return async function loadMemoryNode(state: typeof ChatState.State) {
    const persisted = (await loadFn(state.sessionId)) ?? [];
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

export function validateInputNode(state: typeof ChatState.State) {
  if (!state.messages?.length) {
    throw new Error('No messages found.');
  }

  const last = state.messages[state.messages.length - 1];

  if (last.role !== 'user') {
    throw new Error('Last message must be from user.');
  }

  if (!last.content?.trim()) {
    throw new Error('Empty user message.');
  }

  if (last.content.length > 5000) {
    throw new Error('Message too long.');
  }

  if (!state.providerConfig?.apiKey) {
    throw new Error('API key missing.');
  }

  if (!state.providerConfig?.model) {
    throw new Error('Model missing.');
  }

  return {};
}

export async function llmNode(
  state: typeof ChatState.State,
  tools: DynamicStructuredTool[],
) {
  const llm = createModel(state.providerConfig, tools);

  const response = await llm.invoke(
    state.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  );

  return {
    messages: [
      ...state.messages,
      {
        role: 'assistant',
        content: response.content ?? '',
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

function shouldContinue(state: typeof ChatState.State) {
  const last = state.messages[state.messages.length - 1] as any;

  if (last?.tool_calls?.length) {
    return 'tools';
  }

  return END;
}

export function buildChatGraph(
  loadMemory: MemoryLoadFn,
  saveMemory: MemorySaveFn,
  tools: DynamicStructuredTool[],
) {
  const toolNode = new ToolNode(tools);

  return new StateGraph(ChatState)
    .addNode('validate', validateInputNode)
    .addNode('loadMemory', createLoadMemoryNode(loadMemory))
    .addNode('llm', (state) => llmNode(state, tools))
    .addNode('tools', toolNode)
    .addNode('saveMemory', createSaveMemoryNode(saveMemory))

    .addEdge(START, 'validate')
    .addEdge('validate', 'loadMemory')
    .addEdge('loadMemory', 'llm')

    .addConditionalEdges('llm', shouldContinue, {
      tools: 'tools',
      end: 'saveMemory',
    })

    .addEdge('tools', 'llm')
    .addEdge('saveMemory', END)
    .compile();
}
