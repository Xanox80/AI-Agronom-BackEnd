import { BadRequestException } from '@nestjs/common';
import { enforceRowCap } from './row-cap';

describe('enforceRowCap', () => {
  it('returns rows up to the cap', () => {
    expect(enforceRowCap([1, 2], 2)).toEqual([1, 2]);
  });

  it('throws when the cap is exceeded', () => {
    expect(() => enforceRowCap([1, 2, 3], 2)).toThrow(BadRequestException);
  });
});
