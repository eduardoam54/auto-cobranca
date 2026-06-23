import { IsNotEmpty, IsString } from 'class-validator';

export class AssignCollectorDto {
  @IsString()
  @IsNotEmpty()
  collectorId: string;
}
