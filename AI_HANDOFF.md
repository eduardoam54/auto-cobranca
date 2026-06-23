# AI HANDOFF — Projeto Auto-Cobrança

## Objetivo deste arquivo

Este arquivo serve para permitir que outro agent, outra IA ou outro ambiente continue o projeto sem precisar conhecer toda a conversa anterior.

Antes de alterar qualquer código, leia este arquivo inteiro.

---

# 1. Pasta oficial do projeto

A pasta correta do projeto é:

D:\APP CRIADOS E EM DESENVOLVIMENTO\Criado-com-o-codex\Auto-Cobrança

Não usar esta pasta antiga:

D:\APP CRIADOS E EM DESENVOLVIMENTO\Auto-Cobrança

Existe risco de confusão porque há duas cópias do projeto. Sempre confirme a pasta atual com:

pwd

---

# 2. Stack do projeto

Backend:

* NestJS
* TypeScript
* Prisma
* PostgreSQL
* JWT
* Roles/permissões

Frontend:

* Next.js
* TypeScript
* Área administrativa web em apps/web
* Área PWA/mobile web do cobrador dentro do próprio Next.js

Banco:

* PostgreSQL via Docker
* Prisma migrations

Não usar Expo no momento.
Não usar React Native no momento.
O app mobile nativo foi pausado por problemas de compatibilidade com Expo Go.

---

# 3. Estrutura esperada

Auto-Cobrança/
├── src/                         # backend NestJS
├── prisma/                      # schema e migrations Prisma
├── apps/
│   └── web/                     # frontend Next.js
├── scripts/                     # scripts de diagnóstico/testes
├── .agents/                     # skills/agents do projeto
├── AGENTS.md                    # regras gerais para agents
├── package.json
├── docker-compose.yml
└── AI_HANDOFF.md

---

# 4. Portas usadas

Backend:

http://localhost:3000/api

Frontend:

http://localhost:3001

Celular na mesma rede:

http://192.168.1.3:3001

Proxy interno Next.js:

http://localhost:3001/api/backend/...

O proxy encaminha para:

http://localhost:3000/api/...

---

# 5. Usuários de teste

Admin:

email: [admin@teste.com](mailto:admin@teste.com)
senha: 123456

Cobrador:

email: [cobrador@teste.com](mailto:cobrador@teste.com)
senha: 123456

O usuário cobrador precisa obrigatoriamente:

* existir em User
* ter role = collector
* estar active = true
* estar vinculado a um registro Collector
* ter companyId compatível com a empresa

---

# 6. O que já foi implementado

Backend:

* Health check
* Empresas
* Usuários
* Login JWT
* Roles/permissões
* Clientes
* Cobranças
* Cobradores
* Tarefas de cobrança
* Mensagens
* Agente IA mockado para cobrança
* Criação automática de tarefa pela IA
* Atribuição de tarefa para cobrador
* Início/conclusão/falha de tarefa
* Registro de visita/pagamento
* Cobrança virando paid quando pagamento é registrado
* Rotas mobile/PWA do cobrador

Frontend admin:

* Login admin
* Dashboard
* Clientes
* Cobranças
* Cobradores
* Tarefas
* Testes automáticos com Playwright em parte do fluxo

PWA do cobrador:

* Rota /collector/login
* Rota /collector/tasks
* Rota /collector/tasks/[id]
* Proxy /api/backend criado para evitar CORS/IP no celular

Testes:

* Testes backend e frontend já foram criados em algum nível
* Existe ou deve existir script de diagnóstico do login do cobrador

---

# 7. Rotas importantes do backend

Autenticação:

POST /api/auth/login
GET /api/auth/me

Mobile/PWA do cobrador:

GET /api/mobile/me
GET /api/mobile/my-tasks
PATCH /api/mobile/tasks/:id/start
PATCH /api/mobile/tasks/:id/complete
PATCH /api/mobile/tasks/:id/fail

Admin:

GET /api/clients
POST /api/clients
GET /api/collections
POST /api/collections
GET /api/collectors
POST /api/collectors
PATCH /api/collectors/:id
GET /api/collection-tasks

---

# 8. Rotas importantes do frontend

Admin:

http://localhost:3001/login

PWA do cobrador:

http://localhost:3001/collector/login
http://localhost:3001/collector/tasks
http://localhost:3001/collector/tasks/[id]

PWA pelo celular:

http://192.168.1.3:3001/collector/login

Proxy Next:

POST /api/backend/auth/login
GET /api/backend/mobile/me
GET /api/backend/mobile/my-tasks
PATCH /api/backend/mobile/tasks/:id/start
PATCH /api/backend/mobile/tasks/:id/complete
PATCH /api/backend/mobile/tasks/:id/fail

---

# 9. Problema atual

O login da área do cobrador pelo celular ainda está com problema.

Situação observada:

* O backend direto funcionou no Thunder Client.
* O login do cobrador direto no backend funcionou.
* A rota /api/mobile/me direta no backend funcionou.
* O proxy Next /api/backend foi diagnosticado como problema.
* Depois o proxy foi corrigido.
* O proxy passou a funcionar no Thunder Client.
* O login da área do cobrador funciona no PC.
* No celular, a tela abre, mas ainda aparece "Não foi possível entrar como cobrador".

Conclusão provável:

O backend, usuário e proxy parecem funcionar.
O problema restante pode estar em:

1. Celular usando cache antigo.
2. PWA/service worker/cache do navegador.
3. Frontend rodando em uma pasta enquanto a IA altera outra.
4. A tela /collector/login no celular ainda usando código antigo.
5. Alguma requisição do celular não chegando ao proxy.
6. Alguma diferença entre código usado no PC e no celular.

---

# 10. Diagnóstico obrigatório antes de qualquer nova feature

Antes de adicionar geolocalização, foto ou qualquer outro recurso, corrigir definitivamente o login do cobrador no celular.

A próxima IA deve fazer:

1. Confirmar a pasta correta com pwd.
2. Confirmar que o frontend rodando é o da pasta correta.
3. Confirmar que existem estes arquivos:

apps/web/app/collector/login/page.tsx
apps/web/app/collector/tasks/page.tsx
apps/web/app/collector/tasks/[id]/page.tsx
apps/web/app/api/backend/[...path]/route.ts

4. Criar ou verificar esta rota de diagnóstico:

apps/web/app/collector/debug/page.tsx

5. A página /collector/debug deve testar no próprio celular:

POST /api/backend/auth/login
GET /api/backend/mobile/me

6. O proxy deve imprimir logs no terminal do frontend:

[PROXY] method, path, targetUrl
[PROXY RESPONSE] status
[PROXY ERROR] error

7. No celular, abrir:

http://192.168.1.3:3001/collector/debug

8. Clicar em "Testar login do cobrador".

9. Verificar se o terminal do frontend mostra chamadas [PROXY].

Se o terminal não mostrar [PROXY], o celular não está chamando o código novo.

Se mostrar [PROXY] com status 200, o problema está na lógica da tela /collector/login.

Se mostrar status 401/403/404/500, corrigir conforme o erro real.

---

# 11. Comandos principais

Backend:

cd "D:\APP CRIADOS E EM DESENVOLVIMENTO\Criado-com-o-codex\Auto-Cobrança"
npm run start:dev

Frontend:

cd "D:\APP CRIADOS E EM DESENVOLVIMENTO\Criado-com-o-codex\Auto-Cobrança\apps\web"
npm run dev -- -H 0.0.0.0 -p 3001

Limpar cache Next:

cd "D:\APP CRIADOS E EM DESENVOLVIMENTO\Criado-com-o-codex\Auto-Cobrança\apps\web"
Remove-Item -Recurse -Force .next
npm run dev -- -H 0.0.0.0 -p 3001

Prisma:

cd "D:\APP CRIADOS E EM DESENVOLVIMENTO\Criado-com-o-codex\Auto-Cobrança"
npx prisma generate
npx prisma migrate dev

Docker:

docker compose up -d

Testes backend:

npm run test:e2e:backend

Testes frontend:

cd apps\web
npm run test:e2e

Diagnóstico do cobrador, se existir:

npm run diagnose:collector

---

# 12. Regras para a próxima IA

Não continuar para geolocalização, foto, upload, mapa ou app nativo enquanto o login do cobrador no celular não estiver funcionando.

Não usar Expo.
Não mexer em apps/mobile.
Não alterar regras de autenticação sem necessidade.
Não criar usuário cobrador novo sem antes verificar o existente.
Não apagar migrations.
Não resetar banco sem autorização.
Não trabalhar na pasta errada.

Prioridade máxima:

Corrigir login da PWA do cobrador no celular.

---

# 13. Prompt inicial recomendado para outro agent

Leia AGENTS.md, AI_HANDOFF.md e as skills em .agents/skills.

Trabalhe somente na pasta:

D:\APP CRIADOS E EM DESENVOLVIMENTO\Criado-com-o-codex\Auto-Cobrança

Não use a pasta antiga:

D:\APP CRIADOS E EM DESENVOLVIMENTO\Auto-Cobrança

Objetivo imediato:

Corrigir definitivamente o login da área PWA do cobrador no celular.

Antes de alterar código:

1. Rode pwd.
2. Verifique se as rotas /collector e /api/backend existem.
3. Verifique se /collector/debug existe.
4. Se não existir, crie.
5. Adicione logs [PROXY] no proxy.
6. Teste no celular se o clique chega no proxy.
7. Só depois corrija a causa real.

Resultado esperado:

No celular, acessar:

http://192.168.1.3:3001/collector/login

Fazer login com:

[cobrador@teste.com](mailto:cobrador@teste.com)
123456

E entrar em:

/collector/tasks
