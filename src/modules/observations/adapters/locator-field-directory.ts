import { Injectable } from '@nestjs/common';
import { FieldLocatorService } from '../../fields/field-locator.service';
import { FieldDirectory, FieldMatch } from '../ports/field-directory.port';

/** Backs the observation FieldDirectory port with the fields module locator. */
@Injectable()
export class LocatorFieldDirectory implements FieldDirectory {
  constructor(private readonly locator: FieldLocatorService) {}

  async locate(farmId: string, lat: number, lng: number): Promise<FieldMatch[]> {
    const { matches } = await this.locator.locate(farmId, lat, lng);
    return matches.map(({ fieldId }) => ({ fieldId }));
  }
}
