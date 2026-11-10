import { AnswerType } from '../../domain/enums';
import { QuestionDto } from '../../domain/types';
import { VisionQuestion } from '../vision-provider/vision.types';

export interface QuestionSelection {
  providerQuestions: VisionQuestion[];
  catalogQuestions: QuestionDto[];
  hypothesisCodes: string[];
  needed: boolean;
  answeredIds: string[];
}

/** FR-11: when the top classes are close or the result is unsure, ask what would separate them. */
export function selectClarifyingQuestions(selection: QuestionSelection): QuestionDto[] {
  if (!selection.needed) return [];
  const provided: QuestionDto[] = selection.providerQuestions.map((q) => ({ ...q, answerType: q.answerType as AnswerType }));
  const byId = new Map<string, QuestionDto>();
  [...provided, ...selection.catalogQuestions].forEach((question) => {
    if (!byId.has(question.id)) byId.set(question.id, question);
  });
  return [...byId.values()].filter(
    (question) => !selection.answeredIds.includes(question.id)
      && question.narrowsDiagnosisCodes.some((code) => selection.hypothesisCodes.includes(code)),
  );
}
