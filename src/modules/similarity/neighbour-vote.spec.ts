import { closestExamples, voteOnNeighbours } from './neighbour-vote';
import { ReferenceNeighbour } from './similarity.types';

let nextId = 0;
const n = (diagnosisCode: string, score: number, id = `p${nextId++}`): ReferenceNeighbour =>
  ({ id, attribution: 'kaggle', diagnosisCode, cropCode: 'wheat_winter', score });

describe('voteOnNeighbours', () => {
  it('gives the class with more and closer neighbours the larger share', () => {
    const vote = voteOnNeighbours([[n('rust', 0.9), n('rust', 0.85), n('septoria', 0.8)]], ['rust', 'septoria'], 1);

    expect(vote!.votes.rust).toBeGreaterThan(vote!.votes.septoria);
    expect(vote!.votes.rust + vote!.votes.septoria).toBeCloseTo(1);
    expect(vote).toMatchObject({ bestScore: 0.9, neighbourCount: 3 });
  });

  it('sharpens toward the closest neighbour as the exponent grows', () => {
    const neighbours = [[n('rust', 0.95), n('septoria', 0.7), n('septoria', 0.7)]];
    const flat = voteOnNeighbours(neighbours, ['rust', 'septoria'], 1)!;
    const sharp = voteOnNeighbours(neighbours, ['rust', 'septoria'], 8)!;

    expect(sharp.votes.rust).toBeGreaterThan(flat.votes.rust);
  });

  it('averages photos so each angle counts once regardless of neighbour count', () => {
    const vote = voteOnNeighbours([[n('rust', 0.9)], [n('septoria', 0.9), n('septoria', 0.9), n('septoria', 0.9)]], ['rust', 'septoria'], 1)!;

    expect(vote.votes).toEqual({ rust: 0.5, septoria: 0.5 });
  });

  it('ignores neighbours whose code is not allowed', () => {
    const vote = voteOnNeighbours([[n('rust', 0.9), n('maize_only', 0.99)]], ['rust'], 1)!;

    expect(vote).toMatchObject({ votes: { rust: 1 }, bestScore: 0.9, neighbourCount: 1 });
  });

  it('returns null when no usable neighbour is found', () => {
    expect(voteOnNeighbours([[], [n('other_crop', 0.9)]], ['rust'], 1)).toBeNull();
  });
});

describe('closestExamples', () => {
  it('keeps the closest distinct photos per allowed code, best first', () => {
    const examples = closestExamples([
      [n('rust', 0.9, 'a'), n('rust', 0.8, 'b'), n('rust', 0.7, 'c'), n('septoria', 0.85, 'd'), n('other', 0.99, 'e')],
      [n('rust', 0.95, 'a')],
    ], ['rust', 'septoria'], 2);

    expect(examples.map((e) => [e.id, e.diagnosisCode, e.score])).toEqual([['a', 'rust', 0.95], ['d', 'septoria', 0.85], ['b', 'rust', 0.8]]);
    expect(examples[0].attribution).toBe('kaggle');
  });
});
