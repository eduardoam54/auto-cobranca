import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type WhatsappSendResult = {
  externalMessageId: string;
};

@Injectable()
export class WhatsappSenderService {
  private readonly logger = new Logger(WhatsappSenderService.name);
  private readonly provider: 'meta' | 'evolution';
  private readonly mockMode: boolean;

  // Meta
  private readonly accessToken: string | null;
  private readonly phoneNumberId: string | null;
  private readonly apiVersion = 'v21.0';

  // Evolution API
  private readonly evolutionApiUrl: string | null;
  private readonly evolutionApiKey: string | null;
  private readonly evolutionInstanceName: string | null;

  constructor(private readonly configService: ConfigService) {
    this.mockMode =
      this.configService.get<string>('WHATSAPP_MOCK_MODE') === 'true';
    this.provider =
      (this.configService.get<string>('WHATSAPP_PROVIDER') as 'meta' | 'evolution') ?? 'meta';

    this.accessToken =
      this.configService.get<string>('WHATSAPP_ACCESS_TOKEN') ?? null;
    this.phoneNumberId =
      this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID') ?? null;

    this.evolutionApiUrl =
      this.configService.get<string>('EVOLUTION_API_URL') ?? null;
    this.evolutionApiKey =
      this.configService.get<string>('EVOLUTION_API_KEY') ?? null;
    this.evolutionInstanceName =
      this.configService.get<string>('EVOLUTION_INSTANCE_NAME') ?? null;

    if (this.mockMode) {
      this.logger.warn(
        '⚠️  WHATSAPP_MOCK_MODE ativo — mensagens NAO serao enviadas de verdade.',
      );
    } else if (this.provider === 'evolution' && !this.isEvolutionConfigured) {
      this.logger.warn(
        'EVOLUTION_API_URL, EVOLUTION_API_KEY ou EVOLUTION_INSTANCE_NAME nao configurados — envio desabilitado.',
      );
    } else if (this.provider === 'meta' && !this.isMetaConfigured) {
      this.logger.warn(
        'WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID nao configurados — envio desabilitado.',
      );
    } else {
      this.logger.log(`WhatsApp sender ativo via provedor: ${this.provider}`);
    }
  }

  private get isMetaConfigured(): boolean {
    return !!(this.accessToken && this.phoneNumberId);
  }

  private get isEvolutionConfigured(): boolean {
    return !!(this.evolutionApiUrl && this.evolutionApiKey && this.evolutionInstanceName);
  }

  get isConfigured(): boolean {
    if (this.mockMode) return true;
    if (this.provider === 'evolution') return this.isEvolutionConfigured;
    return this.isMetaConfigured;
  }

  async sendText(to: string, body: string): Promise<WhatsappSendResult> {
    if (this.mockMode) {
      const fakeId = `mock-wamid-${Date.now()}`;
      this.logger.log(
        `[MOCK] Mensagem para ${to}: "${body.slice(0, 60)}..." — id: ${fakeId}`,
      );
      return { externalMessageId: fakeId };
    }

    if (this.provider === 'evolution') {
      return this.sendViaEvolution(to, body);
    }

    return this.sendViaMeta(to, body);
  }

  private async sendViaMeta(to: string, body: string): Promise<WhatsappSendResult> {
    if (!this.accessToken || !this.phoneNumberId) {
      throw new Error(
        'Meta WhatsApp sender nao configurado. Defina WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID.',
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
      throw new Error(`Meta WhatsApp API retornou ${response.status}: ${errorBody}`);
    }

    const data = (await response.json()) as {
      messages?: Array<{ id: string }>;
    };

    const externalMessageId = data.messages?.[0]?.id ?? '';
    this.logger.log(`[Meta] Mensagem enviada para ${to} — wamid: ${externalMessageId}`);

    return { externalMessageId };
  }

  private async sendViaEvolution(to: string, body: string): Promise<WhatsappSendResult> {
    if (!this.evolutionApiUrl || !this.evolutionApiKey || !this.evolutionInstanceName) {
      throw new Error(
        'Evolution API nao configurada. Defina EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE_NAME.',
      );
    }

    const url = `${this.evolutionApiUrl}/message/sendText/${this.evolutionInstanceName}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: this.evolutionApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ number: to, text: body }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Evolution API retornou ${response.status}: ${errorBody}`);
    }

    const data = (await response.json()) as { key?: { id?: string } };
    const externalMessageId = data.key?.id ?? '';

    this.logger.log(`[Evolution] Mensagem enviada para ${to} — id: ${externalMessageId}`);

    return { externalMessageId };
  }
}
