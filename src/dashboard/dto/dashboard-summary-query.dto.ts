import { IsOptional, IsString } from 'class-validator';

export class DashboardSummaryQueryDto {
  @IsString()
  @IsOptional()
  companyId?: string;
}
