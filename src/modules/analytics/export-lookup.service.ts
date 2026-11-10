import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CatalogDiagnosisEntity, CropEntity, PhotoEntity, ProductEntity, UserEntity } from '../../domain/entities';

export interface UserIdentity { email: string; displayName: string }

/** Resolves internal ids to the stable references export DTOs expose (codes, emails, photo ids). */
@Injectable()
export class ExportLookup {
  constructor(
    @InjectRepository(CropEntity) private readonly crops: Repository<CropEntity>,
    @InjectRepository(CatalogDiagnosisEntity) private readonly diagnoses: Repository<CatalogDiagnosisEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(ProductEntity) private readonly products: Repository<ProductEntity>,
    @InjectRepository(PhotoEntity) private readonly photos: Repository<PhotoEntity>,
  ) {}

  async cropCodes(): Promise<Map<string, string>> {
    return new Map((await this.crops.find()).map((crop) => [crop.id, crop.code]));
  }

  async diagnosisCodes(): Promise<Map<string, string>> {
    return new Map((await this.diagnoses.find()).map((diagnosis) => [diagnosis.id, diagnosis.code]));
  }

  async userIdentities(farmId: string, ids: string[]): Promise<Map<string, UserIdentity>> {
    if (ids.length === 0) return new Map();
    const rows = await this.users.find({ where: { farmId, id: In(ids) } });
    return new Map(rows.map((user) => [user.id, { email: user.email, displayName: user.displayName }]));
  }

  async productsById(ids: string[]): Promise<Map<string, ProductEntity>> {
    if (ids.length === 0) return new Map();
    return new Map((await this.products.find({ where: { id: In(ids) } })).map((product) => [product.id, product]));
  }

  async photoIdsByObservation(farmId: string, observationIds: string[]): Promise<Map<string, string[]>> {
    const byObservation = new Map<string, string[]>();
    if (observationIds.length === 0) return byObservation;
    const rows = await this.photos.find({ where: { farmId, observationId: In(observationIds) }, order: { seq: 'ASC' } });
    for (const photo of rows) byObservation.set(photo.observationId, [...(byObservation.get(photo.observationId) ?? []), photo.id]);
    return byObservation;
  }
}
