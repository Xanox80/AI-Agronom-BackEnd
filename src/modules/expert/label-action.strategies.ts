import { BadRequestException } from '@nestjs/common';
import { LabelAction } from '../../domain/enums';
import type { CreateLabelDto } from './dto/label.dto';

export interface LabelTarget { diagnosisId: string | null; proposeNewClass: boolean }

export interface LabelActionContext { dto: CreateLabelDto; modelTopDiagnosisId: string | null }

const requireId = (id: string | null | undefined, message: string): string => {
  if (!id) throw new BadRequestException(message);
  return id;
};

/** One strategy per label action: decides which catalogue diagnosis the label points at. */
export const LABEL_ACTION_STRATEGIES: Record<LabelAction, (ctx: LabelActionContext) => LabelTarget> = {
  [LabelAction.Confirm]: ({ modelTopDiagnosisId }) => ({
    diagnosisId: requireId(modelTopDiagnosisId, 'The model top hypothesis has no catalogue diagnosis to confirm'), proposeNewClass: false,
  }),
  [LabelAction.Change]: ({ dto }) => ({ diagnosisId: requireId(dto.diagnosisId, 'diagnosisId is required to change a diagnosis'), proposeNewClass: false }),
  [LabelAction.AddNewClass]: ({ dto }) => {
    requireId(dto.newClass?.code, 'newClass is required to add a new class');
    return { diagnosisId: null, proposeNewClass: true };
  },
  [LabelAction.Reject]: () => ({ diagnosisId: null, proposeNewClass: false }),
};
