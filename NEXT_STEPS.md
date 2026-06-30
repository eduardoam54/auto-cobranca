# Próximos Passos — WhatsApp Integration

## Estado atual (30/06/2026)

### O que foi tentado
- Evolution API no Railway (`atendai/evolution-api-lite:latest`) — FALHOU
- Todos os deploys crasham silenciosamente (só aparece "Starting Container")
- Causa provável: Railway não oferece volumes no plano atual, e a imagem precisa de `/evolution/instances`
- Serviço `evolution-api` ainda existe no Railway (Failed state) — pode deletar

### Variáveis já configuradas no serviço `evolution-api` (Railway)
Irrelevante — vamos abandonar essa abordagem.

---

## Próxima ação: Meta Cloud API

O backend **já suporta Meta Cloud API** — só precisa de credenciais.

### Passos para ativar

1. Acesse https://developers.facebook.com → criar app
   - Tipo: **Business**
   - Produto: **WhatsApp**

2. Em WhatsApp → Getting Started:
   - Copiar o **Phone Number ID** (número de teste gratuito disponível)
   - Gerar o **Access Token temporário** (ou token permanente via System User)

3. Configurar webhook:
   - URL: `https://auto-cobranca-production.up.railway.app/api/whatsapp/webhook`
   - Verify Token: qualquer string (ex: `autocobranca-webhook-2024`)
   - Eventos: `messages`

4. Setar variáveis no Railway (serviço `auto-cobranca`):
   ```
   WHATSAPP_PROVIDER=meta
   WHATSAPP_MOCK_MODE=false
   WHATSAPP_PHONE_NUMBER_ID=<id do passo 2>
   WHATSAPP_ACCESS_TOKEN=<token do passo 2>
   WHATSAPP_WEBHOOK_VERIFY_TOKEN=autocobranca-webhook-2024
   WHATSAPP_COMPANY_ID=<id da empresa no banco>
   ```

5. No Meta, confirmar o webhook (Railway responderá automaticamente ao challenge)

### Limitações do plano gratuito Meta
- Número de teste (não real): só pode enviar para números verificados manualmente
- Para número real: verificação da empresa Meta Business (~1 semana)
- Grátis até 1.000 conversas/mês

---

## Arquivos relevantes no código
- `src/infra/whatsapp-sender/whatsapp-sender.service.ts` — lógica de envio (Meta e Evolution)
- `src/whatsapp/whatsapp.controller.ts` — endpoints webhook (`GET /whatsapp/webhook`, `POST /whatsapp/webhook`)
- `src/whatsapp/whatsapp.service.ts` — processamento de mensagens recebidas
- `src/config/env.validation.ts` — todas as variáveis de ambiente esperadas
