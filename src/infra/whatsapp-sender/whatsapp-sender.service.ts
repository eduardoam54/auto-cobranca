import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type WhatsappSendResult = {
  externalMessageId: string;
};

@Injectable()
export class WhatsappSenderService {
  private readonly logger = new Logger(WhatsappSenderService.name);
  private readonly accessToken: string | null;
  private readonly phoneNumberId: string | null;
  private readonly mockMode: boolean;
  private readonly apiVersion = 'v21.0';

  constructor(private readonly configService: ConfigService) {
    this.accessToken =
      this.configService.get<string>('WHATSAPP_ACCESS_TOKEN') ?? null;
    this.phoneNumberId =
      this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID') ?? null;
    this.mockMode =
      this.configService.get<string>('WHATSAPP_MOCK_MODE') === 'true';

    if (this.mockMode) {
      this.logger.warn(
        '⚠️  WHATSAPP_MOCK_MODE ativo — mensagens NAO serao enviadas de verdade.',
      );
    } else if (!this.accessToken || !this.phoneNumberId) {
      this.logger.warn(
        'WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID nao configurados — envio desabilitado.',
      );
    }
  }

  get isConfigured(): boolean {
    return this.mockMode || !!(this.accessToken && this.phoneNumberId);
  }

  async sendText(to: string, body: string): Promise<WhatsappSendResult> {
    if (this.mockMode) {
      const fakeId = `mock-wamid-${Date.now()}`;
      this.logger.log(
        `[MOCK] Mensagem para ${to}: "${body.slice(0, 60)}..." — id: ${fakeId}`,
      );
      return { externalMessageId: fakeId };
    }

    if (!this.accessToken || !this.phoneNumberId) {
      throw new Error(
        'WhatsApp sender nao configurado. Defina WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID, ou ative WHATSAPP_MOCK_MODE=true.',
      );
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `WhatsApp API retornou ${response.status}: ${errorBody}`,
      );
    }

    const data = (await response.json()) as {
      messages?: Array<{ id: string }>;
    };

    const externalMessageId = data.messages?.[0]?.id ?? '';

    this.logger.log(`Mensagem enviada para ${to} — wamid: ${externalMessageId}`);

    return { externalMessageId };
  }
}
