import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../domain/enums';
import { FarmDto } from '../../../domain/types';
import { AuthUser } from '../auth.types';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { UpdateFarmDto } from '../dto/farm-audit.dto';
import { FarmsService } from './farms.service';

@ApiTags('farms')
@ApiBearerAuth()
@Controller('farms')
export class FarmsController {
  constructor(private readonly farms: FarmsService) {}

  @Get('me')
  get(@CurrentUser() user: AuthUser): Promise<FarmDto> {
    return this.farms.get(user.farmId);
  }

  @Roles(Role.ChiefAgronomist)
  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateFarmDto): Promise<FarmDto> {
    return this.farms.update(user.farmId, dto);
  }
}
