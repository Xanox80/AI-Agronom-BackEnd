import { Organ } from '../../domain/enums';
import { ReferenceClassifier } from '../similarity/classifier/reference-classifier.service';
import { ImageEmbedder } from '../similarity/similarity.types';
import { VisionProviderError } from './vision-provider.error';
import { UNKNOWN, VisionHypothesis, VisionInput, VisionOutput, VisionProvider } from './vision.types';

const LOCAL_EVIDENCE = {
  uk: 'Розпізнано локальною моделлю за схожістю з підтвердженими фото.',
  en: 'Recognised by the local model from similarity to labelled photos.',
};

/**
 * Diagnoses with the classifier trained on the reference vectors, no external AI. It only ranks catalogue
 * codes: no crop/organ detection, regions, pest counts or clarifying questions. Codes the model was never
 * trained on (other crops) yield no hypotheses, which recognition treats as out of distribution.
 */
export class LocalVisionProvider implements VisionProvider {
  readonly name = 'local';

  constructor(
    readonly model: string,
    private readonly embedder: ImageEmbedder,
    private readonly classifier: ReferenceClassifier,
    private readonly maxHypotheses: number,
  ) {}

  async analyze(input: VisionInput): Promise<VisionOutput> {
    if (!this.classifier.trained) {
      throw new VisionProviderError('request_failed', 'No trained reference classifier; run npm run train:classifier', 1);
    }
    const vectors: number[][] = [];
    for (const photo of input.photos) vectors.push(await this.embedder.embed(photo));
    const votes = this.classifier.votes(vectors, input.allowedDiagnosisCodes) ?? {};
    const hypotheses: VisionHypothesis[] = Object.entries(votes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.maxHypotheses)
      .map(([diagnosisCode, probability]) => ({ diagnosisCode, probability, stage: null, evidence: LOCAL_EVIDENCE[input.locale], region: null }));
    return {
      crop: input.context.cropCode ?? UNKNOWN,
      organ: (input.context.organHint as Organ | undefined) ?? UNKNOWN,
      problemCategory: UNKNOWN,
      hypotheses,
      pest: null,
      clarifyingQuestions: [],
      outOfDistribution: !hypotheses.length,
      raw: { provider: this.name, votes },
    };
  }
}
