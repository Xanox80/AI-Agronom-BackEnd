import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, MoreThan, Repository } from 'typeorm';
import {
  ActiveSubstanceEntity, BbchStageEntity, CatalogChangeProposalEntity, CatalogDiagnosisEntity, CatalogEntity, CropEntity,
  ProductEntity, ProductRegistrationEntity, ReferenceImageEntity, ThresholdEntity,
} from '../../domain/entities';
import { ProposalOperation, ProposalStatus } from '../../domain/enums';
import { CatalogStatusService } from './catalog-status.service';
import { CatalogService } from './catalog.service';
import {
  toActiveSubstanceDto, toBbchStageDto, toCropDto, toDiagnosisDto, toRegistrationDto, toThresholdDto,
} from './catalog.mapper';
import type { CatalogPackDto } from './dto/catalog.dto';

/** Regional reference pack for offline download (FR-25): full, or a delta after `sinceVersion`. */
@Injectable()
export class CatalogPackService {
  constructor(
    @InjectRepository(CropEntity) private readonly crops: Repository<CropEntity>,
    @InjectRepository(BbchStageEntity) private readonly bbch: Repository<BbchStageEntity>,
    @InjectRepository(CatalogDiagnosisEntity) private readonly diagnoses: Repository<CatalogDiagnosisEntity>,
    @InjectRepository(ThresholdEntity) private readonly thresholds: Repository<ThresholdEntity>,
    @InjectRepository(ActiveSubstanceEntity) private readonly substances: Repository<ActiveSubstanceEntity>,
    @InjectRepository(ProductEntity) private readonly products: Repository<ProductEntity>,
    @InjectRepository(ProductRegistrationEntity) private readonly registrations: Repository<ProductRegistrationEntity>,
    @InjectRepository(ReferenceImageEntity) private readonly images: Repository<ReferenceImageEntity>,
    @InjectRepository(CatalogChangeProposalEntity) private readonly proposals: Repository<CatalogChangeProposalEntity>,
    private readonly catalog: CatalogService,
    private readonly status: CatalogStatusService,
  ) {}

  /** Cheap validator for If-None-Match: it changes exactly when the pack content can change. */
  async etag(regionCode?: string, sinceVersion?: number): Promise<string> {
    const state = await this.status.requireState(regionCode);
    return `"${state.regionCode}:${sinceVersion ?? 0}:${state.version}"`;
  }

  async build(regionCode?: string, sinceVersion?: number): Promise<CatalogPackDto> {
    const state = await this.status.requireState(regionCode);
    const scope = this.scope<CatalogEntity>(state.regionCode, sinceVersion);
    const [crops, bbch, diagnoses, thresholds, substances, products, registrations, images, deleted] = await Promise.all([
      this.crops.find({ where: scope }),
      this.bbch.find({ where: scope }),
      this.diagnoses.find({ where: scope, relations: { crops: true } }),
      this.thresholds.find({ where: scope }),
      this.substances.find({ where: scope }),
      this.products.find({ where: scope }),
      this.registrations.find({ where: scope }),
      this.images.find({ where: scope }),
      this.deletedSince(sinceVersion),
    ]);
    return {
      regionCode: state.regionCode, version: state.version, publishedAt: state.publishedAt.toISOString(),
      sinceVersion: sinceVersion ?? null, crops: crops.map(toCropDto), bbch: bbch.map(toBbchStageDto),
      diagnoses: diagnoses.map(toDiagnosisDto), thresholds: thresholds.map(toThresholdDto),
      products: await this.catalog.toProductDtos(products), registrations: registrations.map(toRegistrationDto),
      activeSubstances: substances.map(toActiveSubstanceDto), referenceImages: await this.catalog.toReferenceImageDtos(images),
      deleted,
    };
  }

  private scope<T extends CatalogEntity>(regionCode: string, sinceVersion?: number): FindOptionsWhere<T>[] {
    const since = sinceVersion === undefined ? {} : { version: MoreThan(sinceVersion) };
    return [{ regionCode: IsNull(), ...since }, { regionCode, ...since }] as FindOptionsWhere<T>[];
  }

  private async deletedSince(sinceVersion?: number): Promise<Record<string, string[]>> {
    if (sinceVersion === undefined) return {};
    const approved = await this.proposals.find({ where: { operation: ProposalOperation.Delete, status: ProposalStatus.Approved } });
    const deleted: Record<string, string[]> = {};
    for (const p of approved) {
      if (p.entityId && Number(p.payload.appliedVersion) > sinceVersion) (deleted[p.entityType] ??= []).push(p.entityId);
    }
    return deleted;
  }
}
