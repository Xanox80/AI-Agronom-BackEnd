import { AnswerType } from '../../domain/enums';
import { QuestionDto } from '../../domain/types';
import { selectClarifyingQuestions } from './clarifying-question-selector';

const question = (id: string, narrowsDiagnosisCodes: string[]): QuestionDto => (
  { id, textUk: '', textEn: '', answerType: AnswerType.YesNo, narrowsDiagnosisCodes });

describe('selectClarifyingQuestions', () => {
  const base = {
    providerQuestions: [question('p1', ['rust'])], catalogQuestions: [question('c1', ['septoria']), question('c2', ['maize_smut'])],
    hypothesisCodes: ['rust', 'septoria'], needed: true, answeredIds: [] as string[],
  };

  it('asks nothing when the result is clear', () => {
    expect(selectClarifyingQuestions({ ...base, needed: false })).toEqual([]);
  });

  it('merges provider and catalogue questions, provider first, keeping only those about the hypotheses', () => {
    expect(selectClarifyingQuestions(base).map((q) => q.id)).toEqual(['p1', 'c1']);
  });

  it('does not repeat answered questions or duplicate ids', () => {
    const selected = selectClarifyingQuestions({ ...base, catalogQuestions: [question('p1', ['rust']), question('c1', ['septoria'])], answeredIds: ['c1'] });
    expect(selected.map((q) => q.id)).toEqual(['p1']);
  });
});
