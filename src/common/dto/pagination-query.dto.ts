import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Query base para qualquer endpoint de listagem paginada.
 * Entidades com filtros proprios estendem esta classe.
 */
export class PaginationQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  /** Busca textual livre — cada serviço decide em quais campos aplicar. */
  @IsString()
  @IsOptional()
  search?: string;

  /** Campo de ordenação (validado contra uma allowlist no serviço). */
  @IsString()
  @IsOptional()
  sortBy?: string;

  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
