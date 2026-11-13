import { QdrantClient } from '@qdrant/js-client-rest';
import { QdrantReferenceIndex } from './qdrant-reference-index';

jest.mock('@qdrant/js-client-rest');

const config = { qdrantUrl: 'http://qdrant', qdrantApiKey: '', collection: 'refs', timeoutMs: 1000 };
const client = () => (QdrantClient as jest.MockedClass<typeof QdrantClient>).mock.instances[0] as jest.Mocked<QdrantClient>;

describe('QdrantReferenceIndex', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a cosine collection with keyword indexes when missing', async () => {
    const index = new QdrantReferenceIndex(config);
    QdrantClient.prototype.collectionExists = jest.fn().mockResolvedValue({ exists: false });
    await index.prepare(512);

    expect(client().createCollection).toHaveBeenCalledWith('refs', { vectors: { size: 512, distance: 'Cosine' } });
    expect(client().createPayloadIndex).toHaveBeenCalledWith('refs', expect.objectContaining({ field_name: 'cropCode', field_schema: 'keyword' }));
  });

  it('refuses an existing collection of another dimension', async () => {
    const index = new QdrantReferenceIndex(config);
    QdrantClient.prototype.collectionExists = jest.fn().mockResolvedValue({ exists: true });
    QdrantClient.prototype.getCollection = jest.fn().mockResolvedValue({ config: { params: { vectors: { size: 768 } } } });

    await expect(index.prepare(512)).rejects.toThrow('768-d');
  });

  it('filters by crop and maps scored points to neighbours', async () => {
    const index = new QdrantReferenceIndex(config);
    QdrantClient.prototype.query = jest.fn().mockResolvedValue({
      points: [{ id: 'a', score: 0.9, payload: { diagnosisCode: 'rust', cropCode: 'wheat_winter', attribution: 'Kaggle (CC0)' } }, { id: 'b', score: 0.8, payload: {} }],
    });

    expect(await index.nearest([1, 0], 'wheat_winter', 5)).toEqual([{ id: 'a', attribution: 'Kaggle (CC0)', diagnosisCode: 'rust', cropCode: 'wheat_winter', score: 0.9 }]);
    expect(client().query).toHaveBeenCalledWith('refs', expect.objectContaining({
      limit: 5, filter: { must: [{ key: 'cropCode', match: { value: 'wheat_winter' } }] },
    }));
  });

  it('deletes the points of one source by filter', async () => {
    const index = new QdrantReferenceIndex(config);
    QdrantClient.prototype.collectionExists = jest.fn().mockResolvedValue({ exists: true });
    await index.removeSource('plantvillage');

    expect(client().delete).toHaveBeenCalledWith('refs', { wait: true, filter: { must: [{ key: 'source', match: { value: 'plantvillage' } }] } });
  });

  it('pages through the collection for labelled vectors', async () => {
    const index = new QdrantReferenceIndex(config);
    QdrantClient.prototype.scroll = jest.fn()
      .mockResolvedValueOnce({ points: [{ id: 'a', vector: [1, 0], payload: { diagnosisCode: 'rust', source: 'kaggle' } }], next_page_offset: 'b' })
      .mockResolvedValueOnce({ points: [{ id: 'b', vector: [0, 1], payload: { diagnosisCode: 'septoria', source: 'field' } }, { id: 'c', vector: [0, 0], payload: {} }], next_page_offset: null });

    expect(await index.labelledVectors()).toEqual([
      { vector: [1, 0], diagnosisCode: 'rust', source: 'kaggle' }, { vector: [0, 1], diagnosisCode: 'septoria', source: 'field' },
    ]);
    expect((client().scroll as jest.Mock).mock.calls[1][1]).toMatchObject({ offset: 'b', with_vector: true });
  });

  it('reads one point payload, or null when missing', async () => {
    const index = new QdrantReferenceIndex(config);
    QdrantClient.prototype.retrieve = jest.fn().mockResolvedValueOnce([{ id: 'a', payload: { imagePath: 'x.png' } }]).mockResolvedValueOnce([]);

    expect(await index.payloadOf('a')).toEqual({ imagePath: 'x.png' });
    expect(await index.payloadOf('b')).toBeNull();
  });

  it('does not connect until first used', () => {
    new QdrantReferenceIndex(config);

    expect(QdrantClient).not.toHaveBeenCalled();
  });
});
