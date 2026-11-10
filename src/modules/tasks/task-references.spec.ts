import { BadRequestException } from '@nestjs/common';
import { TaskReferences } from './task-references';

function build(found = { observation: true, recommendation: true, diagnosis: true }) {
  const repo = (ok: boolean) => ({ exist: jest.fn().mockResolvedValue(ok) });
  const obs = repo(found.observation);
  const rec = repo(found.recommendation);
  const diag = repo(found.diagnosis);
  return { references: new TaskReferences(obs as never, rec as never, diag as never, { find: jest.fn().mockResolvedValue([{ id: 'p1' }]) } as never), obs, rec };
}

describe('TaskReferences', () => {
  it('accepts a task without references without querying', async () => {
    const { references, obs } = build();
    await expect(references.validate('farm-1', {})).resolves.toBeUndefined();
    expect(obs.exist).not.toHaveBeenCalled();
  });

  it('scopes observation and recommendation lookups to the farm', async () => {
    const { references, obs, rec } = build();
    await references.validate('farm-1', { observationId: 'o1', recommendationId: 'r1' });
    expect(obs.exist).toHaveBeenCalledWith({ where: { id: 'o1', farmId: 'farm-1' } });
    expect(rec.exist).toHaveBeenCalledWith({ where: { id: 'r1', farmId: 'farm-1', status: 'approved' } });
  });

  it('lists the photo ids of the linked observation', async () => {
    await expect(build().references.observationPhotoIds('o1')).resolves.toEqual(['p1']);
  });

  it.each([
    [{ observation: false, recommendation: true, diagnosis: true }, { observationId: 'o1' }],
    [{ observation: true, recommendation: false, diagnosis: true }, { recommendationId: 'r1' }],
    [{ observation: true, recommendation: true, diagnosis: false }, { diagnosisId: 'd1' }],
  ])('rejects an unknown reference', async (found, dto) => {
    await expect(build(found).references.validate('farm-1', dto)).rejects.toBeInstanceOf(BadRequestException);
  });
});
