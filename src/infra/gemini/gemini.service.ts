import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly _client: GoogleGenerativeAI | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this._client = new GoogleGenerativeAI(apiKey);
    } else {
      this.logger.warn('GEMINI_API_KEY not set — AI features will be unavailable.');
    }
  }

  get isConfigured(): boolean {
    return this._client !== null;
  }

  get client(): GoogleGenerativeAI {
    if (!this._client) {
      throw new Error('Gemini client is not configured. Set GEMINI_API_KEY in env.');
    }
    return this._client;
  }
}
