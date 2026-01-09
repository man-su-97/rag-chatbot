import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';

import {
  AddWidgetCommand,
  ChartType,
  FrontendCommand,
} from './types/command.types';

const ADD_WIDGET_REGEX =
  /add(?: a)? widget(?: called)? "([^"]+)" with(?: a)? (line|bar|pie|table) chart/i;

@Injectable()
export class CommandService {
  private readonly logger = new Logger(CommandService.name);

  constructor(private readonly configService: ConfigService) {}

  async interpretCommand(message: string): Promise<FrontendCommand> {
    try {
      const command = await this.interpretWithGemini(message);
      this.logger.log('Successfully interpreted command with Gemini');
      return command;
    } catch (error) {
      this.logger.warn(
        `Gemini interpretation failed, falling back to deterministic parser. Error: ${error.message}`,
      );
      // Fallback to the deterministic parser if Gemini fails
      return this.interpretWithFallback(message);
    }
  }

  private interpretWithFallback(message: string): AddWidgetCommand {
    const match = message.match(ADD_WIDGET_REGEX);

    if (match && match.length === 3) {
      const [, widgetId, chartType] = match;
      return {
        type: 'ADD_WIDGET',
        payload: {
          widgetId: widgetId,
          chartType: chartType.toLowerCase() as ChartType,
        },
      };
    }

    throw new Error('Unable to parse command with fallback parser.');
  }

  private async interpretWithGemini(
    message: string,
  ): Promise<AddWidgetCommand> {
    const apiKey = this.configService.get<string>('DEFAULT_LLM_API_KEY');
    if (!apiKey) {
      throw new Error('Gemini API key is not configured.');
    }

    const commandSchema = z.object({
      type: z.literal('ADD_WIDGET'),
      payload: z.object({
        widgetId: z.string().describe('A unique identifier for the new widget'),
        chartType: z
          .enum(['line', 'bar', 'pie', 'table'])
          .describe('The type of chart to display in the widget'),
      }),
    });

    const model = new ChatGoogleGenerativeAI({
      apiKey,
      model: 'gemini-1.5-flash-latest',
      temperature: 0,
      streaming: false,
      maxRetries: 0, // Fail fast
    });

    const structuredLLM = model.withStructuredOutput(commandSchema, {
      name: 'widget_command',
    });

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        'You are a command parser. Your only job is to convert natural language text into a structured command.',
      ],
      ['human', '{message}'],
    ]);

    const chain = prompt.pipe(structuredLLM);

    return await chain.invoke(
      { message },
      { timeout: 3000 }, // 3-second timeout
    );
  }
}
