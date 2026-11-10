import { BadRequestException, NotFoundException } from '@nestjs/common';
import { testConfig } from './__fixtures__/recognition-fixtures';
import { ObservationContextLoader } from './observation-context-loader.service';

describe('ObservationContextLoader', () => {
  const build = (observation: unknown, photoRows: unknown[]) => {
    const observations = { findOne: jest.fn().mockResolvedValue(observation), find: jest.fn().mockResolvedValue([{ confirmedDiagnosisId: 'd1' }]) };
    const photos = { find: jest.fn().mockResolvedValue(photoRows) };
    const fields = { findOne: jest.fn().mockResolvedValue({ variety: 'v1' }) };
    const catalog = {
      cropCodeById: jest.fn().mockResolvedValue('wheat'),
      diagnosesByCode: jest.fn().mockResolvedValue(new Map([['rust', { id: 'd1', code: 'rust' }]])),
    };
    const config = testConfig({ storageDir: '.' });
    return { loader: new ObservationContextLoader(observations as never, photos as never, fields as never, catalog as never, config), observations };
  };

  it('404s for an observation of another farm', async () => {
    await expect(build(null, []).loader.load('o1', 'f1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an observation without photos', async () => {
    await expect(build({ id: 'o1' }, []).loader.load('o1', 'f1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('loads photo bytes, crop, variety and limited field history', async () => {
    const row = { seq: 1, storageKey: 'package.json', mimeType: 'image/jpeg' };
    const { loader, observations } = build({ id: 'o1', fieldId: 'fl1', cropId: 'c1', bbchStage: 30 }, [row]);
    const frames = await loader.load('o1', 'f1');
    expect(frames.photoSeqs).toEqual([1]);
    expect(frames.context).toMatchObject({ cropCode: 'wheat', bbch: 30, variety: 'v1', fieldHistory: ['rust'] });
    expect(observations.find).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
  });
});
