import { RareClassService } from './rare-class.service';
import { buildExpertConfig } from './expert.config';

describe('RareClassService', () => {
  const build = (count: number) =>
    new RareClassService({ count: jest.fn().mockResolvedValue(count) } as never, buildExpertConfig({ EXPERT_RARE_CLASS_MAX_LABELS: '5' }));

  it('treats an unmapped diagnosis as rare', async () => {
    expect(await build(100).isRare(null)).toBe(true);
  });

  it('is rare below the label threshold', async () => {
    expect(await build(4).isRare('d1')).toBe(true);
  });

  it('is not rare at or above the label threshold', async () => {
    expect(await build(5).isRare('d1')).toBe(false);
  });
});
