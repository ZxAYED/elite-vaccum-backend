import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ChatDto {
  @ApiProperty({
    example: 'Explain what a central vacuum system is.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message!: string;
}