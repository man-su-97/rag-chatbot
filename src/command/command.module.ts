import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CommandController } from './command.controller';
import { CommandService } from './command.service';

@Module({
  imports: [ConfigModule],
  controllers: [CommandController],
  providers: [CommandService],
})
export class CommandModule {}
