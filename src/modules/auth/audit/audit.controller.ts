import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../domain/enums';
import { Page } from '../../../domain/types';
import { AuditEntryDto, AuthUser } from '../auth.types';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AuditQueryDto } from '../dto/farm-audit.dto';
import { AuditService } from './audit.service';

@ApiTags('audit')
@ApiBearerAuth()
@Roles(Role.ChiefAgronomist)
@Controller('audit-log')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: AuditQueryDto): Promise<Page<AuditEntryDto>> {
    return this.audit.list(user.farmId, query);
  }
}
