import { ApiProperty } from '@nestjs/swagger';

export class AiChatResponseDto {
  @ApiProperty({
    example:
      'A central vacuum system is a built-in cleaning system with inlet ports connected to a motor unit.',
  })
  message!: string;

  @ApiProperty({ example: 'gemini' })
  provider!: string;
}
