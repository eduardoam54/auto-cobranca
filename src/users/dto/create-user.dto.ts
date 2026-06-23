import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum UserRoleDto {
  admin = 'admin',
  manager = 'manager',
  collector = 'collector',
  viewer = 'viewer',
}

export class CreateUserDto {
  @IsString()
  @IsOptional()
  companyId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string;

  @IsEnum(UserRoleDto)
  role: UserRoleDto;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
