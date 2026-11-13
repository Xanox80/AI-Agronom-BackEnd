import { Inject, Injectable, Logger } from '@nestjs/common';
import { VisionPhoto } from '../vision-provider/vision.types';
import { ReferenceClassifier } from './classifier/reference-classifier.service';
import { closestExamples, voteOnNeighbours } from './neighbour-vote';
import { SIMILARITY_CONFIG, SimilarityConfig } from './similarity.config';
import { IMAGE_EMBEDDER, ImageEmbedder, REFERENCE_INDEX, ReferenceIndex, ReferenceNeighbour, SimilarityEvidence } from './similarity.types';

class SimilarityTimeout extends Error {}

interface PhotoLookup {
  vector: number[];
  neighbours: ReferenceNeighbour[];
}

/**
 * Looks up labelled reference photos that resemble the scout's photos. The class vote comes from the
 * trained probe when one exists, else from the neighbours. Best-effort: when disabled, slow or failing
 * it returns null and recognition proceeds on the vision provider alone.
 */
@Injectable()
export class SimilarCaseFinder {
  private readonly logger = new Logger(SimilarCaseFinder.name);

  constructor(
    @Inject(SIMILARITY_CONFIG) private readonly config: SimilarityConfig,
    @Inject(IMAGE_EMBEDDER) private readonly embedder: ImageEmbedder,
    @Inject(REFERENCE_INDEX) private readonly index: ReferenceIndex,
    private readonly classifier: ReferenceClassifier,
  ) {}

  get blendWeight(): number {
    return this.config.enabled ? this.config.blendWeight : 0;
  }

  async find(photos: VisionPhoto[], cropCode: string | null, allowedCodes: string[]): Promise<SimilarityEvidence | null> {
    if (!this.config.enabled || !photos.length) return null;
    try {
      const lookups = await this.withinBudget(this.lookUp(photos, cropCode));
      const knn = voteOnNeighbours(lookups.map((l) => l.neighbours), allowedCodes, this.config.voteExponent);
      const learned = this.classifier.votes(lookups.map((l) => l.vector), allowedCodes);
      const votes = learned ?? knn?.votes;
      if (!votes) return null;
      const bestScore = knn?.bestScore ?? 0;
      return {
        votes, bestScore, neighbourCount: knn?.neighbourCount ?? 0, voteSource: learned ? 'classifier' : 'neighbours',
        examples: closestExamples(lookups.map((l) => l.neighbours), allowedCodes, this.config.examplesPerDiagnosis),
        farFromReferences: !!knn && this.config.oodMinScore > 0 && bestScore < this.config.oodMinScore,
      };
    } catch (error) {
      const reason = error instanceof SimilarityTimeout ? `timed out after ${this.config.timeoutMs} ms` : (error as Error)?.name ?? 'Error';
      this.logger.warn(`Reference lookup skipped: ${reason}`);
      return null;
    }
  }

  /** Sequential: embedding is CPU-bound, so parallel photos would only contend for the same cores. */
  private async lookUp(photos: VisionPhoto[], cropCode: string | null): Promise<PhotoLookup[]> {
    const lookups: PhotoLookup[] = [];
    for (const photo of photos) {
      const vector = await this.embedder.embed(photo);
      lookups.push({ vector, neighbours: await this.index.nearest(vector, cropCode, this.config.neighbours) });
    }
    return lookups;
  }

  private withinBudget<T>(work: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new SimilarityTimeout()), this.config.timeoutMs); });
    return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
  }
}
