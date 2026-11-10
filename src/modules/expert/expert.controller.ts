import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../domain/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { DatasetExportQuery, ListCasesQuery } from './dto/list-cases.query';
import { CreateLabelDto, ResolveCaseDto } from './dto/label.dto';
import { ExpertCaseQueryService } from './expert-case-query.service';
import { DatasetService, NDJSON_CONTENT_TYPE } from './dataset.service';
import { LabelingService } from './labeling.service';
import { QualityMetricsService } from './quality-metrics.service';
import { ExpertRequest, farmScope } from './farm-scope';

@ApiTags('expert')
@ApiBearerAuth()
@Controller('expert')
export class ExpertController {
  constructor(
    private readonly queries: ExpertCaseQueryService,
    private readonly labeling: LabelingService,
    private readonly dataset: DatasetService,
    private readonly metrics: QualityMetricsService,
  ) {}

  @Get('cases') @Roles(Role.Expert, Role.ChiefAgronomist)
  @ApiOperation({ summary: 'Disputed-case queue ordered by priority then age' })
  list(@Query() query: ListCasesQuery, @Req() req: ExpertRequest) {
    return this.queries.list(query, farmScope(req));
  }

  @Get('cases/:id') @Roles(Role.Expert, Role.ChiefAgronomist)
  get(@Param('id', ParseUUIDPipe) id: string, @Req() req: ExpertRequest) {
    return this.queries.get(id, farmScope(req));
  }

  @Post('cases/:id/claim') @Roles(Role.Expert) @HttpCode(200)
  async claim(@Param('id', ParseUUIDPipe) id: string, @Req() req: ExpertRequest) {
    return this.queries.toDto(await this.labeling.claim(id, req.user.id));
  }

  @Post('cases/:id/labels') @Roles(Role.Expert)
  @ApiOperation({ summary: 'Confirm, change, reject or propose a new class; optional lesion region (normalised coords)' })
  async addLabel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateLabelDto, @Req() req: ExpertRequest) {
    const label = await this.labeling.addLabel(id, req.user.id, dto);
    return { id: label.id, action: label.action, diagnosisId: label.diagnosisId, weight: label.weight, newClassProposalId: label.newClassProposalId };
  }

  @Post('cases/:id/resolve') @Roles(Role.Expert) @HttpCode(200)
  async resolve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveCaseDto, @Req() req: ExpertRequest) {
    return this.queries.toDto(await this.labeling.resolve(id, req.user.id, dto.finalDiagnosisId));
  }

  @Get('dataset/stats') @Roles(Role.Expert, Role.ChiefAgronomist)
  datasetStats() {
    return this.dataset.stats();
  }

  @Get('dataset/export') @Roles(Role.Expert) @Header('Content-Type', NDJSON_CONTENT_TYPE)
  async datasetExport(@Query() query: DatasetExportQuery): Promise<string> {
    const { manifest, records } = await this.dataset.export(query.since ? new Date(query.since) : undefined);
    return [{ manifest }, ...records].map((line) => JSON.stringify(line)).join('\n');
  }

  @Get('metrics') @Roles(Role.Expert, Role.ChiefAgronomist)
  @ApiOperation({ summary: 'Share of cases sent to an expert and the expert confirmation rate' })
  qualityMetrics(@Req() req: ExpertRequest) {
    return this.metrics.metrics(farmScope(req));
  }
}
