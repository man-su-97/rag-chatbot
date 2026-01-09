import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { CommandService } from './command.service';
import { InterpretCommandDto } from './dto/command.dto';
import { FrontendCommand } from './types/command.types';

@ApiTags('command')
@Controller('command')
export class CommandController {
  constructor(private readonly commandService: CommandService) {}

  @Post('interpret')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Interpret a natural language command',
    description:
      'Parses a user message and returns a structured frontend command without using streaming.',
  })
  @ApiResponse({
    status: 200,
    description: 'The structured command for the frontend to execute.',
  })
  @ApiResponse({
    status: 400,
    description: 'The command could not be interpreted.',
  })
  async interpretCommand(
    @Body() commandDto: InterpretCommandDto,
  ): Promise<FrontendCommand> {
    try {
      return await this.commandService.interpretCommand(commandDto.message);
    } catch (error) {
      throw new BadRequestException(
        `Could not interpret command: ${error.message}`,
      );
    }
  }
}
