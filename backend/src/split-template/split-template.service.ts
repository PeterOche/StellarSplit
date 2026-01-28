import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { SplitTemplate } from "./entities/split-template.entity";
import { Repository } from "typeorm";
import { CreateSplitTemplateDto } from "./dto/create-split-from-template.dto";
import { UpdateSplitTemplateDto } from "./dto/update-split-template.dto";

@Injectable()
export class SplitTemplateService {
  constructor(
    @InjectRepository(SplitTemplate)
    private readonly repo: Repository<SplitTemplate>,
  ) {}

  create(userId: string, dto: CreateSplitTemplateDto) {
    const template = this.repo.create({ ...dto, userId });
    return this.repo.save(template);
  }

  findAllForUser(userId: string) {
    return this.repo.find({ where: { userId } });
  }

  findOne(id: string) {
    return this.repo.findOneBy({ id });
  }

  update(id: string, dto: UpdateSplitTemplateDto) {
    return this.repo.update(id, dto);
  }

  delete(id: string) {
    return this.repo.delete(id);
  }

  async createSplitFromTemplate(templateId: string) {
    const template = await this.findOne(templateId);

    if (!template) throw new NotFoundException('Template not found');

    // increment usage
    await this.repo.increment({ id: templateId }, 'usageCount', 1);

    return {
      splitType: template.splitType,
      participants: template.defaultParticipants,
      items: template.defaultItems,
      taxPercentage: template.taxPercentage,
      tipPercentage: template.tipPercentage,
    };
  }
}
