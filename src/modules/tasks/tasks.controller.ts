import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../domain/enums';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CompleteTaskDto, CreateTaskDto, UpdateTaskDto } from './dto/task-input.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { TaskActor } from './task-actor';
import { TasksService } from './tasks.service';

type AuthedRequest = { user: TaskActor };

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get() list(@Req() req: AuthedRequest, @Query() query: TaskQueryDto) { return this.tasks.list(req.user, query); }

  @Get(':id') get(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) { return this.tasks.get(req.user, id); }

  @Post() @Roles(Role.Scout, Role.ChiefAgronomist)
  create(@Req() req: AuthedRequest, @Body() dto: CreateTaskDto) { return this.tasks.create(req.user, dto); }

  // Mechanics are assignees: the service lets them change status only.
  @Patch(':id') @Roles(Role.Scout, Role.ChiefAgronomist, Role.Mechanic)
  update(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto) {
    return this.tasks.update(req.user, id, dto);
  }

  @Post(':id/complete') @HttpCode(200) @Roles(Role.Scout, Role.ChiefAgronomist)
  complete(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CompleteTaskDto) {
    return this.tasks.complete(req.user, id, dto);
  }

  @Delete(':id') @HttpCode(204) @Roles(Role.ChiefAgronomist)
  remove(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) { return this.tasks.remove(req.user, id); }
}
