import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ProductEntity } from '../../domain/entities';
import { DomainEvent } from '../../domain/events';
import { ProposalEntityType, ProposalOperation, ProposalStatus, Role } from '../../domain/enums';
import { createCatalogContext, TEST_REGION } from './__fixtures__/catalog-test-context';
import { APPROVED_PROPOSAL_SOURCE } from './catalog.constants';

const scout = { id: 'u-expert', role: Role.Expert };
const chief = { id: 'u-chief', role: Role.ChiefAgronomist };
const newProduct = { entityType: ProposalEntityType.Product, operation: ProposalOperation.Create, payload: { name: 'Test Product', pollinatorHazard: 'low' } };

describe('CatalogProposalService', () => {
  let ctx: Awaited<ReturnType<typeof createCatalogContext>>;
  beforeEach(async () => { ctx = await createCatalogContext(); });
  afterEach(() => ctx.dataSource.destroy());

  it('lets an expert propose a diagnosis but not a product', async () => {
    const ok = await ctx.proposals.create({ entityType: ProposalEntityType.Diagnosis, operation: ProposalOperation.Create, payload: {} }, scout);
    expect(ok.status).toBe(ProposalStatus.Pending);
    await expect(ctx.proposals.create(newProduct, scout)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires an entity id for update proposals', async () => {
    await expect(ctx.proposals.create({ ...newProduct, operation: ProposalOperation.Update }, chief)).rejects.toMatchObject({ response: { code: 'ENTITY_ID_REQUIRED' } });
  });

  it('applies an approved proposal, bumps the version and publishes the event', async () => {
    const published: unknown[] = [];
    ctx.events.on(DomainEvent.CatalogPublished, (e) => published.push(e));
    const proposal = await ctx.proposals.create(newProduct, chief);

    const approved = await ctx.proposals.approve(proposal.id, chief.id, 'ok');

    expect(approved).toMatchObject({ status: ProposalStatus.Approved, reviewedByUserId: chief.id, reviewComment: 'ok' });
    const row = await ctx.repo(ProductEntity).findOneByOrFail({ name: 'Test Product' });
    expect(row).toMatchObject({ version: 2, isDemo: false, source: APPROVED_PROPOSAL_SOURCE });
    expect(row.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await ctx.status.getStatus(TEST_REGION)).version).toBe(2);
    expect(published).toEqual([{ regionCode: TEST_REGION, version: 2 }]);
  });

  it('does not touch the catalogue when a proposal is rejected', async () => {
    const proposal = await ctx.proposals.create(newProduct, chief);
    const rejected = await ctx.proposals.reject(proposal.id, chief.id, 'not registered');
    expect(rejected.status).toBe(ProposalStatus.Rejected);
    expect(await ctx.repo(ProductEntity).countBy({ name: 'Test Product' })).toBe(0);
    expect((await ctx.status.getStatus(TEST_REGION)).version).toBe(1);
  });

  it('refuses to review a proposal twice', async () => {
    const proposal = await ctx.proposals.create(newProduct, chief);
    await ctx.proposals.reject(proposal.id, chief.id, 'no');
    await expect(ctx.proposals.approve(proposal.id, chief.id)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rolls back the version bump when the payload cannot be stored', async () => {
    const proposal = await ctx.proposals.create({ ...newProduct, payload: { pollinatorHazard: 'low' } }, chief);
    await expect(ctx.proposals.approve(proposal.id, chief.id)).rejects.toMatchObject({ response: { code: 'INVALID_PROPOSAL_PAYLOAD' } });
    expect((await ctx.status.getStatus(TEST_REGION)).version).toBe(1);
  });

  it('lists proposals filtered by status with paging', async () => {
    await ctx.proposals.create(newProduct, chief);
    const rejected = await ctx.proposals.create(newProduct, chief);
    await ctx.proposals.reject(rejected.id, chief.id, 'no');
    const page = await ctx.proposals.list({ status: ProposalStatus.Pending, page: 1, pageSize: 10 });
    expect(page).toMatchObject({ total: 1, page: 1, pageSize: 10 });
  });
});
