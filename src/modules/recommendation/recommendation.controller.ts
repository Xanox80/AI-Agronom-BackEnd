import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Ip, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../domain/enums';
import { CreateRecommendationDto, RecomputeRecommendationDto, RejectRecommendationDto } from './dto/recommendation-request.dto';
import { RecommendationDto } from './dto/recommendation.dto';
import { RecommendationService } from './recommendation.service';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

const LOCALE_LENGTH = 2;

const preferredLocale = (header?: string): string | undefined => header?.slice(0, LOCALE_LENGTH).toLowerCase();

@ApiTags('recommendations')
@ApiBearerAuth()
@Controller()
export class RecommendationController {
  constructor(private readonly service: RecommendationService) {}

  @Post('recommendations')
  @Roles(Role.Scout, Role.ChiefAgronomist)
  @ApiOperation({ summary: 'Build a draft recommendation with the rules engine (FR-12..FR-19)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRecommendationDto, @Ip() ip?: string, @Headers('accept-language') language?: string): Promise<RecommendationDto> {
    return this.service.create(user, dto, { ip, locale: preferredLocale(language) });
  }

  @Get('recommendations/:id')
  @ApiOperation({ summary: 'Get a recommendation' })
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<RecommendationDto> {
    return this.service.get(user.farmId, id);
  }

  @Get('observations/:id/recommendations')
  @ApiOperation({ summary: 'List recommendations of an observation' })
  listForObservation(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<RecommendationDto[]> {
    return this.service.listForObservation(user.farmId, id);
  }

  @Post('recommendations/:id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ChiefAgronomist)
  @ApiOperation({ summary: 'Approve a draft recommendation; the approver is written to the audit log' })
  approve(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Ip() ip?: string): Promise<RecommendationDto> {
    return this.service.approve(user, id, { ip });
  }

  @Post('recommendations/:id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ChiefAgronomist)
  @ApiOperation({ summary: 'Reject a draft recommendation with a reason' })
  reject(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectRecommendationDto, @Ip() ip?: string): Promise<RecommendationDto> {
    return this.service.reject(user, id, dto.reason, { ip });
  }

  @Post('recommendations/:id/recompute')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.Scout, Role.ChiefAgronomist)
  @ApiOperation({ summary: 'Recompute a draft with fresh weather, stock and treatment history' })
  recompute(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RecomputeRecommendationDto, @Ip() ip?: string, @Headers('accept-language') language?: string): Promise<RecommendationDto> {
    return this.service.recompute(user, id, dto, { ip, locale: preferredLocale(language) });
  }
}
