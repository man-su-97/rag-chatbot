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
} from './agent.graph';
import { AIMessage, SystemMessage } from '@langchain/core/messages';

const systemMessage = new SystemMessage(SYSTEM_PROMPT);

async function* streamingLlmNode(
  state: typeof ChatState.State,
  tools: DynamicStructuredTool[],
) {
  const llm = createModel(state.providerConfig, tools);
  const messagesWithPrompt = [systemMessage, ...state.messages];

  const stream = await llm.stream(messagesWithPrompt);

  for await (const chunk of stream) {
    yield { messages: [chunk] };
  }
}

function shouldContinue(state: typeof ChatState.State): 'tools' | 'saveMemory' {
  const lastMessage = state.messages[state.messages.length - 1];

  // Safely check for tool calls on the last message.
  // This is crucial for handling streaming chunks (`AIMessageChunk`) which may not have `additional_kwargs`.
  if (lastMessage?.additional_kwargs?.tool_calls?.length) {
    return 'tools';
  }

  // Otherwise, proceed to save memory and end the cycle
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
    .addNode('llm', (state) => streamingLlmNode(state, tools))
    .addNode('tools', toolNode)
    .addNode('saveMemory', createSaveMemoryNode(saveMemory));

  graph
    .addEdge(START, 'validate')
    .addEdge('validate', 'loadMemory')
    .addEdge('loadMemory', 'llm')
    .addConditionalEdges('llm', shouldContinue, {
      tools: 'tools',
      saveMemory: 'saveMemory',
    })
    .addEdge('tools', 'llm')
    .addEdge('saveMemory', END);

  return graph.compile();
}
