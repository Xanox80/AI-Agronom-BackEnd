import { UserDto } from '../../domain/types';
import { FileExportController } from './file-export.controller';

describe('FileExportController', () => {
  const user = { farmId: 'farm-1' } as UserDto;
  const task = { schemaVersion: 1, externalIds: { scoutId: 't1' }, title: 'Spray', lat: 50, lng: 30 };
  const exports = {
    observations: jest.fn().mockResolvedValue([]),
    tasks: jest.fn().mockResolvedValue([task]),
    treatments: jest.fn().mockResolvedValue([]),
    fields: jest.fn().mockResolvedValue([]),
  };
  const controller = new FileExportController(exports as never);

  it('writes the header row even when there are no observations', async () => {
    const csv = await controller.observationsCsv(user, {});
    expect(csv.startsWith('scoutId,agronomistId,schemaVersion,fieldScoutId')).toBe(true);
    expect(exports.observations).toHaveBeenCalledWith('farm-1', {});
  });

  it('writes task rows under the task header', async () => {
    const [header, row] = (await controller.tasksCsv(user, {})).split('\r\n');
    expect(header.split(',')).toContain('title');
    expect(row).toContain('t1');
  });

  it('writes the treatment header for an empty selection', async () => {
    expect(await controller.treatmentsCsv(user, {})).toContain('productRegistrationNumber');
  });

  it('wraps tasks into a GeoJSON feature collection', async () => {
    const collection = await controller.tasksGeojson(user, {});
    expect(collection.type).toBe('FeatureCollection');
    expect(collection.features).toHaveLength(1);
  });

  it('returns empty collections for fields and observations without rows', async () => {
    expect((await controller.fieldsGeojson(user)).features).toEqual([]);
    expect((await controller.observationsGeojson(user, {})).features).toEqual([]);
  });
});
