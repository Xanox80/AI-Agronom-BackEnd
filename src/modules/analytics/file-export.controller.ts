import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { FeatureCollection } from 'geojson';
import { Role } from '../../domain/enums';
import { UserDto } from '../../domain/types';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from './auth-bindings';
import { flattenExportDto, toCsv } from './csv-writer';
import { OBSERVATION_COLUMNS, TASK_COLUMNS, TREATMENT_COLUMNS } from './export-columns';
import { AnalyticsFilterDto } from './dto/analytics-filter.dto';
import { ExportService } from './export.service';
import { fieldGeometry, pointGeometry, toFeatureCollection } from './geojson-writer';

const CSV = 'text/csv; charset=utf-8';
const GEOJSON = 'application/geo+json';
const attachment = (name: string) => `attachment; filename="${name}"`;

@ApiTags('analytics-export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ChiefAgronomist)
@Controller('analytics/export')
export class FileExportController {
  constructor(private readonly exports: ExportService) {}

  @Get('observations.csv')
  @Header('Content-Type', CSV) @Header('Content-Disposition', attachment('observations.csv'))
  @ApiOperation({ summary: 'Observations as CSV' }) @ApiProduces('text/csv') @ApiOkResponse({ type: String })
  async observationsCsv(@CurrentUser() user: UserDto, @Query() filter: AnalyticsFilterDto): Promise<string> {
    return toCsv((await this.exports.observations(user.farmId, filter)).map(flattenExportDto), OBSERVATION_COLUMNS);
  }

  @Get('observations.geojson')
  @Header('Content-Type', GEOJSON) @Header('Content-Disposition', attachment('observations.geojson'))
  @ApiOperation({ summary: 'Observations as GeoJSON FeatureCollection' })
  async observationsGeojson(@CurrentUser() user: UserDto, @Query() filter: AnalyticsFilterDto): Promise<FeatureCollection> {
    return toFeatureCollection(await this.exports.observations(user.farmId, filter), pointGeometry);
  }

  @Get('fields.geojson')
  @Header('Content-Type', GEOJSON) @Header('Content-Disposition', attachment('fields.geojson'))
  @ApiOperation({ summary: 'Fields as GeoJSON FeatureCollection' })
  async fieldsGeojson(@CurrentUser() user: UserDto): Promise<FeatureCollection> {
    return toFeatureCollection(await this.exports.fields(user.farmId), fieldGeometry);
  }

  @Get('tasks.csv')
  @Header('Content-Type', CSV) @Header('Content-Disposition', attachment('tasks.csv'))
  @ApiOperation({ summary: 'Tasks as CSV' }) @ApiProduces('text/csv') @ApiOkResponse({ type: String })
  async tasksCsv(@CurrentUser() user: UserDto, @Query() filter: AnalyticsFilterDto): Promise<string> {
    return toCsv((await this.exports.tasks(user.farmId, filter)).map(flattenExportDto), TASK_COLUMNS);
  }

  @Get('tasks.geojson')
  @Header('Content-Type', GEOJSON) @Header('Content-Disposition', attachment('tasks.geojson'))
  @ApiOperation({ summary: 'Tasks as GeoJSON FeatureCollection' })
  async tasksGeojson(@CurrentUser() user: UserDto, @Query() filter: AnalyticsFilterDto): Promise<FeatureCollection> {
    return toFeatureCollection(await this.exports.tasks(user.farmId, filter), pointGeometry);
  }

  @Get('treatments.csv')
  @Header('Content-Type', CSV) @Header('Content-Disposition', attachment('treatments.csv'))
  @ApiOperation({ summary: 'Treatment log as CSV' }) @ApiProduces('text/csv') @ApiOkResponse({ type: String })
  async treatmentsCsv(@CurrentUser() user: UserDto, @Query() filter: AnalyticsFilterDto): Promise<string> {
    return toCsv((await this.exports.treatments(user.farmId, filter)).map(flattenExportDto), TREATMENT_COLUMNS);
  }
}
