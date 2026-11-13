import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { RunHistory, RunSummary } from './run-history';

describe('RunHistory', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'runs-')); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const run = (name: string): RunSummary => ({
    finishedAt: '2026-11-13T10:00:00Z', name, embedderModel: 'm', embedderDtype: 'fp16', classes: 3, trainPhotos: 10,
    testPhotos: 5, accuracy: 0.9, top3Accuracy: 1, macroF1: 0.85, seconds: 12, report: 'r.html',
  });

  it('has no runs before the first one', () => {
    expect(new RunHistory(join(dir, 'runs.jsonl')).all()).toEqual([]);
  });

  it('keeps runs in the order they finished', () => {
    const history = new RunHistory(join(dir, 'lab', 'runs.jsonl'));
    history.add(run('clip'));
    history.add(run('dinov2'));
    expect(new RunHistory(join(dir, 'lab', 'runs.jsonl')).all().map((r) => r.name)).toEqual(['clip', 'dinov2']);
  });
});
