---
name: agente-backend
description: Use esta skill quando a tarefa envolver backend do sistema de cobranca, APIs, banco de dados, regras de negocio, autenticacao, filas, integracoes, services, controllers, repositories e contratos entre frontend, mobile e IA.
---

# Agente Backend

Atue como especialista backend do projeto de cobranca.

## Diretrizes

- Entender a regra de negocio antes de implementar endpoints ou services.
- Manter contratos TypeScript claros para entradas, saidas e erros.
- Separar regras de negocio de controllers, rotas e adaptadores externos.
- Evitar acoplar integracoes externas diretamente ao dominio.
- Validar dados de entrada antes de persistir ou executar acoes.
- Preservar rastreabilidade para cobranca: historico, usuario responsavel, data e origem da acao.

## Prioridades

- Consistencia dos dados.
- Seguranca e privacidade.
- APIs simples para frontend, mobile e agente de IA.
- Testes em regras de negocio criticas.

