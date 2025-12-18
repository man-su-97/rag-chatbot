import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
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
  lastResponse: Annotation<string | undefined>(),

  reply: Annotation<any | undefined>(),
});

export type MemoryLoadFn = (sessionId: string) => Promise<ChatMessage[]>;

export type MemorySaveFn = (
  sessionId: string,
  messages: ChatMessage[],
) => Promise<void>;

// Loads past messages for the session and merges them with the new user message.
export function createLoadMemoryNode(loadFn: MemoryLoadFn) {
  return async function loadMemoryNode(state: typeof ChatState.State) {
    const persisted = (await loadFn(state.sessionId)) ?? [];
    const incoming = state.messages ?? [];

    const cleanPersisted = persisted.filter(
      (m) => typeof m.content === 'string',
    );

    return {
      messages: [...cleanPersisted, ...incoming],
    };
  };
}

export function createSaveMemoryNode(saveFn: MemorySaveFn) {
  return async function saveMemoryNode(state: typeof ChatState.State) {
    const cleanMessages = state.messages.filter(
      (m) => typeof m.content === 'string',
    );

    await saveFn(state.sessionId, cleanMessages);
    return {};
  };
}
// AI-level validation,protect the LLM from bad state, not the HTTP API
export function validateInputNode(state: typeof ChatState.State) {
  if (!state.messages?.length) {
    throw new Error('No messages found.');
  }

  const last = state.messages[state.messages.length - 1];

  if (last.role !== 'user') {
    throw new Error('Last message must come from a user.');
  }

  if (!last.content?.trim()) {
    throw new Error('User message is empty.');
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

  if (!state.sessionId) {
    throw new Error('Session ID missing.');
  }

  return {};
}

// Helper to find and execute a single tool call from a list.
async function executeTool(
  toolCall: any,
  tools?: DynamicStructuredTool[],
): Promise<{ confirmation: string; payload: any } | null> {
  if (!tools || tools.length === 0) {
    return null;
  }

  const toolToExecute = tools.find((tool) => tool.name === toolCall.name);
  if (!toolToExecute) {
    return null;
  }

  try {
    // The tool's func is expected to return a JSON string.
    const output = await toolToExecute.func(toolCall.args);
    const parsedOutput = JSON.parse(output);

    const confirmation = `I have successfully executed the ${toolToExecute.name} tool.`;
    return {
      confirmation,
      payload: parsedOutput,
    };
  } catch (error) {
    console.error(`Error executing tool ${toolCall.name}:`, error);
    const confirmation = `I tried to use the ${toolCall.name} tool, but an error occurred.`;
    return {
      confirmation,
      payload: { error: (error as Error).message },
    };
  }
}

// produce the assistant’s response
export async function llmNode(
  state: typeof ChatState.State,
  tools?: DynamicStructuredTool[],
) {
  const messages = state.messages;
  if (!messages?.length) {
    throw new Error('No messages found.');
  }

  const llmWithTools = createModel(state.providerConfig, tools);
  const mappedMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let result = await llmWithTools.invoke(mappedMessages);

  const hasToolCalls = (result as any).tool_calls?.length > 0;
  const hasContent =
    typeof result.content === 'string' && result.content.trim().length > 0;

  if (!hasToolCalls && !hasContent) {
    const llmWithoutTools = createModel(state.providerConfig);
    result = await llmWithoutTools.invoke(mappedMessages);
  }

  if ((result as any).tool_calls?.length) {
    // Per requirements, only handle the first tool call.
    const toolCall = (result as any).tool_calls[0];
    const toolResult = await executeTool(toolCall, tools);

    if (!toolResult) {
      const reply = `I tried to use the ${toolCall.name} tool, but it was not found.`;
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
        reply: { error: 'Tool not found' },
      };
    }

    // Do NOT persist the tool payload to memory, only the human-readable confirmation.
    // The 'reply' field with the structured data is for the client only.
    return {
      messages: [
        ...messages,
        {
          role: 'assistant',
          content: toolResult.confirmation,
          createdAt: new Date().toISOString(),
        },
      ],
      lastResponse: toolResult.confirmation,
      reply: toolResult.payload, // This is the structured data for the client
    };
  }

  const reply = result.content ?? '';

  if (reply.trim().length === 0) {
    return {
      lastResponse: '',
      reply: '',
    };
  }

  // The default text response does not include a structured reply.
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
    reply: null, // Ensure reply is null for standard text messages
  };
}

// Wires all nodes into a fixed execution order and compiles the graph.
export function buildChatGraph(
  loadMemory: MemoryLoadFn,
  saveMemory: MemorySaveFn,
  tools: DynamicStructuredTool[],
) {
  const boundLlmNode = (state: typeof ChatState.State) => llmNode(state, tools);

  return new StateGraph(ChatState)
    .addNode('validateInputNode', validateInputNode)
    .addNode('loadMemoryNode', createLoadMemoryNode(loadMemory))
    .addNode('llmNode', boundLlmNode)
    .addNode('saveMemoryNode', createSaveMemoryNode(saveMemory))
    .addEdge(START, 'validateInputNode')
    .addEdge('validateInputNode', 'loadMemoryNode')
    .addEdge('loadMemoryNode', 'llmNode')
    .addEdge('llmNode', 'saveMemoryNode')
    .addEdge('saveMemoryNode', END)
    .compile();
}
