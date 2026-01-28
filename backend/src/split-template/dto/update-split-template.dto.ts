import { PartialType } from '@nestjs/mapped-types';
import { CreateSplitTemplateDto } from './create-split-from-template.dto';

export class UpdateSplitTemplateDto extends PartialType(CreateSplitTemplateDto) {}
