export type WhatsappWebhookPayload = {
  object?: string;
  entry?: WhatsappEntry[];
};

export type WhatsappEntry = {
  id?: string;
  changes?: WhatsappChange[];
};

export type WhatsappChange = {
  field?: string;
  value?: {
    messaging_product?: string;
    metadata?: {
      phone_number_id?: string;
      display_phone_number?: string;
    };
    contacts?: Array<{
      wa_id?: string;
      profile?: {
        name?: string;
      };
    }>;
    messages?: WhatsappMessage[];
    statuses?: unknown[];
  };
};

export type WhatsappMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: {
    body?: string;
  };
  image?: {
    caption?: string;
  };
  document?: {
    caption?: string;
  };
};

export type WhatsappWebhookResult = {
  received: true;
  processedMessages: number;
  skippedMessages: number;
};

// Evolution API webhook payload
export type EvolutionWebhookPayload = {
  event?: string;
  instance?: string;
  data?: {
    key?: {
      remoteJid?: string;
      fromMe?: boolean;
      id?: string;
    };
    pushName?: string;
    message?: {
      conversation?: string;
      imageMessage?: { caption?: string };
      documentMessage?: { caption?: string };
      audioMessage?: Record<string, unknown>;
      videoMessage?: { caption?: string };
    };
    messageType?: string;
    messageTimestamp?: number;
  };
};
