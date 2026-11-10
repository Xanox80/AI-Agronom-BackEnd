import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DiagnosisPass, Role } from '../../domain/enums';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RecognitionResultDto } from './diagnosis-presenter.service';
import { DiagnoseRequestDto } from './dto/diagnose-request.dto';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
import { RecognitionService, RecognitionStatusDto } from './recognition.service';

@ApiTags('recognition')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller()
export class RecognitionController {
  constructor(private readonly recognition: RecognitionService) {}

  @Post('observations/:id/diagnose')
  @HttpCode(200)
  @Roles(Role.Scout, Role.ChiefAgronomist, Role.Mechanic, Role.Expert)
  @ApiOperation({ summary: 'Run the multi-frame diagnosis over all photos of the observation (pass initial)' })
  diagnose(@Param('id', ParseUUIDPipe) id: string, @Body() body: DiagnoseRequestDto, @CurrentUser() user: AuthUser): Promise<RecognitionResultDto> {
    return this.recognition.diagnose(id, user.farmId, DiagnosisPass.Initial, body.locale);
  }

  @Post('observations/:id/refine')
  @HttpCode(200)
  @Roles(Role.Scout, Role.ChiefAgronomist)
  @ApiOperation({ summary: 'Server refinement after sync (pass server_refined, FR-26)' })
  refine(@Param('id', ParseUUIDPipe) id: string, @Body() body: DiagnoseRequestDto, @CurrentUser() user: AuthUser): Promise<RecognitionResultDto> {
    return this.recognition.diagnose(id, user.farmId, DiagnosisPass.ServerRefined, body.locale);
  }

  @Get('observations/:id/diagnosis')
  @ApiOperation({ summary: 'Latest diagnosis of the observation' })
  latest(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser): Promise<RecognitionResultDto> {
    return this.recognition.latest(id, user.farmId);
  }

  @Post('diagnoses/:resultId/answers')
  @HttpCode(200)
  @Roles(Role.Scout, Role.ChiefAgronomist, Role.Mechanic)
  @ApiOperation({ summary: 'Answer clarifying questions; the diagnosis is re-run and re-ranked (FR-11)' })
  answer(@Param('resultId', ParseUUIDPipe) resultId: string, @Body() body: SubmitAnswersDto, @CurrentUser() user: AuthUser): Promise<RecognitionResultDto> {
    return this.recognition.answer(resultId, user.farmId, body.answers);
  }

  @Get('recognition/status')
  @ApiOperation({ summary: 'Provider, model, thresholds and calibration temperature (no secrets)' })
  status(): RecognitionStatusDto {
    return this.recognition.status();
  }
}
