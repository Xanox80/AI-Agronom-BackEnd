import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserDto } from '../../domain/types';
import { CurrentUser, JwtAuthGuard, RolesGuard } from './auth-bindings';
import { AnalyticsFilterDto } from './dto/analytics-filter.dto';
import { HeatmapResponseDto, SummaryResponseDto } from './dto/analytics-response.dto';
import { HeatmapService } from './heatmap.service';
import { SummaryService } from './summary.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly heatmap: HeatmapService, private readonly summary: SummaryService) {}

  @Get('heatmap')
  @ApiOperation({ summary: 'Weighted problem points per field and season (FR-23)' })
  @ApiOkResponse({ type: HeatmapResponseDto })
  getHeatmap(@CurrentUser() user: UserDto, @Query() filter: AnalyticsFilterDto): Promise<HeatmapResponseDto> {
    return this.heatmap.build(user.farmId, filter);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Observation counts by diagnosis, field and week' })
  @ApiOkResponse({ type: SummaryResponseDto })
  getSummary(@CurrentUser() user: UserDto, @Query() filter: AnalyticsFilterDto): Promise<SummaryResponseDto> {
    return this.summary.build(user.farmId, filter);
  }
}
