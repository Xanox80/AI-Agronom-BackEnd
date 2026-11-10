import { zipSync } from 'fflate';
import { declaredUncompressedBytes } from './zip-size';

describe('declaredUncompressedBytes', () => {
  it('sums the declared sizes of all entries', () => {
    const zip = Buffer.from(zipSync({ 'a.txt': new Uint8Array(1000), 'b.txt': new Uint8Array(24) }));
    expect(declaredUncompressedBytes(zip)).toBe(1024);
  });

  it('returns NaN for something that is not a zip', () => {
    expect(declaredUncompressedBytes(Buffer.from('not a zip at all, just text'))).toBeNaN();
  });
});
