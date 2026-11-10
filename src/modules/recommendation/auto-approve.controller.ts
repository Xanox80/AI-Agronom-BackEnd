import { Body, Controller, Ip, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../domain/enums';
import { AutoApproveService } from './auto-approve.service';
import { AutoApproveSettingDto, UpsertAutoApproveSettingDto } from './dto/auto-approve-setting.dto';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('auto-approve-settings')
@ApiBearerAuth()
@Roles(Role.ChiefAgronomist)
@Controller('auto-approve-settings')
export class AutoApproveController {
  constructor(private readonly service: AutoApproveService) {}

  @Get()
  @ApiOperation({ summary: 'List auto-approve rules of the farm' })
  list(@CurrentUser() user: AuthUser): Promise<AutoApproveSettingDto[]> {
    return this.service.list(user.farmId);
  }

  @Put()
  @ApiOperation({ summary: 'Create or update the auto-approve rule for a problem category or diagnosis (FR-19)' })
  upsert(@CurrentUser() user: AuthUser, @Body() dto: UpsertAutoApproveSettingDto, @Ip() ip?: string): Promise<AutoApproveSettingDto> {
    return this.service.upsert(user, dto, ip);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an auto-approve rule' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Ip() ip?: string): Promise<void> {
    return this.service.remove(user, id, ip);
  }
}
