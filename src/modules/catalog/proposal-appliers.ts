import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager, EntityTarget, ObjectLiteral, QueryFailedError } from 'typeorm';
import {
  ActiveSubstanceEntity, CatalogChangeProposalEntity, CatalogDiagnosisEntity, CropEntity, ProductEntity,
  ProductRegistrationEntity, ReferenceImageEntity, ThresholdEntity,
} from '../../domain/entities';
import { ProposalEntityType, ProposalOperation } from '../../domain/enums';
import { APPROVED_PROPOSAL_SOURCE } from './catalog.constants';

export const SERVER_OWNED_COLUMNS = new Set(['id', 'createdAt', 'updatedAt', 'version', 'source', 'sourceRef', 'verifiedAt', 'isDemo']);

export interface ProposalApplier {
  apply(manager: EntityManager, proposal: CatalogChangeProposalEntity, version: number): Promise<void>;
}

/** Applies a create/update/delete proposal to one catalogue table, accepting only that table's own columns. */
export class RepositoryProposalApplier implements ProposalApplier {
  constructor(private readonly target: EntityTarget<ObjectLiteral>) {}

  async apply(manager: EntityManager, proposal: CatalogChangeProposalEntity, version: number): Promise<void> {
    const repo = manager.getRepository(this.target);
    const columns = new Set(repo.metadata.columns.map((c) => c.propertyName));
    const values: ObjectLiteral = Object.fromEntries(
      Object.entries(proposal.payload).filter(([key]) => columns.has(key) && !SERVER_OWNED_COLUMNS.has(key)),
    );
    if (repo.metadata.relations.some((r) => r.propertyName === 'crops') && Array.isArray(proposal.payload.cropIds)) {
      values.crops = (proposal.payload.cropIds as string[]).map((id) => ({ id }));
    }
    const provenance = {
      version, source: APPROVED_PROPOSAL_SOURCE, sourceRef: proposal.id, isDemo: false,
      verifiedAt: new Date().toISOString().slice(0, 10),
    };
    try {
      if (proposal.operation === ProposalOperation.Create) {
        await repo.save(repo.create({ ...values, ...provenance }));
      } else {
        const row = await repo.findOneBy({ id: proposal.entityId });
        if (!row) throw new NotFoundException({ code: 'CATALOG_ENTITY_NOT_FOUND', message: 'Target row does not exist' });
        if (proposal.operation === ProposalOperation.Delete) await repo.remove(row);
        else await repo.save(Object.assign(row, values, provenance));
      }
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new BadRequestException({ code: 'INVALID_PROPOSAL_PAYLOAD', message: 'Proposal payload cannot be stored' });
      }
      throw error;
    }
  }
}

export const PROPOSAL_ENTITIES: Record<ProposalEntityType, EntityTarget<ObjectLiteral>> = {
  [ProposalEntityType.Product]: ProductEntity,
  [ProposalEntityType.Registration]: ProductRegistrationEntity,
  [ProposalEntityType.Threshold]: ThresholdEntity,
  [ProposalEntityType.Diagnosis]: CatalogDiagnosisEntity,
  [ProposalEntityType.ActiveSubstance]: ActiveSubstanceEntity,
  [ProposalEntityType.ReferenceImage]: ReferenceImageEntity,
  [ProposalEntityType.Crop]: CropEntity,
};

export const PROPOSAL_APPLIERS = Object.fromEntries(
  Object.entries(PROPOSAL_ENTITIES).map(([type, target]) => [type, new RepositoryProposalApplier(target)]),
) as unknown as Record<ProposalEntityType, ProposalApplier>;
