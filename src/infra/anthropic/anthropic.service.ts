import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class AnthropicService {
  private readonly logger = new Logger(AnthropicService.name);
  private readonly _client: Anthropic | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this._client = new Anthropic({ apiKey });
    } else {
      this.logger.warn(
        'ANTHROPIC_API_KEY not set — AI analysis will use mock fallback.',
      );
    }
  }

  get isConfigured(): boolean {
    return this._client !== null;
  }

  get client(): Anthropic {
    if (!this._client) {
      throw new Error(
        'Anthropic client is not configured. Set ANTHROPIC_API_KEY in env.',
      );
    }
    return this._client;
  }
}
