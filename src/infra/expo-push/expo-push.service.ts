import { Injectable, Logger } from '@nestjs/common';

type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
};

@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);

  async send(message: PushMessage): Promise<void> {
    if (!message.to.startsWith('ExponentPushToken[')) {
      this.logger.warn(`Token invalido ignorado: ${message.to}`);
      return;
    }

    try {
      const response = await fetch('https://exp.host/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: message.to,
          title: message.title,
          body: message.body,
          data: message.data ?? {},
          sound: message.sound ?? 'default',
        }),
      });

      if (!response.ok) {
        this.logger.error(`Expo push falhou: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      // Push failure never blocks the main flow
      this.logger.error('Erro ao enviar push notification', err);
    }
  }

  async sendToMany(tokens: string[], title: string, body: string, data?: Record<string, unknown>): Promise<void> {
    const valid = tokens.filter((t) => t.startsWith('ExponentPushToken['));
    if (valid.length === 0) return;
    await Promise.all(valid.map((to) => this.send({ to, title, body, data })));
  }
}
