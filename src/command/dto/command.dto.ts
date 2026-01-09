import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InterpretCommandDto {
  @ApiProperty({
    description: 'The natural language command from the user.',
    example: 'add a widget called my-new-widget with a line chart',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}
