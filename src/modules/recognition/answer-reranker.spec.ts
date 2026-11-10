import { AnswerType } from '../../domain/enums';
import { QuestionDto } from '../../domain/types';
import { rerankWithAnswers } from './answer-reranker';
import { AggregatedHypothesis } from './multi-frame-aggregator.service';

const hyp = (diagnosisCode: string, rawProbability: number): AggregatedHypothesis => (
  { diagnosisCode, rawProbability, stage: null, evidence: '', region: null });
const question: QuestionDto = { id: 'halo', textUk: '', textEn: '', answerType: AnswerType.YesNo, narrowsDiagnosisCodes: ['septoria'] };

describe('rerankWithAnswers', () => {
  const hypotheses = [hyp('rust', 0.3), hyp('septoria', 0.25)];

  it('promotes the classes a "yes" answer supports', () => {
    const ranked = rerankWithAnswers(hypotheses, [question], { halo: 'yes' }, 2);
    expect(ranked[0].diagnosisCode).toBe('septoria');
    expect(ranked[0].rawProbability).toBeCloseTo(0.5);
  });

  it('demotes the classes a "no" answer rules out', () => {
    const ranked = rerankWithAnswers(hypotheses, [question], { halo: 'no' }, 2);
    expect(ranked.find((h) => h.diagnosisCode === 'septoria')?.rawProbability).toBeCloseTo(0.125);
  });

  it('caps the total mass at 1', () => {
    const ranked = rerankWithAnswers([hyp('rust', 0.3), hyp('septoria', 0.6)], [question], { halo: 'yes' }, 2);
    expect(ranked.reduce((total, h) => total + h.rawProbability, 0)).toBeCloseTo(1);
  });

  it('changes nothing when no question is answered', () => {
    expect(rerankWithAnswers(hypotheses, [question], {}, 2).map((h) => h.rawProbability)).toEqual([0.3, 0.25]);
  });

  it('ignores an "unsure" answer', () => {
    expect(rerankWithAnswers(hypotheses, [question], { halo: 'unsure' }, 2).map((h) => h.rawProbability)).toEqual([0.3, 0.25]);
  });

  it('promotes the chosen class of a choice question and demotes its alternatives', () => {
    const choice: QuestionDto = { ...question, id: 'spots', answerType: AnswerType.Choice, narrowsDiagnosisCodes: ['rust', 'septoria'] };
    const ranked = rerankWithAnswers(hypotheses, [choice], { spots: 'septoria' }, 2);
    expect(ranked[0].diagnosisCode).toBe('septoria');
    expect(ranked.find((h) => h.diagnosisCode === 'rust')?.rawProbability).toBeCloseTo(0.15);
  });

  it('ignores a choice that names no narrowed class', () => {
    const choice: QuestionDto = { ...question, answerType: AnswerType.Choice, narrowsDiagnosisCodes: ['rust', 'septoria'] };
    expect(rerankWithAnswers(hypotheses, [choice], { halo: 'other' }, 2).map((h) => h.rawProbability)).toEqual([0.3, 0.25]);
  });
});
