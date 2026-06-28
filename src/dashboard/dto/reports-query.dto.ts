import { IsDateString, IsOptional } from 'class-validator';

export class ReportsQueryDto {
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;
}
