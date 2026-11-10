import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProposalEntityType, ProposalOperation } from '../../domain/enums';
import { STORAGE_KEY_PATTERN } from './catalog.constants';
import type { CreateProposalDto } from './dto/proposal.dto';
import { PROPOSAL_ENTITIES, SERVER_OWNED_COLUMNS } from './proposal-appliers';

const RELATION_KEYS = ['cropIds'];

const invalid = (message: string) => new BadRequestException({ code: 'INVALID_PROPOSAL_PAYLOAD', message });

/** Rejects payload keys that are not columns of the target table, and unsafe reference image keys. */
@Injectable()
export class ProposalPayloadValidator {
  constructor(private readonly dataSource: DataSource) {}

  assertValid(dto: CreateProposalDto): void {
    if (dto.operation === ProposalOperation.Delete) return;
    const columns = new Set(this.dataSource.getMetadata(PROPOSAL_ENTITIES[dto.entityType]).columns.map((c) => c.propertyName));
    const unknown = Object.keys(dto.payload).filter((key) => !RELATION_KEYS.includes(key) && (!columns.has(key) || SERVER_OWNED_COLUMNS.has(key)));
    if (unknown.length) throw invalid(`Unsupported payload fields: ${unknown.join(', ')}`);
    const key = dto.payload.storageKey;
    if (dto.entityType === ProposalEntityType.ReferenceImage && key !== undefined && !(typeof key === 'string' && STORAGE_KEY_PATTERN.test(key))) {
      throw invalid('storageKey must be a file name produced by the upload endpoint');
    }
  }
}
