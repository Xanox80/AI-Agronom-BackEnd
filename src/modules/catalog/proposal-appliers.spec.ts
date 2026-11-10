import { NotFoundException } from '@nestjs/common';
import { CatalogChangeProposalEntity, CatalogDiagnosisEntity, CropEntity, ProductEntity } from '../../domain/entities';
import { ProposalEntityType, ProposalOperation, ProposalStatus, Role } from '../../domain/enums';
import { createCatalogContext } from './__fixtures__/catalog-test-context';
import { PROPOSAL_APPLIERS } from './proposal-appliers';

const chief = { id: 'u-chief', role: Role.ChiefAgronomist };

describe('proposal appliers', () => {
  let ctx: Awaited<ReturnType<typeof createCatalogContext>>;
  beforeEach(async () => { ctx = await createCatalogContext(); });
  afterEach(() => ctx.dataSource.destroy());

  it('has one applier per proposal entity type', () => {
    expect(Object.keys(PROPOSAL_APPLIERS).sort()).toEqual(Object.values(ProposalEntityType).sort());
  });

  it('ignores server-owned and unknown payload fields', async () => {
    const proposals = ctx.repo(CatalogChangeProposalEntity);
    const p = await proposals.save(proposals.create({
      entityType: ProposalEntityType.Product, operation: ProposalOperation.Create, status: ProposalStatus.Pending, proposedByUserId: chief.id,
      payload: { name: 'X', id: 'forced-id', isDemo: true, version: 99, injected: 'x' },
    }));
    await ctx.proposals.approve(p.id, chief.id);
    const row = await ctx.repo(ProductEntity).findOneByOrFail({ name: 'X' });
    expect(row).toMatchObject({ isDemo: false, version: 2 });
    expect(row.id).not.toBe('forced-id');
  });

  it('rejects server-owned and unknown payload fields at proposal time', async () => {
    await expect(ctx.proposals.create({
      entityType: ProposalEntityType.Product, operation: ProposalOperation.Create, payload: { name: 'X', isDemo: true },
    }, chief)).rejects.toMatchObject({ response: { code: 'INVALID_PROPOSAL_PAYLOAD' } });
  });

  it('updates an existing row and keeps untouched columns', async () => {
    const crop = await ctx.repo(CropEntity).findOneByOrFail({ code: 'maize' });
    const p = await ctx.proposals.create({
      entityType: ProposalEntityType.Crop, entityId: crop.id, operation: ProposalOperation.Update, payload: { nameEn: 'Corn' },
    }, chief);
    await ctx.proposals.approve(p.id, chief.id);
    expect(await ctx.repo(CropEntity).findOneByOrFail({ id: crop.id })).toMatchObject({ nameEn: 'Corn', nameUk: crop.nameUk });
  });

  it('links crops of a new diagnosis from cropIds', async () => {
    const maize = await ctx.repo(CropEntity).findOneByOrFail({ code: 'maize' });
    const p = await ctx.proposals.create({
      entityType: ProposalEntityType.Diagnosis, operation: ProposalOperation.Create,
      payload: { code: 'new_class', nameUk: 'Нова', nameEn: 'New', problemCategory: 'disease', typicalOrgans: [], clarifyingQuestions: [], cropIds: [maize.id] },
    }, chief);
    await ctx.proposals.approve(p.id, chief.id);
    const saved = await ctx.repo(CatalogDiagnosisEntity).findOneOrFail({ where: { code: 'new_class' }, relations: { crops: true } });
    expect(saved.crops.map((c) => c.id)).toEqual([maize.id]);
  });

  it('fails with not found when the target row of an update does not exist', async () => {
    const p = await ctx.proposals.create({
      entityType: ProposalEntityType.Crop, entityId: 'missing', operation: ProposalOperation.Delete, payload: {},
    }, chief);
    await expect(ctx.proposals.approve(p.id, chief.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});
