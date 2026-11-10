import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ObservationDto, Page } from '../../domain/types';
import { ListObservationsQuery } from './dto/list-observations.query';
import { AuthUser, CurrentUser } from './observation-access';
import { ObservationsService } from './observations.service';

@ApiTags('observations')
@ApiBearerAuth()
@Controller('fields/:fieldId/observations')
export class FieldHistoryController {
  constructor(private readonly observations: ObservationsService) {}

  @Get()
  @ApiOperation({ summary: 'Observation history of a field, newest first (scenario step 7)' })
  history(@CurrentUser() user: AuthUser, @Param('fieldId', ParseUUIDPipe) fieldId: string, @Query() query: ListObservationsQuery): Promise<Page<ObservationDto>> {
    return this.observations.list(user, { ...query, fieldId });
  }
}
