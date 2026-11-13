import { QdrantClient } from '@qdrant/js-client-rest';
import { SimilarityConfig } from './similarity.config';
import { LabelledReference, ReferenceIndex, ReferenceNeighbour, ReferencePayload, ReferencePoint } from './similarity.types';

/** Payload fields recognition filters on; Qdrant Cloud strict mode rejects filters on unindexed fields. */
const FILTERED_FIELDS = ['cropCode', 'diagnosisCode', 'source'] as const;
const SCROLL_PAGE_SIZE = 256;

/** Labelled reference vectors in a Qdrant collection (cosine distance). */
export class QdrantReferenceIndex implements ReferenceIndex {
  private client: QdrantClient | null = null;

  constructor(private readonly config: Pick<SimilarityConfig, 'qdrantUrl' | 'qdrantApiKey' | 'collection' | 'timeoutMs'>) {}

  async prepare(dimension: number): Promise<void> {
    const { exists } = await this.qdrant().collectionExists(this.config.collection);
    if (exists) return this.assertDimension(dimension);
    await this.qdrant().createCollection(this.config.collection, { vectors: { size: dimension, distance: 'Cosine' } });
    for (const field of FILTERED_FIELDS) {
      await this.qdrant().createPayloadIndex(this.config.collection, { field_name: field, field_schema: 'keyword', wait: true });
    }
  }

  async upsert(points: ReferencePoint[]): Promise<void> {
    if (!points.length) return;
    await this.qdrant().upsert(this.config.collection, {
      wait: true,
      points: points.map((point) => ({ id: point.id, vector: point.vector, payload: { ...point.payload } })),
    });
  }

  async removeSource(source: string): Promise<void> {
    const { exists } = await this.qdrant().collectionExists(this.config.collection);
    if (!exists) return;
    await this.qdrant().delete(this.config.collection, { wait: true, filter: { must: [{ key: 'source', match: { value: source } }] } });
  }

  async labelledVectors(): Promise<LabelledReference[]> {
    const labelled: LabelledReference[] = [];
    let offset: string | number | undefined;
    do {
      const page = await this.qdrant().scroll(this.config.collection, {
        limit: SCROLL_PAGE_SIZE, offset, with_vector: true, with_payload: ['diagnosisCode', 'source'],
      });
      page.points.forEach((point) => {
        const payload = point.payload as Partial<ReferencePayload> | null | undefined;
        if (payload?.diagnosisCode && Array.isArray(point.vector)) {
          labelled.push({ vector: point.vector as number[], diagnosisCode: payload.diagnosisCode, source: payload.source ?? '' });
        }
      });
      offset = typeof page.next_page_offset === 'string' || typeof page.next_page_offset === 'number' ? page.next_page_offset : undefined;
    } while (offset !== undefined);
    return labelled;
  }

  async nearest(vector: number[], cropCode: string | null, limit: number): Promise<ReferenceNeighbour[]> {
    const { points } = await this.qdrant().query(this.config.collection, {
      query: vector, limit, with_payload: ['diagnosisCode', 'cropCode', 'source', 'attribution'],
      filter: cropCode ? { must: [{ key: 'cropCode', match: { value: cropCode } }] } : undefined,
    });
    return points.map((point) => {
      const payload = point.payload as Partial<ReferencePayload> | null | undefined;
      return {
        id: String(point.id), attribution: payload?.attribution ?? payload?.source ?? '',
        diagnosisCode: payload?.diagnosisCode ?? '', cropCode: payload?.cropCode ?? '', score: point.score,
      };
    }).filter((neighbour) => neighbour.diagnosisCode);
  }

  async payloadOf(id: string): Promise<ReferencePayload | null> {
    const [point] = await this.qdrant().retrieve(this.config.collection, { ids: [id], with_payload: true, with_vector: false });
    return (point?.payload as ReferencePayload | undefined) ?? null;
  }

  /** A different embedder would silently compare incompatible vectors, so refuse instead. */
  private async assertDimension(dimension: number): Promise<void> {
    const info = await this.qdrant().getCollection(this.config.collection);
    const vectors = info.config.params.vectors;
    const size = vectors && 'size' in vectors ? Number(vectors.size) : undefined;
    if (size !== undefined && size !== dimension) {
      throw new Error(`Qdrant collection ${this.config.collection} holds ${size}-d vectors but the embedder produces ${dimension}-d; `
        + 'use another QDRANT_COLLECTION or delete the collection and re-index');
    }
  }

  /** Created lazily so the app boots without Qdrant when similarity is disabled. */
  private qdrant(): QdrantClient {
    this.client ??= new QdrantClient({
      url: this.config.qdrantUrl, apiKey: this.config.qdrantApiKey || undefined, timeout: this.config.timeoutMs, checkCompatibility: false,
    });
    return this.client;
  }
}
