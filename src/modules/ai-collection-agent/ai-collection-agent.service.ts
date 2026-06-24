import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  SystemEventSource,
  SystemEventStatus,
  SystemEventType,
} from '@prisma/client';
import { FunctionCallingMode, SchemaType } from '@google/generative-ai';
import { SystemEventService } from '../../events/system-event.service';
import { GeminiService } from '../../infra/gemini/gemini.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AiIntent } from './enums/ai-intent.enum';
import { AiPriority } from './enums/ai-priority.enum';
import { AiRecommendedAction } from './enums/ai-recommended-action.enum';
import {
  AiCollectionAgentResult,
  AiExtractedData,
  AiIdentifiedClient,
  AiOpenCollectionsSummary,
  AiTaskCreationResult,
} from './types/ai-collection-agent.types';
import { AnalyzeMessageDto } from './dto/analyze-message.dto';

type AnalysisResult = Omit<
  AiCollectionAgentResult,
  | 'clientIdentified'
  | 'client'
  | 'openCollectionsSummary'
  | 'taskCreated'
  | 'taskId'
  | 'existingTaskId'
  | 'taskCreationReason'
>;

interface AnalyzeToolInput {
  intent: string;
  confidence: number;
  priority: string;
  summary: string;
  recommendedAction: {
    type: string;
    responsible: string | null;
    messageToCollector: string | null;
    messageToClient: string | null;
  };
  risks: string[];
}

const ANALYZE_FUNCTION = {
  name: 'analyze_collection_message',
  description:
    'Analisa uma mensagem de cobrança via WhatsApp e retorna a intenção do cliente, prioridade, resumo e ação recomendada de forma estruturada.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      intent: {
        type: SchemaType.STRING,
        format: 'enum',
        enum: [
          'payment_promise',
          'presencial_collection',
          'second_copy_request',
          'renegotiation',
          'dispute',
          'payment_made',
          'angry_client',
          'debt_question',
          'unclear',
        ],
        description: 'Intenção identificada na mensagem do cliente',
      },
      confidence: {
        type: SchemaType.NUMBER,
        description: 'Nível de confiança na classificação, entre 0.0 (baixo) e 1.0 (alto)',
      },
      priority: {
        type: SchemaType.STRING,
        format: 'enum',
        enum: ['low', 'medium', 'high', 'critical'],
        description: 'Prioridade da ação necessária',
      },
      summary: {
        type: SchemaType.STRING,
        description: 'Resumo em português brasileiro do que o cliente comunicou',
      },
      recommendedAction: {
        type: SchemaType.OBJECT,
        properties: {
          type: {
            type: SchemaType.STRING,
            format: 'enum',
            enum: [
              'create_task',
              'send_whatsapp_reply',
              'request_human_review',
              'update_collection_status',
              'no_action',
            ],
          },
          responsible: {
            type: SchemaType.STRING,
            format: 'enum',
            enum: ['collector', 'operator', 'system'],
            description: 'Quem deve executar a ação',
          },
          messageToCollector: {
            type: SchemaType.STRING,
            description: 'Instrução para o cobrador',
          },
          messageToClient: {
            type: SchemaType.STRING,
            description: 'Mensagem sugerida para enviar ao cliente via WhatsApp',
          },
        },
        required: ['type', 'responsible', 'messageToCollector', 'messageToClient'],
      },
      risks: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
        description: 'Lista de riscos ou alertas relevantes para esta cobrança',
      },
    },
    required: ['intent', 'confidence', 'priority', 'summary', 'recommendedAction', 'risks'],
  },
};

const SYSTEM_PROMPT = `Você é um assistente especializado em análise de mensagens de cobrança para um sistema de gestão de cobranças via WhatsApp. Sua tarefa é analisar a mensagem recebida de um cliente devedor e classificá-la com precisão, levando em conta o contexto financeiro do cliente.

## Intenções possíveis:
- payment_promise: O cliente promete pagar (menciona data, horário, valor ou qualquer compromisso de pagamento futuro)
- presencial_collection: O cliente solicita ou indica que o cobrador deve ir pessoalmente buscar o pagamento no endereço
- second_copy_request: O cliente pede segunda via de boleto, fatura ou documento de cobrança
- renegotiation: O cliente deseja renegociar, parcelar ou alterar as condições da dívida
- dispute: O cliente contesta a dívida, afirma não dever ou disputa o valor cobrado
- payment_made: O cliente informa que já realizou o pagamento (PIX, boleto, transferência, depósito etc.)
- angry_client: O cliente demonstra raiva, insatisfação extrema, faz ameaças ou usa linguagem agressiva
- debt_question: O cliente tem dúvidas sobre o valor, prazo, detalhes da dívida, juros ou contrato
- unclear: A intenção não é clara, a mensagem está fora de contexto ou não está relacionada à cobrança

## Prioridades:
- critical: Requer ação imediata (cliente muito irritado com ameaças, disputa grave, risco alto de inadimplência definitiva ou crise de relacionamento)
- high: Alta prioridade (promessa de pagamento com data próxima, coleta presencial solicitada, pagamento informado que precisa de confirmação rápida)
- medium: Prioridade média (interesse em renegociação, pedido de segunda via, dúvidas que requerem resposta)
- low: Baixa prioridade (intenção pouco clara, mensagem sem urgência, conversa genérica)

## Ações recomendadas:
- create_task: Criar tarefa para cobrador presencial (use quando intenção for presencial_collection)
- send_whatsapp_reply: Enviar resposta automática via WhatsApp (para dúvidas, confirmações, segunda via, promessa de pagamento)
- request_human_review: Solicitar revisão por operador humano (para disputas, pagamentos informados, casos complexos ou clientes irritados)
- update_collection_status: Atualizar status da cobrança no sistema (quando pagamento for confirmado com comprovante)
- no_action: Nenhuma ação necessária no momento (intenção unclear ou mensagem sem relevância para cobrança)

Considere sempre o número de cobranças em aberto, o total da dívida e se há cobranças vencidas para calibrar a urgência. Responda sempre em português brasileiro.`;

@Injectable()
export class AiCollectionAgentService {
  private readonly logger = new Logger(AiCollectionAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemEventService: SystemEventService,
    private readonly geminiService: GeminiService,
  ) {}

  async analyzeMessage(
    companyId: string,
    dto: AnalyzeMessageDto,
  ): Promise<AiCollectionAgentResult> {
    const normalizedMessage = this.normalize(dto.messageContent);
    const extractedData = this.extractData(normalizedMessage);
    const client = await this.findClient(companyId, dto);
    const identifiedClient = this.toIdentifiedClient(client);
    const openCollections = client
      ? await this.findOpenCollections(companyId, client.id)
      : [];
    const openCollectionsSummary = client
      ? this.toOpenCollectionsSummary(openCollections)
      : this.emptyOpenCollectionsSummary();
    const analysis = await this.analyzeText(
      dto.messageContent,
      normalizedMessage,
      extractedData,
      client,
      openCollectionsSummary,
    );

    if (!client) {
      await this.systemEventService.record({
        companyId,
        messageId: dto.messageId,
        source: SystemEventSource.ai,
        type: SystemEventType.ai_analysis_completed,
        status: SystemEventStatus.warning,
        description:
          'Analise de IA concluida sem identificacao do cliente pelo telefone.',
        metadata: {
          phone: dto.phone,
          intent: analysis.intent,
          confidence: Math.min(analysis.confidence, 0.6),
        },
      });

      return {
        ...analysis,
        clientIdentified: false,
        client: null,
        taskCreated: false,
        taskId: null,
        existingTaskId: null,
        taskCreationReason: 'conditions_not_met',
        confidence: Math.min(analysis.confidence, 0.6),
        priority: AiPriority.medium,
        summary: `${analysis.summary} Cliente nao identificado pelo telefone informado.`,
        openCollectionsSummary,
        extractedData,
        recommendedAction: {
          type: AiRecommendedAction.request_human_review,
          responsible: 'operator',
          messageToCollector: null,
          messageToClient: null,
        },
        risks: [
          ...analysis.risks,
          'Nao expor dados financeiros sem identificar o cliente.',
          'Revisar manualmente antes de qualquer acao de cobranca.',
        ],
      };
    }

    const taskCreation = await this.createTaskWhenRecommended(
      companyId,
      client,
      openCollections,
      {
        ...analysis,
        clientIdentified: true,
        client: identifiedClient,
        openCollectionsSummary,
      },
    );

    await this.systemEventService.record({
      companyId,
      clientId: client.id,
      messageId: dto.messageId,
      taskId: taskCreation.taskId ?? taskCreation.existingTaskId,
      source: SystemEventSource.ai,
      type: SystemEventType.ai_analysis_completed,
      description: 'Analise de IA concluida para mensagem de cobranca.',
      metadata: {
        phone: dto.phone,
        intent: analysis.intent,
        confidence: analysis.confidence,
        priority: analysis.priority,
        recommendedAction: analysis.recommendedAction.type,
        taskCreationReason: taskCreation.taskCreationReason,
      },
    });
    await this.recordTaskCreationEvent(
      companyId,
      client.id,
      dto.messageId,
      taskCreation,
    );

    return {
      ...analysis,
      clientIdentified: true,
      client: identifiedClient,
      openCollectionsSummary,
      ...taskCreation,
    };
  }

  private async analyzeText(
    originalMessage: string,
    normalizedMessage: string,
    extractedData: AiExtractedData,
    client: {
      id: string;
      name: string;
      phone: string;
      whatsappPhone: string | null;
      address: string | null;
      latitude: number | null;
      longitude: number | null;
    } | null,
    openCollectionsSummary: AiOpenCollectionsSummary,
  ): Promise<AnalysisResult> {
    if (!this.geminiService.isConfigured) {
      this.logger.warn(
        'GEMINI_API_KEY not configured — using mock analysis.',
      );
      return this.analyzeMockedText(normalizedMessage, extractedData);
    }

    try {
      return await this.analyzeWithClaude(
        originalMessage,
        extractedData,
        client,
        openCollectionsSummary,
      );
    } catch (error) {
      this.logger.error(
        `Claude API call failed, falling back to mock: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.analyzeMockedText(normalizedMessage, extractedData);
    }
  }

  private async analyzeWithClaude(
    originalMessage: string,
    extractedData: AiExtractedData,
    client: {
      id: string;
      name: string;
      phone: string;
      whatsappPhone: string | null;
      address: string | null;
      latitude: number | null;
      longitude: number | null;
    } | null,
    openCollectionsSummary: AiOpenCollectionsSummary,
  ): Promise<AnalysisResult> {
    const clientContext = client
      ? [
          `Nome: ${client.name}`,
          `Telefone: ${client.whatsappPhone ?? client.phone}`,
          `Endereço: ${client.address ?? 'Não informado'}`,
        ].join('\n')
      : 'Cliente não identificado no sistema.';

    const collectionsContext =
      openCollectionsSummary.openCollectionsCount !== null
        ? [
            `Cobranças em aberto: ${openCollectionsSummary.openCollectionsCount}`,
            `Total em aberto: R$ ${(openCollectionsSummary.totalOpenAmount ?? 0).toFixed(2)}`,
            `Cobranças vencidas: ${openCollectionsSummary.overdueCollectionsCount}`,
          ].join('\n')
        : 'Informações de cobranças não disponíveis.';

    const userMessage = [
      `Mensagem do cliente: "${originalMessage}"`,
      '',
      'Dados extraídos automaticamente:',
      `- Data mencionada: ${extractedData.date ?? 'não mencionada'}`,
      `- Horário mencionado: ${extractedData.time ?? 'não mencionado'}`,
      `- Valor mencionado: ${extractedData.amount != null ? `R$ ${extractedData.amount.toFixed(2)}` : 'não mencionado'}`,
      `- Endereço mencionado na mensagem: ${extractedData.addressMentioned ? 'sim' : 'não'}`,
      '',
      'Informações do cliente:',
      clientContext,
      '',
      'Situação financeira:',
      collectionsContext,
    ].join('\n');

    const model = this.geminiService.client.getGenerativeModel({
      model: 'gemini-2.0-flash-lite',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ functionDeclarations: [ANALYZE_FUNCTION as any] }],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingMode.ANY,
          allowedFunctionNames: ['analyze_collection_message'],
        },
      },
      systemInstruction: SYSTEM_PROMPT,
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    });

    const functionCall = result.response.candidates?.[0]?.content?.parts
      ?.find((p) => p.functionCall)?.functionCall;

    if (!functionCall) {
      throw new Error('Gemini did not return a function call in response');
    }

    const input = functionCall.args as AnalyzeToolInput;

    return {
      intent: input.intent as AiIntent,
      confidence: Math.max(0, Math.min(1, input.confidence)),
      priority: input.priority as AiPriority,
      summary: input.summary,
      extractedData,
      recommendedAction: {
        type: input.recommendedAction.type as AiRecommendedAction,
        responsible:
          (input.recommendedAction.responsible as
            | 'collector'
            | 'operator'
            | 'system'
            | null) ?? null,
        messageToCollector: input.recommendedAction.messageToCollector ?? null,
        messageToClient: input.recommendedAction.messageToClient ?? null,
      },
      risks: Array.isArray(input.risks) ? input.risks : [],
    };
  }

  private recordTaskCreationEvent(
    companyId: string,
    clientId: string,
    messageId: string | undefined,
    taskCreation: AiTaskCreationResult,
  ) {
    if (taskCreation.taskCreationReason === 'created' && taskCreation.taskId) {
      return this.systemEventService.record({
        companyId,
        clientId,
        messageId,
        taskId: taskCreation.taskId,
        source: SystemEventSource.ai,
        type: SystemEventType.ai_task_created,
        description: 'IA criou tarefa de cobranca a partir da mensagem.',
        metadata: {
          taskCreationReason: taskCreation.taskCreationReason,
        },
      });
    }

    if (
      taskCreation.taskCreationReason === 'duplicate_pending_task' &&
      taskCreation.existingTaskId
    ) {
      return this.systemEventService.record({
        companyId,
        clientId,
        messageId,
        taskId: taskCreation.existingTaskId,
        source: SystemEventSource.ai,
        type: SystemEventType.ai_task_duplicate_detected,
        status: SystemEventStatus.warning,
        description:
          'IA nao criou nova tarefa porque ja existe tarefa pendente equivalente.',
        metadata: {
          taskCreationReason: taskCreation.taskCreationReason,
        },
      });
    }

    return this.systemEventService.record({
      companyId,
      clientId,
      messageId,
      source: SystemEventSource.ai,
      type: SystemEventType.ai_task_not_created,
      status: SystemEventStatus.warning,
      description:
        'IA nao criou tarefa porque as condicoes de criacao nao foram atendidas.',
      metadata: {
        taskCreationReason: taskCreation.taskCreationReason,
      },
    });
  }

  private analyzeMockedText(
    normalizedMessage: string,
    extractedData: AiExtractedData,
  ): AnalysisResult {
    if (
      this.hasAny(normalizedMessage, [
        'passar',
        'buscar',
        'pegar dinheiro',
        'em casa',
      ])
    ) {
      return {
        intent: AiIntent.presencial_collection,
        confidence: 0.85,
        priority: AiPriority.high,
        summary:
          'Cliente indicou necessidade de cobranca presencial ou coleta no endereco.',
        extractedData,
        recommendedAction: {
          type: AiRecommendedAction.create_task,
          responsible: 'collector',
          messageToCollector:
            'Cliente mencionou coleta presencial. Confirmar endereco antes de deslocar o cobrador.',
          messageToClient: null,
        },
        risks: ['Confirmar se o endereco cadastrado esta atualizado.'],
      };
    }

    if (this.hasAny(normalizedMessage, ['paguei', 'pix'])) {
      return {
        intent: AiIntent.payment_made,
        confidence: 0.86,
        priority: AiPriority.high,
        summary: 'Cliente informou que realizou pagamento ou mencionou PIX.',
        extractedData,
        recommendedAction: {
          type: AiRecommendedAction.request_human_review,
          responsible: 'operator',
          messageToCollector: null,
          messageToClient: null,
        },
        risks: [
          'Validar comprovante e conciliacao antes de atualizar a cobranca.',
        ],
      };
    }

    if (this.hasAny(normalizedMessage, ['renegociar', 'parcelar'])) {
      return {
        intent: AiIntent.renegotiation,
        confidence: 0.84,
        priority: AiPriority.medium,
        summary:
          'Cliente demonstrou interesse em renegociar ou parcelar a divida.',
        extractedData,
        recommendedAction: {
          type: AiRecommendedAction.request_human_review,
          responsible: 'operator',
          messageToCollector: null,
          messageToClient: null,
        },
        risks: [
          'Conferir regras comerciais antes de oferecer condicoes de renegociacao.',
        ],
      };
    }

    return {
      intent: AiIntent.unclear,
      confidence: 0.45,
      priority: AiPriority.low,
      summary: 'Nao foi possivel identificar uma intencao clara na mensagem.',
      extractedData,
      recommendedAction: {
        type: AiRecommendedAction.no_action,
        responsible: null,
        messageToCollector: null,
        messageToClient: null,
      },
      risks: [
        'Solicitar revisao humana se a conversa envolver cobranca ativa.',
      ],
    };
  }

  private findClient(companyId: string, dto: AnalyzeMessageDto) {
    if (dto.clientId) {
      return this.prisma.client.findFirst({
        where: {
          id: dto.clientId,
          companyId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          whatsappPhone: true,
          address: true,
          latitude: true,
          longitude: true,
        },
      });
    }

    return this.prisma.client.findFirst({
      where: {
        companyId,
        deletedAt: null,
        OR: [{ phone: dto.phone }, { whatsappPhone: dto.phone }],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        whatsappPhone: true,
        address: true,
        latitude: true,
        longitude: true,
      },
    });
  }

  private findOpenCollections(companyId: string, clientId: string) {
    return this.prisma.collection.findMany({
      where: {
        companyId,
        clientId,
        deletedAt: null,
        status: {
          in: ['pending', 'overdue', 'renegotiated'],
        },
      },
      select: {
        id: true,
        amount: true,
        status: true,
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });
  }

  private toOpenCollectionsSummary(
    openCollections: Array<{ amount: Prisma.Decimal; status: string }>,
  ): AiOpenCollectionsSummary {
    return {
      totalOpenAmount: openCollections.reduce(
        (total, collection) => total + this.decimalToNumber(collection.amount),
        0,
      ),
      openCollectionsCount: openCollections.length,
      overdueCollectionsCount: openCollections.filter(
        (collection) => collection.status === 'overdue',
      ).length,
    };
  }

  private async createTaskWhenRecommended(
    companyId: string,
    client: {
      id: string;
      name: string;
      phone: string;
      whatsappPhone: string | null;
      address: string | null;
      latitude: number | null;
      longitude: number | null;
    },
    openCollections: Array<{
      id: string;
      amount: Prisma.Decimal;
      status: string;
    }>,
    analysis: Omit<
      AiCollectionAgentResult,
      'taskCreated' | 'taskId' | 'existingTaskId' | 'taskCreationReason'
    >,
  ): Promise<AiTaskCreationResult> {
    const shouldCreateTask =
      analysis.clientIdentified &&
      analysis.intent === AiIntent.presencial_collection &&
      analysis.recommendedAction.type === AiRecommendedAction.create_task &&
      openCollections.length > 0;

    if (!shouldCreateTask) {
      return {
        taskCreated: false,
        taskId: null,
        existingTaskId: null,
        taskCreationReason: 'conditions_not_met',
      };
    }

    const selectedCollection = this.selectCollectionForTask(openCollections);
    const existingTask = await this.prisma.collectionTask.findFirst({
      where: {
        companyId,
        clientId: client.id,
        collectionId: selectedCollection.id,
        status: 'pending',
        deletedAt: null,
        title: 'Coleta presencial recomendada pela IA',
      },
      select: {
        id: true,
      },
    });

    if (existingTask) {
      return {
        taskCreated: false,
        taskId: null,
        existingTaskId: existingTask.id,
        taskCreationReason: 'duplicate_pending_task',
      };
    }

    const task = await this.prisma.collectionTask.create({
      data: {
        companyId,
        clientId: client.id,
        collectionId: selectedCollection.id,
        collectorId: null,
        title: 'Coleta presencial recomendada pela IA',
        description: analysis.summary,
        type: 'presencial_collection',
        priority: 'high',
        status: 'pending',
        scheduledDate: null,
        scheduledTime: null,
        address: client.address,
        latitude: client.latitude,
        longitude: client.longitude,
        aiRecommendation: null,
      },
      select: {
        id: true,
      },
    });

    await this.prisma.collectionTask.update({
      where: {
        id: task.id,
      },
      data: {
        aiRecommendation: JSON.stringify({
          ...analysis,
          taskCreated: true,
          taskId: task.id,
          existingTaskId: null,
          taskCreationReason: 'created',
        }),
      },
    });

    return {
      taskCreated: true,
      taskId: task.id,
      existingTaskId: null,
      taskCreationReason: 'created',
    };
  }

  private selectCollectionForTask(
    openCollections: Array<{
      id: string;
      amount: Prisma.Decimal;
      status: string;
    }>,
  ) {
    return (
      openCollections.find((collection) => collection.status === 'overdue') ??
      openCollections[0]
    );
  }

  private toIdentifiedClient(
    client: {
      id: string;
      name: string;
      phone: string;
      whatsappPhone: string | null;
      address: string | null;
      latitude: number | null;
      longitude: number | null;
    } | null,
  ): AiIdentifiedClient {
    if (!client) {
      return null;
    }

    return {
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.whatsappPhone ?? client.phone,
    };
  }

  private emptyOpenCollectionsSummary(): AiOpenCollectionsSummary {
    return {
      totalOpenAmount: null,
      openCollectionsCount: null,
      overdueCollectionsCount: null,
    };
  }

  private decimalToNumber(value: Prisma.Decimal) {
    return Number(value.toString());
  }

  private normalize(value: string) {
    return value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  }

  private hasAny(value: string, terms: string[]) {
    return terms.some((term) => value.includes(term));
  }

  private extractData(message: string): AiExtractedData {
    const timeMatch = message.match(/(?:as\s*)?([01]?\d|2[0-3])[:h]([0-5]\d)?/);
    const amountMatch = message.match(/r\$\s*(\d+(?:[,.]\d{2})?)/);

    return {
      date: message.includes('amanha') ? 'amanha' : null,
      time: timeMatch
        ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2] ?? '00'}`
        : null,
      amount: amountMatch ? Number(amountMatch[1].replace(',', '.')) : null,
      addressMentioned: this.hasAny(message, ['endereco', 'em casa', 'aqui']),
    };
  }
}
