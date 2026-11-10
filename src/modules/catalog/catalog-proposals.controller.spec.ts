import { ProposalEntityType, ProposalOperation, Role } from '../../domain/enums';
import { createCatalogContext } from './__fixtures__/catalog-test-context';
import { CatalogProposalsController } from './catalog-proposals.controller';
import { ReferenceImageFileService } from './reference-image-file.service';

const user = { id: 'u-expert', role: Role.Expert } as never;

describe('CatalogProposalsController', () => {
  let ctx: Awaited<ReturnType<typeof createCatalogContext>>;
  let controller: CatalogProposalsController;
  beforeEach(async () => {
    ctx = await createCatalogContext();
    const files = { store: jest.fn().mockResolvedValue('abc.jpg') } as unknown as ReferenceImageFileService;
    controller = new CatalogProposalsController(ctx.proposals, files);
  });
  afterEach(() => ctx.dataSource.destroy());

  it('turns an uploaded image into a pending reference image proposal', async () => {
    const dto = { diagnosisId: 'd1', caption: 'c', attribution: 'a' };
    const proposal = await controller.uploadReferenceImage({} as never, dto, user);
    expect(proposal).toMatchObject({ entityType: ProposalEntityType.ReferenceImage, operation: ProposalOperation.Create, status: 'pending' });
    expect(proposal.payload.storageKey).toBe('abc.jpg');
  });

  it('lists proposals', async () => {
    expect((await controller.list({ page: 1, pageSize: 10 })).total).toBe(0);
  });
});
