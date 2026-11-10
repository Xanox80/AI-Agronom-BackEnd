import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../domain/enums';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TreatmentQueryDto } from './dto/task-query.dto';
import { CreateTreatmentDto } from './dto/treatment-input.dto';
import { TaskActor } from './task-actor';
import { TreatmentsService } from './treatments.service';

type AuthedRequest = { user: TaskActor };

@ApiTags('treatments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('treatments')
export class TreatmentsController {
  constructor(private readonly treatments: TreatmentsService) {}

  @Get() list(@Req() req: AuthedRequest, @Query() query: TreatmentQueryDto) { return this.treatments.list(req.user, query); }

  @Post() @Roles(Role.Scout, Role.ChiefAgronomist)
  create(@Req() req: AuthedRequest, @Body() dto: CreateTreatmentDto) { return this.treatments.create(req.user, dto); }
}
