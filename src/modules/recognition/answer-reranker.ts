import { QuestionDto } from '../../domain/types';
import { AggregatedHypothesis } from './multi-frame-aggregator.service';

const YES = 'yes';
const NO = 'no';

/**
 * FR-11: a yes/no answer scales the classes the question narrows up ("yes") or down ("no"); a choice answer
 * promotes the narrowed class named by the chosen option and demotes the other narrowed classes.
 * Any other answer, "unsure" included, says nothing. The total is capped at 1 so scores stay probabilities.
 */
export function rerankWithAnswers(
  hypotheses: AggregatedHypothesis[],
  questions: QuestionDto[],
  answers: Record<string, string>,
  factor: number,
): AggregatedHypothesis[] {
  const weights = new Map<string, number>();
  questions.filter((question) => answers[question.id] !== undefined).forEach((question) => {
    codeWeights(question, answers[question.id], factor).forEach((weight, code) => weights.set(code, (weights.get(code) ?? 1) * weight));
  });
  const scaled = hypotheses.map((h) => ({ ...h, rawProbability: h.rawProbability * (weights.get(h.diagnosisCode) ?? 1) }));
  const total = scaled.reduce((acc, h) => acc + h.rawProbability, 0);
  const capped = total > 1 ? scaled.map((h) => ({ ...h, rawProbability: h.rawProbability / total })) : scaled;
  return capped.sort((a, b) => b.rawProbability - a.rawProbability);
}

function codeWeights(question: QuestionDto, answer: string, factor: number): Map<string, number> {
  const weights = new Map<string, number>();
  const narrowed = question.narrowsDiagnosisCodes;
  if (question.answerType === 'yes_no') {
    if (answer === YES || answer === NO) narrowed.forEach((code) => weights.set(code, answer === YES ? factor : 1 / factor));
  } else if (narrowed.includes(answer)) {
    narrowed.forEach((code) => weights.set(code, code === answer ? factor : 1 / factor));
  }
  return weights;
}
