# AGENTS.md

## Projeto

Estamos criando um sistema de cobrança automatizada via WhatsApp com IA.

O sistema terá:

- Painel web administrativo
- Aplicativo mobile para cobradores
- Backend com API
- Banco de dados PostgreSQL
- Integração com WhatsApp Business Platform
- Agente de IA para analisar mensagens, consultar clientes e recomendar ações de cobrança

---

## Objetivo do Produto

Criar um SaaS para empresas que fazem cobrança de clientes.

A IA deve analisar mensagens recebidas pelo WhatsApp, entender a intenção do cliente e recomendar a melhor ação para o cobrador.

Exemplo:

Cliente envia:
"Pode passar aqui amanhã depois das 18h que eu pago."

A IA deve:

1. Identificar o cliente pelo telefone.
2. Consultar o cadastro.
3. Consultar cobranças em aberto.
4. Extrair data e horário.
5. Criar recomendação.
6. Enviar tarefa para o cobrador.

---

## Stack Principal

Backend:

- Node.js
- NestJS
- TypeScript
- PostgreSQL
- Prisma
- Redis
- BullMQ

Frontend Web:

- Next.js
- React
- TypeScript
- Tailwind CSS

Mobile:

- Flutter

IA:

- OpenAI API
- Tool Calling
- Respostas em JSON estruturado

WhatsApp:

- WhatsApp Business Platform oficial

---

## Regras de Desenvolvimento

- Nunca criar o sistema inteiro de uma vez.
- Trabalhar sempre em etapas pequenas.
- Antes de codar, explicar o plano.
- Depois de codar, listar arquivos criados ou alterados.
- Não colocar chaves de API diretamente no código.
- Usar variáveis de ambiente.
- Criar código limpo, modular e testável.
- Não misturar regras de negócio dentro de controllers.
- Usar services, DTOs, repositories e validações.
- Criar testes quando possível.
- Pensar em segurança e LGPD desde o início.

---

## Agentes do Projeto

### Agente Backend

Use este agente quando a tarefa envolver API, banco, autenticação, regras de negócio ou integração com serviços externos.

Responsabilidades:

- Criar módulos NestJS
- Criar controllers
- Criar services
- Criar DTOs
- Criar models Prisma
- Criar migrations
- Criar testes
- Criar filas com BullMQ
- Criar integrações com WhatsApp e IA

---

### Agente IA Cobrança

Use este agente quando a tarefa envolver análise de mensagens, classificação de intenção, tool calling, prompts, recomendações de cobrança e criação de tarefas automáticas.

Responsabilidades:

- Analisar mensagens recebidas do WhatsApp
- Identificar intenção do cliente
- Extrair data, horário, valor e promessa de pagamento
- Consultar cadastro do cliente
- Consultar dívidas em aberto
- Criar recomendação para o cobrador
- Gerar JSON estruturado
- Não inventar informações

---

### Agente Mobile

Use este agente quando a tarefa envolver o app do cobrador.

Responsabilidades:

- Login do cobrador
- Lista de tarefas
- Detalhes do cliente
- Registro de visita
- Registro de pagamento
- Foto de comprovante
- Localização
- Modo offline

---

### Agente Frontend

Use este agente quando a tarefa envolver o painel web administrativo.

Responsabilidades:

- Dashboard
- Cadastro de clientes
- Cadastro de cobranças
- Gestão de cobradores
- Histórico de mensagens
- Relatórios
- Configuração da IA

---

### Agente QA

Use este agente quando a tarefa envolver revisão, bugs, testes e segurança.

Responsabilidades:

- Revisar código
- Encontrar falhas
- Criar testes
- Validar regras de negócio
- Sugerir melhorias