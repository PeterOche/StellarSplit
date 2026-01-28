import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import { SplitTemplateService } from "./split-template.service";
import { CreateSplitTemplateDto } from "./dto/create-split-from-template.dto";

interface RequestWithUser extends Request {
  user: { wallet: string };
}

@Controller("split-templates")
export class SplitTemplateController {
  constructor(private readonly service: SplitTemplateService) {}

  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: CreateSplitTemplateDto) {
    return this.service.create(req.user.wallet, dto);
  }

  @Get()
  findAll(@Req() req: RequestWithUser) {
    return this.service.findAllForUser(req.user.wallet);
  }

  @Post(":id/create-split")
  createSplit(@Param("id") id: string) {
    return this.service.createSplitFromTemplate(id);
  }
}
