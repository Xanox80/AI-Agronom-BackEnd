import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../domain/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthUser } from '../auth/auth.types';
import { PullQueryDto, StatusQueryDto, PullResponse, SyncStatusResponse } from './dto/pull.dto';
import { PushRequestDto, PushResponseDto } from './dto/push.dto';
import { SyncActor } from './handlers/entity-sync-handler';
import { SyncPullService } from './sync-pull.service';
import { SyncPushService } from './sync-push.service';
import { SyncStatusService } from './sync-status.service';

const toActor = (user: AuthUser): SyncActor => ({ userId: user.id, farmId: user.farmId, role: user.role });

@ApiTags('sync')
@ApiBearerAuth()
@Controller('sync')
export class SyncController {
  constructor(
    private readonly pushService: SyncPushService,
    private readonly pullService: SyncPullService,
    private readonly statusService: SyncStatusService,
  ) {}

  @Post('push') @HttpCode(200) @Roles(Role.Scout, Role.ChiefAgronomist, Role.Mechanic)
  @ApiOperation({ summary: 'Idempotently apply queued offline changes (FR-24)' })
  @ApiOkResponse({ type: PushResponseDto })
  push(@CurrentUser() user: AuthUser, @Body() dto: PushRequestDto): Promise<PushResponseDto> {
    return this.pushService.push(toActor(user), dto);
  }

  @Get('pull')
  @ApiOperation({ summary: 'Changes since a cursor, including server-refined diagnoses (FR-26)' })
  pull(@CurrentUser() user: AuthUser, @Query() query: PullQueryDto): Promise<PullResponse> {
    return this.pullService.pull(toActor(user), query.deviceId, query.since, query.cursor);
  }

  @Get('status')
  @ApiOperation({ summary: 'Pending refinements, last push/pull, catalogue version and client backoff settings' })
  status(@CurrentUser() user: AuthUser, @Query() query: StatusQueryDto): Promise<SyncStatusResponse> {
    return this.statusService.status(toActor(user), query.deviceId);
  }
}
