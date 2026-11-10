import { ProposalEntityType, ProposalOperation } from '../../domain/enums';
import { createCatalogContext } from './__fixtures__/catalog-test-context';
import { ProposalPayloadValidator } from './proposal-payload.validator';

const proposal = (entityType: ProposalEntityType, payload: Record<string, unknown>, operation = ProposalOperation.Create) => ({ entityType, operation, payload });

describe('ProposalPayloadValidator', () => {
  let ctx: Awaited<ReturnType<typeof createCatalogContext>>;
  let validator: ProposalPayloadValidator;
  beforeEach(async () => { ctx = await createCatalogContext(); validator = new ProposalPayloadValidator(ctx.dataSource); });
  afterEach(() => ctx.dataSource.destroy());

  it('accepts columns of the target table and cropIds', () => {
    expect(() => validator.assertValid(proposal(ProposalEntityType.Diagnosis, { code: 'x', cropIds: [] }))).not.toThrow();
  });

  it('rejects unknown and server-owned fields', () => {
    expect(() => validator.assertValid(proposal(ProposalEntityType.Product, { nope: 1 }))).toThrow(/nope/);
    expect(() => validator.assertValid(proposal(ProposalEntityType.Product, { isDemo: true }))).toThrow(/isDemo/);
  });

  it('rejects external and path-like reference image keys', () => {
    for (const storageKey of ['https://evil.example/x.jpg', '../x.jpg', 5]) {
      expect(() => validator.assertValid(proposal(ProposalEntityType.ReferenceImage, { storageKey }))).toThrow(/storageKey/);
    }
    expect(() => validator.assertValid(proposal(ProposalEntityType.ReferenceImage, { storageKey: 'a1b2-c3.jpg' }))).not.toThrow();
  });

  it('skips validation for delete', () => {
    expect(() => validator.assertValid(proposal(ProposalEntityType.Product, { nope: 1 }, ProposalOperation.Delete))).not.toThrow();
  });
});
