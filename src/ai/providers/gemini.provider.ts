import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class GeminiProvider {
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    this.client = new GoogleGenAI({
      apiKey,
    });

    this.model =
      this.configService.get<string>('GEMINI_MODEL') ??
      'gemini-3.6-flash';
  }

  async generateText(message: string): Promise<string> {
    try {
      const interaction = await this.client.interactions.create({
        model: this.model,
        input: message,
        store: false,
      });

      const output = interaction.output_text?.trim();

      if (!output) {
        throw new InternalServerErrorException(
          'Gemini returned an empty response',
        );
      }

      return output;
    } catch (error: unknown) {
      if (
        error instanceof InternalServerErrorException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown Gemini error';

      console.error('Gemini API error:', errorMessage);

      throw new ServiceUnavailableException(
        'Gemini AI service is temporarily unavailable',
      );
    }
  }
  async *streamText(message: string): AsyncGenerator<string> {
    try {
      const stream = await this.client.interactions.create({
        model: this.model,
        input: message,
        store: false,
        stream: true,
      });

      for await (const event of stream) {
        if (event.event_type !== 'step.delta') {
          continue;
        }

        if (!event.delta || event.delta.type !== 'text') {
          continue;
        }

        if (event.delta.text) {
          yield event.delta.text;
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown Gemini error';

      console.error('Gemini streaming error:', errorMessage);

      throw new ServiceUnavailableException(
        'Gemini streaming service is temporarily unavailable',
      );
    }
  }
  async generateStructured<T>(params: {
    input: string;
    schema: Record<string, unknown>;
  }): Promise<T> {
    try {
      const interaction = await this.client.interactions.create({
        model: this.model,
        input: params.input,
        store: false,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: params.schema,
        },
      });

      const output = interaction.output_text?.trim();

      if (!output) {
        throw new Error('Gemini returned an empty structured response');
      }

      try {
        return JSON.parse(output) as T;
      } catch {
        throw new Error('Gemini returned invalid JSON');
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown Gemini error';

      console.error('Gemini structured-output error:', errorMessage);

      throw new ServiceUnavailableException(
        'Gemini structured-output service is temporarily unavailable',
      );
    }
  }
}