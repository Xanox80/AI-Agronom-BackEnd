import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname } from 'path';

/** The headline numbers of one lab run, kept to compare runs over time. */
export interface RunSummary {
  finishedAt: string;
  name: string;
  embedderModel: string;
  embedderDtype: string;
  classes: number;
  trainPhotos: number;
  testPhotos: number;
  accuracy: number;
  top3Accuracy: number;
  macroF1: number;
  seconds: number;
  report: string;
}

/** Append-only JSON-lines log of lab runs. */
export class RunHistory {
  constructor(private readonly file: string) {}

  all(): RunSummary[] {
    if (!existsSync(this.file)) return [];
    return readFileSync(this.file, 'utf8').split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line) as RunSummary);
  }

  add(run: RunSummary): void {
    mkdirSync(dirname(this.file), { recursive: true });
    appendFileSync(this.file, `${JSON.stringify(run)}\n`);
  }
}
