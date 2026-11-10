import { pipelineInput } from '../__fixtures__/pipeline-fixtures';
import { RecommendationPipeline } from './recommendation-pipeline';
import { PipelineContext, PipelineStep } from './pipeline-types';

const step = (run: (context: PipelineContext) => void): PipelineStep & { run: jest.Mock } => ({ run: jest.fn(async (c: PipelineContext) => run(c)) });

describe('RecommendationPipeline', () => {
  const build = (steps: PipelineStep[]) => new RecommendationPipeline(...(steps as [never, never, never, never, never]));

  it('runs every step in order', async () => {
    const order: string[] = [];
    const steps = ['action', 'allowed', 'filter', 'safety', 'rank'].map((name) => step(() => { order.push(name); }));
    await build(steps).run(pipelineInput());
    expect(order).toEqual(['action', 'allowed', 'filter', 'safety', 'rank']);
  });

  it('stops after a step that sets the stopped flag', async () => {
    const steps = [step(() => undefined), step((c) => { c.stopped = true; }), step(() => undefined), step(() => undefined), step(() => undefined)];
    await build(steps).run(pipelineInput());
    expect(steps[2].run).not.toHaveBeenCalled();
  });

  it('returns the shared context with the input attached', async () => {
    const steps = Array.from({ length: 5 }, () => step(() => undefined));
    const input = pipelineInput();
    expect((await build(steps).run(input)).input).toBe(input);
  });
});
