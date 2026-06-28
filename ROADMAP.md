# ROADMAP — Auto-Cobrança

Guia de continuação do plano de profissionalização do app (backend NestJS + web Next.js + mobile Expo).
Organizado por partes, com tarefas acionáveis, arquivos-chave e critério de pronto.

> **Como usar:** pegue a próxima parte com status ⬜, leia "Padrões já estabelecidos",
> execute as tarefas na ordem, e marque ✅ ao concluir. Ações que dependem do dono
> (deploy, env, decisões) estão em [PENDENCIAS.md](PENDENCIAS.md).

**Legenda:** ✅ feito · 🟡 parcial · ⬜ pendente

---

## Status geral

| Parte | Tema | Status |
|-------|------|--------|
| 1 | Segurança & base (backend) | ✅ (falta refresh token) |
| 2 | Paginação, busca e filtros | ✅ |
| 3 | Motor de cobrança | 🟡 (3.1 feito; 3.2–3.5 requerem schema) |
| 4 | IA de cobrança profissional | ⬜ |
| 5 | Profissionalização do painel web | 🟡 (5.3 e 5.7 feitos) |
| 6 | Mobile robusto | ⬜ |
| 7 | Plataforma & DevOps | ⬜ |
| 8 | Funcionalidades de produto | ⬜ |

---

## Padrões já estabelecidos (seguir sempre)

Para manter consistência, qualquer continuação deve respeitar o que já existe:

- **Multi-tenant:** tudo é escopado por `companyId` (vem de `@CurrentUser()`). Nunca consultar sem filtrar empresa.
- **Soft-delete:** filtrar sempre `deletedAt: null`. Remoções fazem `update deletedAt`.
- **Envelope de erro:** `AllExceptionsFilter` já padroniza `{ statusCode, error, message, errorCode, requestId, timestamp, path }`. Lançar `HttpException` do Nest; não retornar erro cru.
- **Paginação (Parte 2):** endpoints de lista retornam `{ data, meta }`. Helpers em [src/common/pagination.ts](src/common/pagination.ts) (`getPaginationParams`, `buildPaginatedResult`, `resolveOrderBy`) e DTO base [src/common/dto/pagination-query.dto.ts](src/common/dto/pagination-query.dto.ts). `sortBy` sempre validado por allowlist.
- **Web — consumo de listas:**
  - `usePaginatedData<T>(path)` → lista com paginação real + busca (ver [clients](apps/web/app/(admin)/clients/page.tsx) e [users](apps/web/app/(admin)/users/page.tsx)).
  - `useApiList<T>(path)` → busca uma página grande (limit 100) e devolve só o array, para dropdowns/detalhes/lookups. Ver [use-paginated-data.ts](apps/web/lib/use-paginated-data.ts).
  - Componentes [Pagination](apps/web/components/pagination.tsx) e [SearchInput](apps/web/components/search-input.tsx).
- **Logging:** `nestjs-pino`; usar o `Logger` do Nest, que já roteia para o pino. Não logar segredos (já há redaction).
- **Build local:** ao limpar `dist`, apagar também `tsconfig.build.tsbuildinfo` (senão `nest build` gera dist vazio). Após mudar schema: `npx prisma generate`.
- **Idioma:** UI e mensagens em português (manter acentuação correta — há dívida de diacríticos a corrigir na Parte 5).

---

## Parte 1 — Segurança & base ✅ (1 item restante)

Feito: rate limiting, helmet, CORS endurecido, trust proxy, validação de env (Joi), filtro global de exceções com requestId, logging estruturado (pino), Swagger em `/api/docs` (off em produção por padrão), testes unitários do filtro e do schema.

### ⬜ 1.1 Refresh token + access token curto
- **Backend:** modelo de refresh token (hash no banco para permitir revogação); endpoints `POST /auth/refresh` e `POST /auth/logout`; access token ~15min, refresh ~30d. `JWT_EXPIRES_IN` já é configurável (a "costura").
- **Web:** guardar refresh em cookie `httpOnly` (mais seguro que `localStorage`); interceptor que renova no 401 e refaz a request.
- **Mobile:** guardar refresh no `expo-secure-store`; interceptor de auto-refresh no [api/client.ts](apps/mobile/src/api/client.ts).
- **Critério de pronto:** sessão sobrevive à expiração do access token sem novo login; logout revoga o refresh.

---

## Parte 2 — Paginação, busca e filtros ✅ (follow-ups)

Feito: paginação + busca + filtros + ordenação server-side em clients, collections, collection-tasks, collectors, collection-visits, messages, users (envelope `{ data, meta }`). Endpoint `/clients/distinct-locations` para o autocomplete. Web inteiro migrado para o novo formato (typecheck limpo). Paginação real (UI) em **clientes** e **usuários**; demais telas consomem via `useApiList` (limite 100) até a Parte 5.

### ✅ 2.1 Rollout da UI de paginação nas demais telas de lista
- Aplicar `usePaginatedData` + `<Pagination>` + `<SearchInput>` (+ filtros por status/etc.) em: **collections, collection-tasks, collectors, messages, visits**.
- Telas com agregação client-side (messages agrupado, visits com cards de stats) precisam ser repensadas para dados paginados — ver 2.2.
- **Critério de pronto:** nenhuma tela depende mais de `useApiList(100)` para listas que podem crescer.

### ✅ 2.2 Endpoint de agregação para Relatórios (corrige limitação real)
- Hoje [reports/page.tsx](apps/web/app/(admin)/reports/page.tsx) agrega no cliente a partir de no máx. 100 visitas → **estatística fica errada acima de 100 visitas**.
- Criar `GET /dashboard/reports` (ou `reports` module) com agregação server-side via `groupBy`/`aggregate`: desempenho por cobrador (visitas, pagos, parcial, recusado, total arrecadado, taxa de sucesso), distribuição de resultados, formas de pagamento, totais — com filtro de período.
- Migrar a página de relatórios para consumir esse endpoint (parar de baixar visitas).
- **Critério de pronto:** números corretos independente do volume; sem baixar linhas para o cliente.

---

## Parte 3 — Motor de cobrança ⬜ (maior valor de negócio)

**Objetivo:** transformar o app de "registro" em "motor" que age sozinho.

### ✅ 3.1 Vencimento automático
- Cron diário: `Collection` `pending → overdue` quando `dueDate < hoje` (escopo por empresa). Reaproveitar `@nestjs/schedule` (ver [push-scheduler.service.ts](src/modules/push-scheduler/push-scheduler.service.ts)).
- Registrar `SystemEvent` da transição.

### ⬜ 3.2 Régua de cobrança (dunning) configurável
- Modelo de regras por empresa (ex.: lembrete 3 dias antes, no dia, 3/7/15 dias depois) e canal (WhatsApp/push).
- Cron que avalia cobranças e dispara mensagens via [WhatsappSenderService](src/infra/whatsapp-sender/whatsapp-sender.service.ts) usando templates.
- Tela web para configurar a régua.

### ⬜ 3.3 Renegociação / parcelamento
- Novo modelo `Installment` (ou `Agreement`) ligado a `Collection`; status `renegotiated` já existe no enum.
- Fluxo: criar acordo, gerar parcelas, acompanhar pagamento parcela a parcela.

### ⬜ 3.4 Pagamento parcial com saldo
- Hoje `Collection` tem só `amount`/`paidAt`. Adicionar **ledger de pagamentos** (registros de pagamento) e cálculo de saldo devedor.
- `partial_paid` (visita) deve abater do saldo, não marcar pago total.

### ⬜ 3.5 Recibo de pagamento
- Geração de recibo (PDF) ao confirmar pagamento; link no app/painel.

**Critério de pronto da Parte 3:** cobranças vencem sozinhas, lembretes saem automaticamente, e há suporte real a parcial/renegociação com saldo.

---

## Parte 4 — IA de cobrança profissional ⬜

**Objetivo:** IA confiável, auditável e que age (não só classifica).

### ⬜ 4.1 Unificar o provedor de IA
- Hoje coexistem `AnthropicService` e `GeminiService`; o agente usa **Gemini** (`gemini-2.0-flash-lite`) apesar de métodos chamados `analyzeWithClaude` ([ai-collection-agent.service.ts](src/modules/ai-collection-agent/ai-collection-agent.service.ts)).
- Escolher um provedor (recomendado: Claude com tool use — já há `@anthropic-ai/sdk`), remover o código morto, corrigir nomenclatura e `.env.example`.

### ⬜ 4.2 Resposta automática ao cliente
- O agente já produz `messageToClient`. Enviar via WhatsApp quando `confidence` alta e intenção segura, com guardrails (nunca expor dados sem cliente identificado).

### ⬜ 4.3 Contexto de conversa
- Analisar a thread do cliente (histórico de `Message`), não a mensagem isolada.

### ⬜ 4.4 Human-in-the-loop no painel
- Tela de IA mostrando ações sugeridas para aprovar/recusar; timeline auditável usando os `SystemEvent` já gravados.

### ⬜ 4.5 Controles de custo/limite e métricas de IA.

---

## Parte 5 — Profissionalização do painel web ⬜

**Objetivo:** percepção de produto maduro.

### ⬜ 5.1 React Query (ou SWR)
- Substituir `useApiData`/`useApiList`/`usePaginatedData` artesanais por React Query (cache, dedup, retry, invalidação, optimistic updates).

### ⬜ 5.2 UI de paginação em todas as listas (junta com 2.1).

### ✅ 5.3 Feedback e estados
- Skeletons de carregamento, **toasts** (ex.: sonner) no lugar de alerts inline, confirmações consistentes.

### ⬜ 5.4 Gráficos reais
- Dashboard e relatórios com **Recharts** + filtro de período (o `DashboardSummaryQueryDto` hoje é ignorado).

### ⬜ 5.5 Exportação CSV/PDF de relatórios.

### ⬜ 5.6 Segurança de sessão no front
- Proteção de rota via Next middleware; migrar token de `localStorage` para cookie `httpOnly` (junto com 1.1).

### ✅ 5.7 Acessibilidade + correção de diacríticos
- Vários textos estão sem acento ("Acoes", "selecao", "Usuarios"...). Padronizar pt-BR correto.

### ⬜ 5.8 Dropdowns que crescem
- Selects de cliente/cobrador/cobrança hoje usam `useApiList(100)`. Para bases grandes, virar **select com busca assíncrona** (server search já existe).

---

## Parte 6 — Mobile robusto ⬜

### ⬜ 6.1 Observabilidade: Sentry + analytics de uso.
### ⬜ 6.2 Fila offline resiliente
- Hoje a sync para no primeiro erro ([offline-sync.ts](apps/mobile/src/offline/offline-sync.ts)). Adicionar retry/backoff e dead-letter para item que falha sempre.
### ⬜ 6.3 Otimização da rota do dia
- Ordenar visitas por proximidade (já há lat/long e `react-native-maps`).
### ⬜ 6.4 Check-in por geofencing / localização em background.
### ⬜ 6.5 Biometria + refresh de token (junto com 1.1).

---

## Parte 7 — Plataforma & DevOps ⬜

### ⬜ 7.1 CI (GitHub Actions)
- Pipeline: lint, typecheck, testes (back + web), build, `prisma validate`, `prisma migrate deploy`.
- Reativar os 2 specs em quarentena (ver PENDENCIAS.md) e remover do `testPathIgnorePatterns`.
### ⬜ 7.2 Pacote compartilhado de tipos `@auto-cobranca/shared`
- Eliminar a tripla duplicação de tipos ([web/lib/types.ts](apps/web/lib/types.ts) ↔ [mobile/types/api.ts](apps/mobile/src/types/api.ts) ↔ DTOs do backend).
### ⬜ 7.3 Uploads em storage durável
- Fotos/recibos vão para `/uploads` local ([app.module.ts](src/app.module.ts)) — FS do Railway é efêmero (perde a cada deploy). Migrar para S3/Cloudinary + validação de tipo/tamanho.
### ⬜ 7.4 Observabilidade backend
- Sentry, readiness/liveness, métricas. Já existe `/health`.
### ⬜ 7.5 Documentação
- README de setup + doc de arquitetura. Aposentar o `AI_HANDOFF.md` (desatualizado).

---

## Parte 8 — Funcionalidades de produto ⬜

### ⬜ 8.1 Portal do cliente (link mágico via WhatsApp): 2ª via, negociação self-service, pagamento.
### ⬜ 8.2 Integração de pagamento: PIX dinâmico / boleto (Asaas, Gerencianet ou Mercado Pago) — fecha o ciclo.
### ⬜ 8.3 Multi-empresa real: onboarding + billing por plano (SaaS).
### ⬜ 8.4 LGPD: consentimento, retenção, export/delete de dados pessoais.
### ⬜ 8.5 Relatórios avançados: aging, DSO, previsão de recebíveis.

---

## Pendências que dependem do dono

Deploy, variáveis de ambiente no Railway, decisões de produto e os 2 testes em quarentena estão em **[PENDENCIAS.md](PENDENCIAS.md)**.
