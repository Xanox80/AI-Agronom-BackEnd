import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../domain/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { FeedbackDto } from './dto/label.dto';
import type { ExpertRequest } from './farm-scope';
import { UserFeedbackService } from './user-feedback.service';

@ApiTags('expert')
@ApiBearerAuth()
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: UserFeedbackService) {}

  @Post() @Roles(Role.Scout, Role.ChiefAgronomist) @HttpCode(204)
  @ApiOperation({ summary: 'User label with the user trust weight; a disagreement opens an expert case' })
  async submit(@Body() dto: FeedbackDto, @Req() req: ExpertRequest): Promise<void> {
    await this.feedback.record({
      observationId: dto.observationId, userId: req.user.id, farmId: req.user.farmId,
      finalDiagnosisId: dto.finalDiagnosisId, correctedFromModel: dto.correctedFromModel,
    });
  }
}
