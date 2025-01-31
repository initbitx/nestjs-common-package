import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationInfoDto } from './pagination-info.dto';


export class StandardResponseDto<TData> {
  @ApiProperty()
  readonly success?: boolean = true;

  @ApiProperty({ default: false })
  readonly isArray?: boolean;

  @ApiPropertyOptional()
  readonly isPaginated?: boolean;

  @ApiPropertyOptional()
  readonly isSorted?: boolean;

  @ApiPropertyOptional()
  readonly isFiltered?: boolean;

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional()
  pagination?: PaginationInfoDto;

  @ApiProperty()
  data: TData | TData[];

  constructor({
                message,
                pagination,
                data
              }: StandardResponseDto<TData>) {
    this.message = message;
    this.pagination = pagination;
    this.data = data;
    if (pagination) this.isPaginated = true;
    if (data && Array.isArray(data)) {
      this.isArray = true;
    }
  }
}
