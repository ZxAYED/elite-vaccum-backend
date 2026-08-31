import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { GeminiProvider } from './providers/gemini.provider';
import { AiDemoToolsService } from './tools/ai-demo-tools.service';

@Module({
  imports: [PrismaModule],
  controllers: [AiController],
  providers: [AiService, GeminiProvider, AiDemoToolsService],
  exports: [AiService, AiDemoToolsService],
})
export class AiModule {}
