import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsPositive, IsString } from 'class-validator';

export class PaginationInfoDto {

  @ApiPropertyOptional()
  @IsInt()
  count?: number;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  limit: number;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  offset: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsPositive()
  maxLimit?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsPositive()
  minLimit?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsPositive()
  defaultLimit?: number;

  constructor(init?: Partial<PaginationInfoDto>) {
    Object.assign(this, init);
  }
}
