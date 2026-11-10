const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const END_RECORD_MIN_BYTES = 22;
const ENTRY_HEADER_BYTES = 46;

/** Sum of the uncompressed sizes declared in a zip central directory; NaN when the archive is malformed. */
export function declaredUncompressedBytes(zip: Buffer): number {
  const end = zip.lastIndexOf(Buffer.from(uint32le(END_OF_CENTRAL_DIRECTORY)));
  if (end < 0 || zip.length < end + END_RECORD_MIN_BYTES) return NaN;
  const entries = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  let total = 0;
  for (let i = 0; i < entries; i++) {
    if (offset + ENTRY_HEADER_BYTES > zip.length || zip.readUInt32LE(offset) !== CENTRAL_DIRECTORY_ENTRY) return NaN;
    total += zip.readUInt32LE(offset + 24);
    offset += ENTRY_HEADER_BYTES + zip.readUInt16LE(offset + 28) + zip.readUInt16LE(offset + 30) + zip.readUInt16LE(offset + 32);
  }
  return total;
}

function uint32le(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff];
}
