import { candidate, productView, registration } from '../__fixtures__/pipeline-fixtures';
import { incompatiblePairs } from './tank-mix.check';

const item = (id: string, incompatibleWith: string[] = []) => candidate({
  registration: registration({ incompatibleWith }), product: productView({ id, name: id }),
});

describe('incompatiblePairs', () => {
  it('reports a pair when one label lists the other product', () => {
    expect(incompatiblePairs([item('a'), item('b', ['a'])])).toEqual([['a', 'b']]);
  });
  it('reports nothing for compatible products', () => {
    expect(incompatiblePairs([item('a'), item('b')])).toEqual([]);
  });
});
