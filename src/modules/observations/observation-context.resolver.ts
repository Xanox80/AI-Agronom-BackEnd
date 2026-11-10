import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CropEntity, FieldCropMemoryEntity, FieldEntity } from '../../domain/entities';
import { FieldLinkMethod } from '../../domain/enums';
import { CreateObservationDto } from './dto/create-observation.dto';
import { AuthUser } from './observation-access';
import { FIELD_DIRECTORY, FieldDirectory } from './ports/field-directory.port';
import { WEATHER_SNAPSHOT, WeatherSnapshotProvider } from './ports/weather-snapshot.port';

export interface ObservationContext {
  lat: number | null; lng: number | null; gpsAccuracyM: number | null;
  fieldId: string | null; fieldLinkMethod: FieldLinkMethod; cropId: string | null;
  temperatureC: number | null; humidityPct: number | null;
}

/** Fills the capture metadata the client did not send: field by GPS, remembered crop, weather (FR-5, FR-21). */
@Injectable()
export class ObservationContextResolver {
  constructor(
    @InjectRepository(FieldCropMemoryEntity) private readonly cropMemory: Repository<FieldCropMemoryEntity>,
    @InjectRepository(FieldEntity) private readonly fieldRepo: Repository<FieldEntity>,
    @InjectRepository(CropEntity) private readonly cropRepo: Repository<CropEntity>,
    @Optional() @Inject(FIELD_DIRECTORY) private readonly fields?: FieldDirectory,
    @Optional() @Inject(WEATHER_SNAPSHOT) private readonly weather?: WeatherSnapshotProvider,
  ) {}

  async resolve(user: AuthUser, dto: CreateObservationDto): Promise<ObservationContext> {
    const hasPoint = dto.lat !== undefined && dto.lng !== undefined;
    const storePoint = hasPoint && user.geoCollectionEnabled !== false;
    const match = dto.fieldId || !storePoint ? undefined : await this.locateField(user.farmId, dto.lat!, dto.lng!);
    const fieldId = dto.fieldId ?? match?.fieldId ?? null;
    const snapshot = storePoint && (dto.temperatureC === undefined || dto.humidityPct === undefined)
      ? await this.weatherAt(dto.lat!, dto.lng!)
      : null;

    return {
      lat: storePoint ? dto.lat! : null,
      lng: storePoint ? dto.lng! : null,
      gpsAccuracyM: storePoint ? dto.gpsAccuracyM ?? null : null,
      fieldId,
      fieldLinkMethod: dto.fieldId ? FieldLinkMethod.Manual : match ? FieldLinkMethod.Gps : FieldLinkMethod.None,
      cropId: dto.cropId ?? (await this.rememberedCrop(user, fieldId)) ?? match?.cropId ?? null,
      temperatureC: dto.temperatureC ?? snapshot?.temperatureC ?? null,
      humidityPct: dto.humidityPct ?? snapshot?.humidityPct ?? null,
    };
  }

  /** Rejects a field of another farm or an unknown crop sent by the client. */
  async assertReferencesAllowed(farmId: string, fieldId?: string | null, cropId?: string | null): Promise<void> {
    if (fieldId && !(await this.fieldRepo.findOneBy({ id: fieldId, farmId }))) throw new NotFoundException('FIELD_NOT_FOUND');
    if (cropId && !(await this.cropRepo.findOneBy({ id: cropId }))) throw new NotFoundException('CROP_NOT_FOUND');
  }

  async rememberCrop(user: AuthUser, fieldId: string | null, cropId: string | null): Promise<void> {
    if (!fieldId || !cropId) return;
    const existing = await this.cropMemory.findOneBy({ userId: user.id, fieldId });
    await this.cropMemory.save(
      Object.assign(existing ?? this.cropMemory.create({ userId: user.id, fieldId, farmId: user.farmId }), {
        cropId, lastUsedAt: new Date(),
      }),
    );
  }

  private async locateField(farmId: string, lat: number, lng: number) {
    const matches = (await this.fields?.locate(farmId, lat, lng)) ?? [];
    return matches.length === 1 ? matches[0] : undefined;
  }

  private async rememberedCrop(user: AuthUser, fieldId: string | null): Promise<string | undefined> {
    if (!fieldId) return undefined;
    return (await this.cropMemory.findOneBy({ userId: user.id, fieldId }))?.cropId;
  }

  private async weatherAt(lat: number, lng: number) {
    try {
      return (await this.weather?.at(lat, lng)) ?? null;
    } catch {
      return null;
    }
  }
}
