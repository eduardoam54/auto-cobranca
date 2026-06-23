import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteCollectionTaskDto {
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

  @IsBoolean()
  @IsOptional()
  paymentReceived?: boolean;
}
