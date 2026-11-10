import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { AppConfig } from '../../../config/app-config';
import {
  ActiveSubstanceEntity, ALL_ENTITIES, BbchStageEntity, CatalogChangeProposalEntity, CatalogDiagnosisEntity, CatalogStateEntity,
  CropEntity, ProductActiveSubstanceEntity, ProductEntity, ProductRegistrationEntity, ReferenceImageEntity, ThresholdEntity,
} from '../../../domain/entities';
import { CatalogPackService } from '../catalog-pack.service';
import { CatalogProposalService } from '../catalog-proposal.service';
import { ProposalPayloadValidator } from '../proposal-payload.validator';
import { CatalogSeedService } from '../catalog-seed.service';
import { CatalogStatusService } from '../catalog-status.service';
import { CatalogService } from '../catalog.service';

export const TEST_REGION = 'UA-DEFAULT';
export const TEST_STALE_DAYS = 180;

/** Real in-memory SQLite plus hand-wired catalogue services; no Nest container needed. */
export async function createCatalogContext() {
  const dataSource = new DataSource({ type: 'better-sqlite3', database: ':memory:', entities: ALL_ENTITIES, synchronize: true });
  await dataSource.initialize();
  const settings = {
    catalog: { staleDays: TEST_STALE_DAYS, seedDemo: true, defaultRegion: TEST_REGION },
    app: { apiPrefix: 'api/v1' },
    storage: { dir: './data/test-storage', maxPhotoMb: 1, allowedImageTypes: ['image/jpeg'] },
  };
  const config = { get: (key: keyof typeof settings) => settings[key] } as unknown as ConfigService<AppConfig, true>;
  const repo = dataSource.getRepository.bind(dataSource);

  const seeder = new CatalogSeedService(dataSource, config);
  const status = new CatalogStatusService(repo(CatalogStateEntity), repo(ProductEntity), config);
  const catalog = new CatalogService(
    repo(CropEntity), repo(BbchStageEntity), repo(CatalogDiagnosisEntity), repo(ThresholdEntity), repo(ActiveSubstanceEntity),
    repo(ProductEntity), repo(ProductActiveSubstanceEntity), repo(ProductRegistrationEntity), repo(ReferenceImageEntity), config,
  );
  const packs = new CatalogPackService(
    repo(CropEntity), repo(BbchStageEntity), repo(CatalogDiagnosisEntity), repo(ThresholdEntity), repo(ActiveSubstanceEntity),
    repo(ProductEntity), repo(ProductRegistrationEntity), repo(ReferenceImageEntity), repo(CatalogChangeProposalEntity), catalog, status,
  );
  const events = new EventEmitter2();
  const proposals = new CatalogProposalService(repo(CatalogChangeProposalEntity), dataSource, status, events, new ProposalPayloadValidator(dataSource));
  await seeder.seed(TEST_REGION);
  return { dataSource, config, seeder, status, catalog, packs, proposals, events, repo };
}
