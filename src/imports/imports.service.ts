import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
import { PrismaService } from '../infra/prisma/prisma.service';
import { AnthropicService } from '../infra/anthropic/anthropic.service';

type ExtractedRow = {
  clientName: string;
  issueDate: string | null;
  dueDate: string | null;
  amount: number | null;
};

type RowResult = {
  clientName: string;
  clientAction: 'created' | 'found';
  collectionCreated: boolean;
  error?: string;
};

export type ImportResult = {
  total: number;
  clientsCreated: number;
  clientsFound: number;
  collectionsCreated: number;
  errors: number;
  rows: RowResult[];
};

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropic: AnthropicService,
  ) {}

  async processTable(
    companyId: string,
    file: Express.Multer.File,
  ): Promise<ImportResult> {
    const text = await this.fileToText(file);
    const rows = await this.extractRowsWithAI(text);

    if (!rows.length) {
      throw new BadRequestException(
        'Nenhum registro encontrado na tabela. Verifique o arquivo.',
      );
    }

    const results: RowResult[] = [];

    for (const row of rows) {
      results.push(await this.processRow(companyId, row));
    }

    return {
      total: rows.length,
      clientsCreated: results.filter((r) => r.clientAction === 'created').length,
      clientsFound: results.filter((r) => r.clientAction === 'found').length,
      collectionsCreated: results.filter((r) => r.collectionCreated).length,
      errors: results.filter((r) => !!r.error).length,
      rows: results,
    };
  }

  private async fileToText(file: Express.Multer.File): Promise<string> {
    const ext = file.originalname.split('.').pop()?.toLowerCase();

    if (ext === 'csv' || ext === 'txt') {
      return file.buffer.toString('utf-8');
    }

    if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      return XLSX.utils.sheet_to_csv(sheet);
    }

    if (ext === 'pdf') {
      const data = await pdfParse(file.buffer);
      return data.text;
    }

    throw new BadRequestException(
      'Formato nao suportado. Use PDF, CSV ou Excel (.xlsx, .xls).',
    );
  }

  private async extractRowsWithAI(text: string): Promise<ExtractedRow[]> {
    if (!this.anthropic.isConfigured) {
      throw new BadRequestException(
        'API de IA nao configurada. Defina ANTHROPIC_API_KEY.',
      );
    }

    const prompt = `Você é um extrator de dados. Analise a tabela abaixo e extraia todos os registros de dívidas.

Retorne APENAS um array JSON válido onde cada objeto tem exatamente estas chaves:
- "clientName": string com o nome do cliente/devedor
- "issueDate": string no formato YYYY-MM-DD com a data de emissão da dívida (ou null se não houver)
- "dueDate": string no formato YYYY-MM-DD com a data de vencimento (ou null se não houver)
- "amount": número decimal com o valor (ex: 1234.56) (ou null se não houver)

Regras:
- Converta qualquer formato de data para YYYY-MM-DD (ex: 15/03/2025 → 2025-03-15)
- Converta qualquer formato de valor para número decimal (ex: R$ 1.234,56 → 1234.56)
- Ignore linhas de cabeçalho, totais ou linhas vazias
- Se uma linha não tiver nome do cliente, ignore-a
- Não inclua explicações, retorne SOMENTE o JSON

Conteúdo da tabela:
${text}`;

    const response = await this.anthropic.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new BadRequestException('Resposta inesperada da IA.');
    }

    try {
      const jsonText = content.text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonText) as unknown;

      if (!Array.isArray(parsed)) {
        throw new Error('Resposta nao e um array');
      }

      return parsed as ExtractedRow[];
    } catch {
      this.logger.error('Falha ao parsear resposta da IA', content.text);
      throw new BadRequestException(
        'Nao foi possivel interpretar os dados da tabela.',
      );
    }
  }

  private async processRow(
    companyId: string,
    row: ExtractedRow,
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
            document: 'IMPORTADO',
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

      await this.prisma.collection.create({
        data: {
          companyId,
          clientId,
          title: `Divida importada - ${clientName}`,
          amount: row.amount,
          issuedAt: row.issueDate ? new Date(row.issueDate) : null,
          dueDate: new Date(row.dueDate),
        },
      });

      return { clientName, clientAction, collectionCreated: true };
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
