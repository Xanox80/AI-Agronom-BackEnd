import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Role } from '../../../domain/enums';
import { AuthUser } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TreatmentPlanService } from './treatment-plan.service';
import { TreatmentPlanDto } from './treatment-plan.types';

const TANK_MIN_L = 50;
const TANK_MAX_L = 20000;

export class TreatmentPlanRequestDto {
  @ApiPropertyOptional({ description: 'Sprayer tank volume, l; defaults to TREATMENT_PLAN_DEFAULT_TANK_L', minimum: TANK_MIN_L, maximum: TANK_MAX_L })
  @IsOptional() @IsNumber() @Min(TANK_MIN_L) @Max(TANK_MAX_L) tankVolumeL?: number;
}

@ApiTags('recommendations')
@ApiBearerAuth()
@Controller()
export class TreatmentPlanController {
  constructor(private readonly service: TreatmentPlanService) {}

  @Post('recommendations/:id/treatment-plan')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.Scout, Role.ChiefAgronomist)
  @ApiOperation({ summary: 'Treatment course from a Groq language model, checked against the registry, with tank proportions' })
  generate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TreatmentPlanRequestDto): Promise<TreatmentPlanDto> {
    return this.service.generate(user.farmId, id, dto.tankVolumeL);
  }
}
