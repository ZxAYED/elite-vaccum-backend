import { Injectable } from '@nestjs/common';
import { GeminiProvider } from './providers/gemini.provider';
import { serviceIntakeJsonSchema, ServiceIntakeResult, ServiceIntakeSchema } from './schema/service-intake.schema';

@Injectable()
export class AiService {
  constructor(private readonly geminiProvider: GeminiProvider) { }

  async chat(message: string) {
    const response = await this.geminiProvider.generateText(message);

    return {
      message: response,
      provider: 'gemini',
    };
  }
  async analyzeServiceIntake(
    message: string,
  ): Promise<ServiceIntakeResult> {
    const prompt = `
You are a service intake assistant for Elite Central Vacuum.

Analyze the customer's message and return structured information.

Rules:
- Do not claim a guaranteed diagnosis.
- Use "UNKNOWN" when the service category is unclear.
- Extract only symptoms actually mentioned or reasonably implied.
- Ask useful follow-up questions.
- Recommend practical photos or videos.
- Do not create a service request.
- Do not approve pricing.
- Do not make a final technical diagnosis.
- Return only the requested JSON structure.

Customer message:
${message}
`;

    const rawResult =
      await this.geminiProvider.generateStructured<unknown>({
        input: prompt,
        schema: serviceIntakeJsonSchema,
      });

    return ServiceIntakeSchema.parse(rawResult);
  }
  async *streamChat(message: string): AsyncGenerator<string> {
    yield* this.geminiProvider.streamText(message);
  }
}