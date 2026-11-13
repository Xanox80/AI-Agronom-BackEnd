import { ReferencePhotoFiles } from './reference-photo-files.service';
import { SimilarPhotosController } from './similar-photos.controller';

describe('SimilarPhotosController', () => {
  it('sends the photo bytes with their type and a private cache header', async () => {
    const files = { read: jest.fn().mockResolvedValue({ bytes: Buffer.from('x'), mimeType: 'image/png' }) } as unknown as ReferencePhotoFiles;
    const res = { setHeader: jest.fn(), send: jest.fn() };
    await new SimilarPhotosController(files).photo('id', res as never);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('private'));
    expect(res.send).toHaveBeenCalledWith(Buffer.from('x'));
  });
});
