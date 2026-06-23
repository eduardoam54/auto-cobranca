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
