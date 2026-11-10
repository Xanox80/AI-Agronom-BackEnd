import { ExportLookup } from './export-lookup.service';

describe('ExportLookup', () => {
  const repo = (rows: unknown[]) => ({ find: jest.fn().mockResolvedValue(rows) });
  const build = (overrides: { users?: unknown[]; photos?: unknown[] } = {}) => {
    const users = repo(overrides.users ?? []);
    const lookup = new ExportLookup(
      repo([{ id: 'c1', code: 'wheat' }]) as never, repo([{ id: 'd1', code: 'rust' }]) as never,
      users as never, repo([{ id: 'p1', name: 'Prod' }]) as never, repo(overrides.photos ?? []) as never,
    );
    return { lookup, users };
  };

  it('maps crop and diagnosis ids to codes', async () => {
    const { lookup } = build();
    expect(await lookup.cropCodes()).toEqual(new Map([['c1', 'wheat']]));
    expect(await lookup.diagnosisCodes()).toEqual(new Map([['d1', 'rust']]));
  });

  it('resolves users within the farm and skips the query for no ids', async () => {
    const { lookup, users } = build({ users: [{ id: 'u1', email: 'a@b.c', displayName: 'A' }] });
    expect(await lookup.userIdentities('farm', ['u1'])).toEqual(new Map([['u1', { email: 'a@b.c', displayName: 'A' }]]));
    expect((await lookup.userIdentities('farm', [])).size).toBe(0);
    expect(users.find).toHaveBeenCalledTimes(1);
  });

  it('groups photo ids by observation', async () => {
    const { lookup } = build({ photos: [
      { id: 'ph1', observationId: 'o1' }, { id: 'ph2', observationId: 'o1' }, { id: 'ph3', observationId: 'o2' },
    ] });
    expect(await lookup.photoIdsByObservation('farm', ['o1', 'o2'])).toEqual(new Map([['o1', ['ph1', 'ph2']], ['o2', ['ph3']]]));
  });

  it('looks products up by id', async () => {
    expect((await build().lookup.productsById(['p1'])).get('p1')).toMatchObject({ name: 'Prod' });
  });
});
