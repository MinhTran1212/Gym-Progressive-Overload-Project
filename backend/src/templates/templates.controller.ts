import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  create(
    @Body() createTemplateDto: CreateTemplateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.templatesService.create(createTemplateDto, user?.id);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.templatesService.findAll(user?.id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.templatesService.findOne(id, user?.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.templatesService.update(id, updateTemplateDto, user?.id);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.templatesService.remove(id, user?.id);
  }

  @Post(':id/start-workout')
  startWorkout(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.templatesService.startWorkout(id, user?.id);
  }
}
