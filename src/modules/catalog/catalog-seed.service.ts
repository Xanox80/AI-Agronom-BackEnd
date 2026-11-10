import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { AppConfig } from '../../config/app-config';
import {
  ActiveSubstanceEntity, BbchStageEntity, CatalogDiagnosisEntity, CatalogEntity, CatalogStateEntity, CropEntity,
  ProductActiveSubstanceEntity, ProductEntity, ProductRegistrationEntity, ReferenceImageEntity, ThresholdEntity,
} from '../../domain/entities';
import {
  PLACEHOLDER_PREFIX, REFERENCE_IMAGES_PER_DIAGNOSIS, SEED_ACTUALITY_DATE, SEED_SOURCE_REF, SEED_REFERENCE_SOURCE, SEED_REGISTRY_SOURCE,
} from './catalog.constants';
import { SEED_BBCH_PHASES, SEED_CROPS } from './seed/seed-crops';
import { SEED_DIAGNOSES } from './seed/seed-diagnoses';
import { SEED_PRODUCTS, SEED_REGISTRATIONS, SEED_SUBSTANCES } from './seed/seed-products';
import { SEED_THRESHOLDS } from './seed/seed-thresholds';

const PLACEHOLDER_ATTRIBUTION = 'Placeholder - replace with a licensed field photo';

const provenance = (source: string) => ({
  source, sourceRef: SEED_SOURCE_REF, verifiedAt: SEED_ACTUALITY_DATE, isDemo: true, regionCode: null, version: 1,
});

type ById = Map<string, string>;
const toIdMap = (rows: { id: string; code: string }[]): ById => new Map(rows.map((row) => [row.code, row.id]));

/** Seeds the DEMO catalogue once, on an empty database. Every row carries source and actuality date. */
@Injectable()
export class CatalogSeedService implements OnModuleInit {
  constructor(private readonly dataSource: DataSource, private readonly config: ConfigService<AppConfig, true>) {}

  async onModuleInit(): Promise<void> {
    const { seedDemo, defaultRegion } = this.config.get('catalog', { infer: true });
    if (seedDemo) await this.seed(defaultRegion);
  }

  async seed(regionCode: string): Promise<boolean> {
    if ((await this.dataSource.getRepository(CropEntity).count()) > 0) return false;
    await this.dataSource.transaction(async (manager) => {
      const crops = await this.seedCrops(manager);
      const diagnoses = await this.seedDiagnoses(manager, crops);
      await this.seedThresholds(manager, crops, diagnoses);
      await this.seedProducts(manager, crops, diagnoses);
      await this.seedReferenceImages(manager, diagnoses);
      const actuality = new Date(SEED_ACTUALITY_DATE);
      await manager.save(manager.create(CatalogStateEntity, { regionCode, version: 1, publishedAt: actuality, lastVerifiedAt: actuality }));
    });
    return true;
  }

  private async insert<T extends CatalogEntity>(manager: EntityManager, target: new () => T, source: string, rows: object[]): Promise<T[]> {
    return manager.save(rows.map((row) => manager.create(target, { ...provenance(source), ...row } as never) as T));
  }

  private async seedCrops(manager: EntityManager): Promise<ById> {
    const crops = await this.insert(manager, CropEntity, SEED_REFERENCE_SOURCE, SEED_CROPS);
    const stages = crops.flatMap((crop) => SEED_BBCH_PHASES.map((p) => ({
      cropId: crop.id, bbchFrom: p.from, bbchTo: p.to, phase: p.phase, nameUk: p.nameUk, nameEn: p.nameEn,
    })));
    await this.insert(manager, BbchStageEntity, SEED_REFERENCE_SOURCE, stages);
    return toIdMap(crops);
  }

  private async seedDiagnoses(manager: EntityManager, crops: ById): Promise<ById> {
    const rows = SEED_DIAGNOSES.map(({ cropCodes, ...diagnosis }) => ({
      ...diagnosis, crops: cropCodes.map((code) => ({ id: crops.get(code) })),
    }));
    return toIdMap(await this.insert(manager, CatalogDiagnosisEntity, SEED_REFERENCE_SOURCE, rows));
  }

  private async seedThresholds(manager: EntityManager, crops: ById, diagnoses: ById): Promise<void> {
    const rows = SEED_THRESHOLDS.map(({ cropCode, diagnosisCode, ...threshold }) => ({
      ...threshold, cropId: crops.get(cropCode), diagnosisId: diagnoses.get(diagnosisCode),
    }));
    await this.insert(manager, ThresholdEntity, SEED_REFERENCE_SOURCE, rows);
  }

  private async seedProducts(manager: EntityManager, crops: ById, diagnoses: ById): Promise<void> {
    const substances = toIdMap(await this.insert(manager, ActiveSubstanceEntity, SEED_REFERENCE_SOURCE, SEED_SUBSTANCES.map(
      ({ system, group, ...substance }) => ({ ...substance, resistanceSystem: system, resistanceGroup: group, maxApplicationsPerSeason: null }),
    )));
    const products = await this.insert(manager, ProductEntity, SEED_REGISTRY_SOURCE, SEED_PRODUCTS.map(
      (p) => ({
        name: p.name, formulation: p.formulation, registrant: p.registrant, pollinatorHazard: p.pollinatorHazard,
        pricePerHaUah: p.pricePerHaUah, registrationNumber: null, efficacyNote: null,
        waterProtectionZoneM: p.waterZoneM, apiaryZoneM: p.apiaryZoneM, settlementZoneM: p.settlementZoneM,
      }),
    ));
    const productIds = new Map(SEED_PRODUCTS.map((p, i) => [p.key, products[i].id]));
    await manager.save(SEED_PRODUCTS.flatMap((p) => p.substances.map((s) => manager.create(ProductActiveSubstanceEntity, {
      productId: productIds.get(p.key), activeSubstanceId: substances.get(s.code), concentration: s.concentration,
    }))));
    await this.insert(manager, ProductRegistrationEntity, SEED_REGISTRY_SOURCE, SEED_REGISTRATIONS.map(
      ({ productKey, cropCode, diagnosisCode, ...registration }) => ({
        ...registration, productId: productIds.get(productKey), cropId: crops.get(cropCode),
        diagnosisId: diagnoses.get(diagnosisCode), incompatibleWith: [],
        maxWindSpeedMs: null, minTempC: null, maxTempC: null,
      }),
    ));
  }

  private async seedReferenceImages(manager: EntityManager, diagnoses: ById): Promise<void> {
    const rows = SEED_DIAGNOSES.flatMap((d) => Array.from({ length: REFERENCE_IMAGES_PER_DIAGNOSIS }, (_, i) => ({
      diagnosisId: diagnoses.get(d.code), cropId: null, stage: null, storageKey: `${PLACEHOLDER_PREFIX}${d.code}:${i + 1}`,
      caption: `${d.nameEn} (${i + 1}/${REFERENCE_IMAGES_PER_DIAGNOSIS})`, attribution: PLACEHOLDER_ATTRIBUTION,
    })));
    await this.insert(manager, ReferenceImageEntity, SEED_REFERENCE_SOURCE, rows);
  }
}
