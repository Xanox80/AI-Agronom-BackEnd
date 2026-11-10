import { FarmEntity, UserEntity } from '../../../domain/entities';
import { FarmDto, UserDto } from '../../../domain/types';

export function toUserDto(user: UserEntity): UserDto {
  return {
    id: user.id, email: user.email, displayName: user.displayName, role: user.role, locale: user.locale,
    geoCollectionEnabled: user.geoCollectionEnabled, trustWeight: user.trustWeight, farmId: user.farmId,
    regionCode: user.regionCode,
  };
}

export function toFarmDto(farm: FarmEntity): FarmDto {
  return {
    id: farm.id, name: farm.name, regionCode: farm.regionCode, timezone: farm.timezone,
    defaultSafetyBuffers: farm.defaultSafetyBuffers,
  };
}
