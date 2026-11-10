import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../domain/enums';
import { UserDto } from '../../domain/types';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from './auth-bindings';
import { ExportPageQueryDto } from './dto/analytics-filter.dto';
import {
  ApiExportPage, FieldExportSchema, ObservationExportSchema, TaskExportSchema, TreatmentExportSchema,
} from './dto/export-schema.dto';
import { ExportPage, ExportService } from './export.service';

/** Versioned open REST API: pages of schemaVersion-1 DTOs for the future AP Agronomist integration. */
@ApiTags('export-v1')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ChiefAgronomist)
@Controller('export/v1')
export class ExportApiController {
  constructor(private readonly exports: ExportService) {}

  @Get('fields')
  @ApiOperation({ summary: 'Fields (FieldExportDto)' }) @ApiExportPage(FieldExportSchema)
  fields(@CurrentUser() user: UserDto, @Query() query: ExportPageQueryDto): Promise<ExportPage> {
    return this.exports.page('fields', user.farmId, query);
  }

  @Get('observations')
  @ApiOperation({ summary: 'Observations (ObservationExportDto)' }) @ApiExportPage(ObservationExportSchema)
  observations(@CurrentUser() user: UserDto, @Query() query: ExportPageQueryDto): Promise<ExportPage> {
    return this.exports.page('observations', user.farmId, query);
  }

  @Get('tasks')
  @ApiOperation({ summary: 'Tasks (TaskExportDto)' }) @ApiExportPage(TaskExportSchema)
  tasks(@CurrentUser() user: UserDto, @Query() query: ExportPageQueryDto): Promise<ExportPage> {
    return this.exports.page('tasks', user.farmId, query);
  }

  @Get('treatments')
  @ApiOperation({ summary: 'Treatments (TreatmentExportDto)' }) @ApiExportPage(TreatmentExportSchema)
  treatments(@CurrentUser() user: UserDto, @Query() query: ExportPageQueryDto): Promise<ExportPage> {
    return this.exports.page('treatments', user.farmId, query);
  }
}
