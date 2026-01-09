import { StateGraph, START, END } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { createModel } from '../models/model.factory';
import {
  ChatState,
  createLoadMemoryNode,
  createSaveMemoryNode,
  MemoryLoadFn,
  MemorySaveFn,
  SYSTEM_PROMPT,
  validateInputNode,
  addHumanMessageNode,
} from './agent.graph';
import {
  AIMessage,
  AIMessageChunk,
  SystemMessage,
} from '@langchain/core/messages';

const systemMessage = new SystemMessage(SYSTEM_PROMPT);

async function llmNode(
  state: typeof ChatState.State,
  tools: DynamicStructuredTool[],
) {
  const llm = createModel(state.providerConfig, tools);
  const messagesWithPrompt = [systemMessage, ...state.messages];

  if (typeof (llm as any).stream === 'function') {
    let accumulated: AIMessageChunk | null = null;

    try {
      const stream = await llm.stream(messagesWithPrompt);
      for await (const chunk of stream) {
        accumulated = accumulated ? accumulated.concat(chunk) : chunk;
      }

      if (accumulated) {
        return {
          messages: [
            new AIMessage({
              content: accumulated.content ?? '',
              tool_calls: accumulated.tool_calls ?? [],
              additional_kwargs: accumulated.additional_kwargs ?? {},
              response_metadata: accumulated.response_metadata ?? {},
            }),
          ],
        };
      }
    } catch {
      // Fall through to invoke
    }
  }

  const result = await llm.invoke(messagesWithPrompt);

  return {
    messages: [result],
  };
}

function shouldContinue(state: typeof ChatState.State): 'tools' | 'saveMemory' {
  const messages = state.messages ?? [];
  if (messages.length === 0) return 'saveMemory';

  const lastMessage = messages[messages.length - 1];
  if (!(lastMessage instanceof AIMessage)) return 'saveMemory';

  const toolCalls = lastMessage.tool_calls ?? [];
  if (Array.isArray(toolCalls) && toolCalls.length > 0) return 'tools';

  const fallbackCalls = lastMessage.additional_kwargs?.tool_calls;
  if (Array.isArray(fallbackCalls) && fallbackCalls.length > 0) return 'tools';

  return 'saveMemory';
}

export function buildAgentGraph(
  loadMemory: MemoryLoadFn,
  saveMemory: MemorySaveFn,
  tools: DynamicStructuredTool[],
) {
  const toolNode = new ToolNode(tools);

  const graph = new StateGraph(ChatState)
    .addNode('validate', validateInputNode)
    .addNode('loadMemory', createLoadMemoryNode(loadMemory))
    .addNode('addHumanMessage', addHumanMessageNode)
    .addNode('llm', (state) => llmNode(state, tools))
    .addNode('tools', toolNode)
    .addNode('saveMemory', createSaveMemoryNode(saveMemory));

  graph
    .addEdge(START, 'validate')
    .addEdge('validate', 'loadMemory')
    .addEdge('loadMemory', 'addHumanMessage')
    .addEdge('addHumanMessage', 'llm')
    .addConditionalEdges('llm', shouldContinue, {
      tools: 'tools',
      saveMemory: 'saveMemory',
    })
    .addEdge('tools', 'llm')
    .addEdge('saveMemory', END);

  return graph.compile();
}
