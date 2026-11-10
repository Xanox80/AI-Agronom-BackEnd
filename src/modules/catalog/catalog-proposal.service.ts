import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CatalogChangeProposalEntity } from '../../domain/entities';
import { DomainEvent } from '../../domain/events';
import type { CatalogPublishedEvent } from '../../domain/events';
import { ProposalOperation, ProposalStatus, Role } from '../../domain/enums';
import type { Page } from '../../domain/types';
import { CatalogStatusService } from './catalog-status.service';
import { EXPERT_PROPOSAL_TYPES } from './catalog.constants';
import type { ProposalQueryDto } from './dto/catalog-query.dto';
import type { CatalogActor, CreateProposalDto, ProposalDto } from './dto/proposal.dto';
import { PROPOSAL_APPLIERS } from './proposal-appliers';
import { ProposalPayloadValidator } from './proposal-payload.validator';

const toProposalDto = (p: CatalogChangeProposalEntity): ProposalDto => ({
  id: p.id, entityType: p.entityType, entityId: p.entityId, operation: p.operation, payload: p.payload, status: p.status,
  proposedByUserId: p.proposedByUserId, reviewedByUserId: p.reviewedByUserId, reviewedAt: p.reviewedAt?.toISOString() ?? null,
  reviewComment: p.reviewComment, createdAt: p.createdAt.toISOString(),
});

/** Directory change workflow: propose, then the chief agronomist approves (applies and bumps version) or rejects. */
@Injectable()
export class CatalogProposalService {
  constructor(
    @InjectRepository(CatalogChangeProposalEntity) private readonly proposals: Repository<CatalogChangeProposalEntity>,
    private readonly dataSource: DataSource,
    private readonly status: CatalogStatusService,
    private readonly events: EventEmitter2,
    private readonly payloadValidator: ProposalPayloadValidator,
  ) {}

  async list(query: ProposalQueryDto): Promise<Page<ProposalDto>> {
    const [rows, total] = await this.proposals.findAndCount({
      where: query.status ? { status: query.status } : {}, order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize, take: query.pageSize,
    });
    return { items: rows.map(toProposalDto), total, page: query.page, pageSize: query.pageSize };
  }

  async create(dto: CreateProposalDto, actor: CatalogActor): Promise<ProposalDto> {
    if (actor.role === Role.Expert && !EXPERT_PROPOSAL_TYPES.includes(dto.entityType)) {
      throw new ForbiddenException({ code: 'PROPOSAL_TYPE_NOT_ALLOWED', message: 'Experts may propose only diagnoses and reference images' });
    }
    if (dto.operation !== ProposalOperation.Create && !dto.entityId) {
      throw new BadRequestException({ code: 'ENTITY_ID_REQUIRED', message: 'entityId is required for update and delete' });
    }
    this.payloadValidator.assertValid(dto);
    const saved = await this.proposals.save(this.proposals.create({
      entityType: dto.entityType, entityId: dto.operation === ProposalOperation.Create ? null : dto.entityId,
      operation: dto.operation, payload: dto.payload, status: ProposalStatus.Pending, proposedByUserId: actor.id,
    }));
    return toProposalDto(saved);
  }

  async approve(id: string, reviewerId: string, comment?: string): Promise<ProposalDto> {
    const proposal = await this.requirePending(id);
    const version = await this.dataSource.transaction(async (manager) => {
      const next = await this.status.bumpVersion(manager);
      await PROPOSAL_APPLIERS[proposal.entityType].apply(manager, proposal, next);
      await manager.save(Object.assign(proposal, this.review(ProposalStatus.Approved, reviewerId, comment), {
        payload: { ...proposal.payload, appliedVersion: next },
      }));
      return next;
    });
    const { regionCode } = await this.status.requireState();
    this.events.emit(DomainEvent.CatalogPublished, { regionCode, version } satisfies CatalogPublishedEvent);
    return toProposalDto(proposal);
  }

  async reject(id: string, reviewerId: string, comment: string): Promise<ProposalDto> {
    const proposal = await this.requirePending(id);
    return toProposalDto(await this.proposals.save(Object.assign(proposal, this.review(ProposalStatus.Rejected, reviewerId, comment))));
  }

  private review(status: ProposalStatus, reviewerId: string, comment?: string) {
    return { status, reviewedByUserId: reviewerId, reviewedAt: new Date(), reviewComment: comment ?? null };
  }

  private async requirePending(id: string): Promise<CatalogChangeProposalEntity> {
    const proposal = await this.proposals.findOneBy({ id });
    if (!proposal) throw new NotFoundException({ code: 'PROPOSAL_NOT_FOUND', message: 'Proposal not found' });
    if (proposal.status !== ProposalStatus.Pending) {
      throw new ConflictException({ code: 'PROPOSAL_ALREADY_REVIEWED', message: 'Proposal has already been reviewed' });
    }
    return proposal;
  }
}
