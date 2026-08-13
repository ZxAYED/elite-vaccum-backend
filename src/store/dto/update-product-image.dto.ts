import { PartialType } from '@nestjs/swagger';
import { AddProductImageDto } from './add-product-image.dto';

export class UpdateProductImageDto extends PartialType(AddProductImageDto) {}

