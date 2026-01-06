// import { StateGraph, START, END } from '@langchain/langgraph';
// import { ToolNode } from '@langchain/langgraph/prebuilt';
// import { DynamicStructuredTool } from '@langchain/core/tools';
// import { createModel } from '../models/model.factory';
// import {
//   ChatState,
//   createLoadMemoryNode,
//   createSaveMemoryNode,
//   MemoryLoadFn,
//   MemorySaveFn,
//   SYSTEM_PROMPT,
//   validateInputNode,
//   addHumanMessageNode,
// } from './agent.graph';
// import {
//   AIMessage,
//   AIMessageChunk,
//   SystemMessage,
// } from '@langchain/core/messages';

// const systemMessage = new SystemMessage(SYSTEM_PROMPT);

// async function* streamingLlmNode(
//   state: typeof ChatState.State,
//   tools: DynamicStructuredTool[],
// ) {
//   try {
//     console.log('🤖 streamingLlmNode STARTED');
//     console.log('   Provider:', state.providerConfig.provider);
//     console.log('   Model:', state.providerConfig.model);
//     console.log('   Messages in state:', state.messages.length);
//     console.log('   API Key present?', !!state.providerConfig.apiKey);
//     console.log('   API Key length:', state.providerConfig.apiKey?.length || 0);

//     const llm = createModel(state.providerConfig, tools);
//     const messagesWithPrompt = [systemMessage, ...state.messages];

//     console.log('   Total messages for LLM:', messagesWithPrompt.length);

//     let accumulated: AIMessageChunk | null = null;
//     const chunks: AIMessageChunk[] = [];

//     // ✅ Try streaming first
//     console.log('📡 Attempting to stream...');
//     try {
//       if (typeof (llm as any).stream === 'function') {
//         console.log('   Stream function exists, calling it...');
//         const stream = await llm.stream(messagesWithPrompt);

//         console.log('   Stream created, iterating chunks...');
//         for await (const chunk of stream) {
//           console.log('   📦 Received chunk:', chunk.content?.substring(0, 20));
//           accumulated = accumulated ? accumulated.concat(chunk) : chunk;
//           chunks.push(chunk);
//         }

//         console.log(
//           `   ✅ Streaming complete. Chunks collected: ${chunks.length}`,
//         );

//         // ✅ Only use streaming result if we got chunks
//         if (accumulated && chunks.length > 0) {
//           console.log('   ✅ Yielding streaming result');
//           yield {
//             streamingChunks: chunks,
//             messages: [
//               new AIMessage({
//                 content: accumulated.content ?? '',
//                 tool_calls: accumulated.tool_calls ?? [],
//                 additional_kwargs: accumulated.additional_kwargs ?? {},
//                 response_metadata: accumulated.response_metadata ?? {},
//               }),
//             ],
//           };
//           console.log('   ✅ Streaming yield complete, returning');
//           return;
//         } else {
//           console.warn(
//             '   ⚠️ Streaming returned 0 chunks, falling back to invoke',
//           );
//         }
//       } else {
//         console.warn('   ⚠️ Stream function does not exist, will use invoke');
//       }
//     } catch (streamError) {
//       console.error('   ❌ Streaming failed with error:', streamError);
//       console.error('   Error message:', (streamError as Error).message);
//       console.error('   Error stack:', (streamError as Error).stack);
//     }

//     // ✅ Fallback to invoke
//     console.log('📞 Attempting to invoke...');
//     try {
//       const result = await llm.invoke(messagesWithPrompt);

//       console.log('   ✅ Invoke successful');
//       console.log(
//         '   Response content:',
//         result.content?.toString().substring(0, 50),
//       );
//       console.log('   Response type:', result.constructor.name);

//       yield {
//         streamingChunks: [],
//         messages: [result],
//       };
//       console.log('   ✅ Invoke yield complete');
//     } catch (invokeError) {
//       console.error('   ❌ Invoke ALSO failed:', invokeError);
//       console.error('   Error message:', (invokeError as Error).message);
//       console.error('   Error stack:', (invokeError as Error).stack);

//       console.log('   ⚠️ Yielding error message as fallback');
//       yield {
//         streamingChunks: [],
//         messages: [
//           new AIMessage({
//             content: `Error: Unable to generate response. ${(invokeError as Error).message}`,
//             tool_calls: [],
//           }),
//         ],
//       };
//       console.log('   ✅ Error yield complete');
//     }

//     console.log('🤖 streamingLlmNode FINISHED');
//   } catch (topLevelError) {
//     console.error('💥 CATASTROPHIC ERROR in streamingLlmNode:', topLevelError);
//     console.error('   Error name:', (topLevelError as Error).name);
//     console.error('   Error message:', (topLevelError as Error).message);
//     console.error('   Stack:', (topLevelError as Error).stack);

//     // ✅ MUST yield something or graph hangs
//     yield {
//       streamingChunks: [],
//       messages: [
//         new AIMessage({
//           content: `Critical error: ${(topLevelError as Error).message}`,
//           tool_calls: [],
//         }),
//       ],
//     };
//   }
// }

// function shouldContinue(state: typeof ChatState.State): 'tools' | 'saveMemory' {
//   try {
//     const messages = state.messages || [];
//     if (messages.length === 0) {
//       return 'saveMemory';
//     }

//     const lastMessage = messages[messages.length - 1];

//     // This should now always be a complete AIMessage
//     if (!lastMessage || !(lastMessage instanceof AIMessage)) {
//       return 'saveMemory';
//     }

//     // Safe access to tool_calls
//     const toolCalls = lastMessage.tool_calls || [];
//     if (Array.isArray(toolCalls) && toolCalls.length > 0) {
//       return 'tools';
//     }

//     // Fallback check
//     const additionalToolCalls = lastMessage.additional_kwargs?.tool_calls;
//     if (Array.isArray(additionalToolCalls) && additionalToolCalls.length > 0) {
//       return 'tools';
//     }

//     return 'saveMemory';
//   } catch (error) {
//     console.error('Error in shouldContinue:', error);
//     return 'saveMemory';
//   }
// }

// export function buildAgentGraph(
//   loadMemory: MemoryLoadFn,
//   saveMemory: MemorySaveFn,
//   tools: DynamicStructuredTool[],
// ) {
//   console.log('🏗️ Building agent graph...');
//   console.log('   Tools available:', tools.length);

//   const toolNode = new ToolNode(tools);

//   const graph = new StateGraph(ChatState)
//     .addNode('validate', validateInputNode)
//     .addNode('loadMemory', createLoadMemoryNode(loadMemory))
//     .addNode('addHumanMessage', addHumanMessageNode)
//     // ✅ FIX: Use yield* to delegate to the inner generator
//     .addNode('llm', async function* (state) {
//       console.log('🔄 LLM node wrapper called');
//       console.log('   State has messages:', state.messages?.length || 0);
//       console.log('   State has providerConfig:', !!state.providerConfig);

//       // Delegate to streamingLlmNode and pass through all its yields
//       yield* streamingLlmNode(state, tools);

//       console.log('🔄 LLM node wrapper completed');
//     })
//     .addNode('tools', toolNode)
//     .addNode('saveMemory', createSaveMemoryNode(saveMemory));

//   graph
//     .addEdge(START, 'validate')
//     .addEdge('validate', 'loadMemory')
//     .addEdge('loadMemory', 'addHumanMessage')
//     .addEdge('addHumanMessage', 'llm')
//     .addConditionalEdges('llm', shouldContinue, {
//       tools: 'tools',
//       saveMemory: 'saveMemory',
//     })
//     .addEdge('tools', 'llm')
//     .addEdge('saveMemory', END);

//   const compiled = graph.compile();
//   console.log('✅ Agent graph compiled successfully');

//   return compiled;
// }

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

  // Best-effort streaming (side-channel only)
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

  // Guaranteed fallback
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
