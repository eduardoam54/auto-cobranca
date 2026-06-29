# Roadmap WhatsApp — Auto Cobrança

## Decisão arquitetural

O modelo correto para escalar a plataforma é registrar a Auto Cobrança como **Meta Tech Provider**
e implementar **WhatsApp Embedded Signup**, permitindo que cada empresa cliente conecte o próprio
número WhatsApp Business diretamente pelo painel — sem burocracia com a Meta.

---

## Por que esse caminho

| Alternativa | Problema |
|-------------|----------|
| Evolution API / Baileys (não-oficial) | 68% de ban em 12 meses, LGPD não-conforme |
| Número único da plataforma | Viola ToS da Meta e a LGPD brasileira |
| QR code por empresa (WhatsApp Web) | Sessão instável, não escala |
| **Meta Tech Provider + Embedded Signup** | Oficial, escalável, LGPD-conforme ✓ |

---

## Fases de implementação

### Fase 0 — Validação com número próprio (atual)
- Usar a Meta Cloud API atual com número próprio de teste
- Configurar as variáveis no Railway: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_COMPANY_ID`
- Validar o fluxo completo: receber mensagem → IA analisa → responde automaticamente
- Ver `## Como conectar o próprio número` abaixo

### Fase 1 — MVP multi-tenant via BSP (10–20 empresas)
- Integrar com **360dialog** ou **Gupshup** (BSP — Business Solution Provider)
- Eles já têm Embedded Signup pronto; cada empresa conecta o próprio número pelo painel
- Custo: ~€49/mês base + por mensagem enviado
- Tempo estimado: 1–2 semanas de desenvolvimento

### Fase 2 — Meta Tech Provider direto (20+ empresas)
- Registrar a plataforma como Tech Provider na Meta
- Implementar Embedded Signup nativo no painel admin
- Eliminar markup do BSP → margem maior, controle total
- Cada empresa conecta seu número via fluxo OAuth-like dentro do painel
- Tempo estimado: 4–8 semanas de desenvolvimento

### Fase 3 — Recursos enterprise
- Monitoramento de qualidade por tenant (quality rating)
- Billing por mensagem repassado ao cliente
- Multi-agente dentro de uma empresa (vários atendentes, um número)
- Logs e auditoria LGPD por tenant

---

## Como conectar o próprio número (Fase 0)

Para validar com seu próprio número usando a infraestrutura atual (Meta Cloud API):

1. Acesse [developers.facebook.com](https://developers.facebook.com) e crie um App do tipo **Business**
2. Adicione o produto **WhatsApp** ao app
3. No WhatsApp Manager, adicione seu número de telefone comercial
4. A Meta envia um código de verificação por SMS/ligação
5. Copie as credenciais:
   - `WHATSAPP_PHONE_NUMBER_ID` — ID do número cadastrado
   - `WHATSAPP_ACCESS_TOKEN` — token permanente gerado no System User
   - `WHATSAPP_COMPANY_ID` — WABA ID (WhatsApp Business Account ID)
6. Configure essas variáveis no Railway (painel do serviço auto-cobranca)
7. Configure o webhook no Meta App apontando para:
   `https://auto-cobranca-production.up.railway.app/api/whatsapp/webhook`
8. Use o `WHATSAPP_WEBHOOK_VERIFY_TOKEN` definido no Railway como token de verificação

Restrição importante: números com WhatsApp comum instalado precisam ser migrados
para WhatsApp Business API — o app é desinstalado do celular ao fazer isso.
Use um chip/número reservado para testes ou o número comercial definitivo da empresa.

---

## LGPD — Obrigações para cobrança no Brasil

- Documentar base legal por tipo de mensagem (legítimo interesse para cobrança, consentimento para marketing)
- Registrar opt-in por devedor (timestamp, canal, texto exibido)
- Mecanismo de opt-out funcional (palavra PARAR, processado em 48h)
- Retenção: mensagens de marketing 2 anos, registros financeiros 5 anos
- Cada empresa dona dos próprios dados (isolamento por WABA)

---

## Referências

- Meta Embedded Signup: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview
- 360dialog: https://docs.360dialog.com
- Gupshup: https://docs.gupshup.io
- Meta Tech Provider Program: https://developers.facebook.com/documentation/business-messaging/whatsapp
