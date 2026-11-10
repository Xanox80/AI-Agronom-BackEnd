import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ExpertCaseStatus, LabelAction, LabelSource } from '../../domain/enums';
import { LabelingService } from './labeling.service';

function build(options: { status?: ExpertCaseStatus; weight?: number; labels?: object[]; assignedTo?: string | null } = {}) {
  const expertCase = { id: 'c1', observationId: 'o1', diagnosisResultId: 'r1', status: options.status ?? ExpertCaseStatus.Open, assignedExpertId: options.assignedTo ?? null };
  const savedLabels: object[] = [];
  const savedCases: object[] = [];
  const savedProposals: object[] = [];
  const deleteProposal = jest.fn();
  const existingLabels = options.labels ?? [];
  const labels = {
    findOne: jest.fn().mockResolvedValue(null), create: (x: object) => ({ id: 'l1', ...x }),
    save: jest.fn(async (x: object) => { savedLabels.push(x); existingLabels.push(x); return x; }),
    find: jest.fn(async () => existingLabels), exist: jest.fn(async () => true), update: jest.fn(),
  };
  const service = new LabelingService(
    { save: jest.fn(async (x: object) => { savedCases.push(x); return x; }) } as never, labels as never,
    { findOneByOrFail: jest.fn().mockResolvedValue({ id: 'e1', role: 'expert', trustWeight: 3 }) } as never,
    { findOne: jest.fn().mockResolvedValue({ diagnosisId: 'top' }) } as never,
    { create: (x: object) => x, save: jest.fn(async (x: object) => { savedProposals.push(x); return { id: 'p1', ...x }; }), delete: deleteProposal } as never,
    { getOrFail: jest.fn().mockResolvedValue(expertCase) } as never,
    { weightFor: () => options.weight ?? 3, sourceFor: () => LabelSource.Expert } as never,
    { get: () => ({ expertConsensusMinWeight: 3 }) } as never,
  );
  return { service, labels, savedLabels, savedCases, savedProposals, deleteProposal };
}

describe('LabelingService', () => {
  it('confirms the model top diagnosis with the labeler weight and resolves on consensus', async () => {
    const { service, savedLabels, savedCases, labels } = build();
    await service.addLabel('c1', 'e1', { action: LabelAction.Confirm });
    expect(savedLabels[0]).toMatchObject({ diagnosisId: 'top', weight: 3, labelSource: LabelSource.Expert });
    expect(savedCases.at(-1)).toMatchObject({ status: ExpertCaseStatus.Resolved });
    expect(labels.update).toHaveBeenCalledWith(expect.objectContaining({ diagnosisId: 'top' }), { inDataset: true });
  });

  it('keeps the case open while the summed weight is below the minimum', async () => {
    const { service, savedCases } = build({ weight: 1 });
    await service.addLabel('c1', 'e1', { action: LabelAction.Change, diagnosisId: 'other' });
    expect(savedCases).not.toContainEqual(expect.objectContaining({ status: ExpertCaseStatus.Resolved }));
  });

  it('creates a catalogue proposal when adding a new class', async () => {
    const { service, savedProposals, savedLabels } = build({ weight: 1 });
    const newClass = { code: 'new_rust', nameUk: 'x', nameEn: 'y', problemCategory: 'disease', cropIds: [] };
    await service.addLabel('c1', 'e1', { action: LabelAction.AddNewClass, newClass: newClass as never });
    expect(savedProposals[0]).toMatchObject({ entityType: 'diagnosis', operation: 'create', payload: newClass });
    expect(savedLabels[0]).toMatchObject({ newClassProposalId: 'p1', diagnosisId: null });
  });

  it('rejects labels on resolved cases', async () => {
    await expect(build({ status: ExpertCaseStatus.Resolved }).service.addLabel('c1', 'e1', { action: LabelAction.Confirm }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('resolves with the given final diagnosis', async () => {
    const { service, savedCases } = build({ weight: 1, assignedTo: 'e1' });
    await service.resolve('c1', 'e1', 'final');
    expect(savedCases[0]).toMatchObject({ status: ExpertCaseStatus.Resolved });
  });

  it('forbids labelling or resolving a case claimed by another expert', async () => {
    const { service } = build({ assignedTo: 'other' });
    await expect(service.addLabel('c1', 'e1', { action: LabelAction.Confirm })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.resolve('c1', 'e1', 'final')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('claims an unclaimed case on the first label', async () => {
    const { service, savedCases } = build({ weight: 1 });
    await service.addLabel('c1', 'e1', { action: LabelAction.Change, diagnosisId: 'x' });
    expect(savedCases[0]).toMatchObject({ status: ExpertCaseStatus.InReview, assignedExpertId: 'e1' });
  });

  it('drops the catalogue proposal when the label cannot be saved', async () => {
    const { service, labels, deleteProposal } = build({ weight: 1 });
    labels.save.mockRejectedValueOnce(new Error('db down'));
    const newClass = { code: 'n', nameUk: 'x', nameEn: 'y', problemCategory: 'disease', cropIds: [] };
    await expect(service.addLabel('c1', 'e1', { action: LabelAction.AddNewClass, newClass: newClass as never })).rejects.toThrow('db down');
    expect(deleteProposal).toHaveBeenCalledWith('p1');
  });

  it('claims an open case for the expert', async () => {
    const { service, savedCases } = build();
    await service.claim('c1', 'e1');
    expect(savedCases[0]).toMatchObject({ status: ExpertCaseStatus.InReview, assignedExpertId: 'e1' });
  });
});
