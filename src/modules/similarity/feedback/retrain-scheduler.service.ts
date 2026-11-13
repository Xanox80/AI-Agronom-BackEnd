import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ClassifierTrainer } from '../classifier/classifier-trainer.service';
import { SIMILARITY_CONFIG, SimilarityConfig } from '../similarity.config';

/**
 * Retrains the reference classifier a while after the last new labelled photo, so a burst of confirmations
 * costs one retrain. Never runs two trainings at once; photos added during a run trigger one more run.
 */
@Injectable()
export class RetrainScheduler implements OnModuleDestroy {
  private readonly logger = new Logger(RetrainScheduler.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private rerunRequested = false;

  constructor(
    @Inject(SIMILARITY_CONFIG) private readonly config: SimilarityConfig,
    private readonly trainer: ClassifierTrainer,
  ) {}

  schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.run(), this.config.retrainDelayMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearTimeout(this.timer);
  }

  private async run(): Promise<void> {
    if (this.running) {
      this.rerunRequested = true;
      return;
    }
    this.running = true;
    try {
      const { file } = await this.trainer.train(false);
      this.logger.log(`Reference classifier retrained on ${Object.values(file.sampleCounts).reduce((sum, n) => sum + n, 0)} photos`);
    } catch (error) {
      this.logger.warn(`Retraining failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
      if (this.rerunRequested) {
        this.rerunRequested = false;
        this.schedule();
      }
    }
  }
}
