import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../infra/prisma/prisma.service';
import { GeminiService } from '../infra/gemini/gemini.service';
import { ExpoPushService } from '../infra/expo-push/expo-push.service';

export type ExtractedRow = {
  clientName: string;
  issueDate: string | null;
  dueDate: string | null;
  amount: number | null;
};

type RowResult = {
  clientName: string;
  clientAction: 'created' | 'found';
  collectionCreated: boolean;
  taskCreated?: boolean;
  error?: string;
};

export type SyncResult = {
  total: number;
  clientsCreated: number;
  clientsFound: number;
  collectionsCreated: number;
  tasksCreated: number;
  errors: number;
  rows: RowResult[];
};

const EXTRACTION_PROMPT = `Você é um extrator de dados especializado em tabelas de cobrança.

Extraia todos os registros de clientes/devedores com suas dívidas.
Cada registro contém: nome do cliente, data de emissão, data de vencimento e valor.
Colunas extras como "DIAS VENCIDO" ou "SITUAÇÃO" devem ser ignoradas.

Retorne APENAS um array JSON válido onde cada objeto tem exatamente estas chaves:
- "clientName": nome completo do cliente em maiúsculas
- "issueDate": data de emissão no formato YYYY-MM-DD (ou null)
- "dueDate": data de vencimento no formato YYYY-MM-DD (ou null)
- "amount": valor como número decimal (ex: 112.00) (ou null)

Regras de conversão:
- DD/MM/AA → ano com 2 dígitos assume século 2000 (01/04/26 → 2026-04-01)
- DD/MM/AAAA → (01/04/2026 → 2026-04-01)
- Valores: "112,00" ou "R$ 112,00" → 112.00
- Ignore cabeçalhos, rodapés e linhas sem nome de pessoa
- Retorne SOMENTE o JSON, sem texto adicional`;

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly expoPush: ExpoPushService,
  ) {}

  async extractTable(file: Express.Multer.File): Promise<ExtractedRow[]> {
    if (!this.gemini.isConfigured) {
      throw new BadRequestException(
        'API de IA nao configurada. Defina GEMINI_API_KEY.',
      );
    }

    const ext = file.originalname.split('.').pop()?.toLowerCase();

    if (ext === 'pdf') {
      return this.extractRowsFromPDF(file);
    }

    return this.extractRowsFromText(file, ext);
  }

  async syncToDatabase(
    companyId: string,
    rows: ExtractedRow[],
    collectorId?: string,
  ): Promise<SyncResult> {
    if (!rows.length) {
      throw new BadRequestException('Nenhum registro para sincronizar.');
    }

    const results: RowResult[] = [];
    for (const row of rows) {
      results.push(await this.processRow(companyId, row, collectorId));
    }

    const tasksCreated = results.filter((r) => r.taskCreated).length;

    if (collectorId && tasksCreated > 0) {
      void this.prisma.collector
        .findFirst({ where: { id: collectorId }, select: { expoPushToken: true } })
        .then((collector) => {
          if (collector?.expoPushToken) {
            void this.expoPush.send({
              to: collector.expoPushToken,
              title: 'Novas tarefas atribuidas',
              body: `${tasksCreated} nova(s) tarefa(s) foram atribuidas a voce`,
              data: { type: 'import' },
            });
          }
        });
    }

    return {
      total: rows.length,
      clientsCreated: results.filter((r) => r.clientAction === 'created').length,
      clientsFound: results.filter((r) => r.clientAction === 'found').length,
      collectionsCreated: results.filter((r) => r.collectionCreated).length,
      tasksCreated,
      errors: results.filter((r) => !!r.error).length,
      rows: results,
    };
  }

  private async extractRowsFromPDF(file: Express.Multer.File): Promise<ExtractedRow[]> {
    this.logger.log(`Enviando PDF para o Gemini: ${file.originalname}`);

    const model = this.gemini.client.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: file.buffer.toString('base64'),
              },
            },
            { text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    return this.parseAIResponse(result.response.text());
  }

  private async extractRowsFromText(
    file: Express.Multer.File,
    ext: string | undefined,
  ): Promise<ExtractedRow[]> {
    let text: string;

    if (ext === 'csv' || ext === 'txt') {
      text = file.buffer.toString('utf-8');
    } else if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      text = XLSX.utils.sheet_to_csv(sheet);
    } else {
      throw new BadRequestException(
        'Formato nao suportado. Use PDF, CSV ou Excel (.xlsx, .xls).',
      );
    }

    this.logger.log(`Texto extraído (${file.originalname}):\n${text.slice(0, 600)}`);

    const model = this.gemini.client.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const result = await model.generateContent(
      `${EXTRACTION_PROMPT}\n\nConteúdo da tabela:\n${text}`,
    );

    return this.parseAIResponse(result.response.text());
  }

  private parseAIResponse(text: string): ExtractedRow[] {
    this.logger.log(`Resposta da IA:\n${text.slice(0, 600)}`);

    try {
      const jsonText = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonText) as unknown;
      if (!Array.isArray(parsed)) throw new Error('Resposta nao e um array');
      return parsed as ExtractedRow[];
    } catch {
      this.logger.error('Falha ao parsear resposta da IA', text);
      throw new BadRequestException('Nao foi possivel interpretar os dados da tabela.');
    }
  }

  private async processRow(
    companyId: string,
    row: ExtractedRow,
    collectorId?: string,
  ): Promise<RowResult> {
    const clientName = row.clientName?.trim();

    if (!clientName) {
      return {
        clientName: '(sem nome)',
        clientAction: 'found',
        collectionCreated: false,
        error: 'Nome do cliente ausente.',
      };
    }

    try {
      const existingClient = await this.prisma.client.findFirst({
        where: {
          companyId,
          deletedAt: null,
          name: { equals: clientName, mode: 'insensitive' },
        },
        select: { id: true },
      });

      let clientId: string;
      let clientAction: 'created' | 'found';

      if (existingClient) {
        clientId = existingClient.id;
        clientAction = 'found';
      } else {
        const newClient = await this.prisma.client.create({
          data: {
            companyId,
            name: clientName,
            document: `IMPORTADO-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            phone: 'N/A',
            notes: 'Cliente criado via importacao de tabela. Dados incompletos.',
          },
        });
        clientId = newClient.id;
        clientAction = 'created';
      }

      if (!row.dueDate || row.amount == null) {
        return {
          clientName,
          clientAction,
          collectionCreated: false,
          error: 'Vencimento ou valor ausente — cobranca nao criada.',
        };
      }

      const duplicate = await this.prisma.collection.findFirst({
        where: {
          clientId,
          amount: row.amount,
          dueDate: new Date(row.dueDate),
          ...(row.issueDate ? { issuedAt: new Date(row.issueDate) } : {}),
          deletedAt: null,
        },
        select: { id: true },
      });

      if (duplicate) {
        return {
          clientName,
          clientAction,
          collectionCreated: false,
          error: 'Cobranca ja existe para este cliente com mesma data e valor.',
        };
      }

      const collection = await this.prisma.collection.create({
        data: {
          companyId,
          clientId,
          title: `Divida importada - ${clientName}`,
          amount: row.amount,
          issuedAt: row.issueDate ? new Date(row.issueDate) : null,
          dueDate: new Date(row.dueDate),
        },
      });

      let taskCreated = false;
      if (collectorId) {
        await this.prisma.collectionTask.create({
          data: {
            companyId,
            clientId,
            collectionId: collection.id,
            collectorId,
            title: `Cobranca: ${clientName}`,
            type: 'presencial_collection',
            priority: 'medium',
            status: 'assigned',
          },
        });
        taskCreated = true;
      }

      return { clientName, clientAction, collectionCreated: true, taskCreated };
    } catch (err) {
      this.logger.error(`Erro ao processar linha "${clientName}"`, err);
      return {
        clientName,
        clientAction: 'found',
        collectionCreated: false,
        error: 'Erro interno ao salvar registro.',
      };
    }
  }
}
