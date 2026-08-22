import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAddressDto {
  @ApiPropertyOptional({ example: 'Home', default: 'Home' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  readonly label?: string = 'Home';

  @ApiProperty({ example: '1234 Main Street' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  readonly line1!: string;

  @ApiPropertyOptional({ example: 'Suite 200' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  readonly line2?: string;

  @ApiProperty({ example: 'Brooklyn' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  readonly city!: string;

  @ApiProperty({ example: 'NY' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  readonly state!: string;

  @ApiProperty({ example: '11201' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  readonly postalCode!: string;

  @ApiPropertyOptional({ example: 'USA', default: 'USA' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  readonly country?: string = 'USA';

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === 1 || value === '1')
  @IsBoolean()
  readonly isDefault?: boolean = false;
}
