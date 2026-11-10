import { DiagnosisPass } from '../../domain/enums';
import { RecognitionController } from './recognition.controller';

describe('RecognitionController', () => {
  const recognition = { diagnose: jest.fn(), answer: jest.fn(), latest: jest.fn(), status: jest.fn() };
  const controller = new RecognitionController(recognition as never);
  const user = { id: 'u1', farmId: 'f1' } as never;

  beforeEach(() => jest.clearAllMocks());

  it('runs the initial pass on diagnose', async () => {
    await controller.diagnose('o1', { locale: 'en' }, user);
    expect(recognition.diagnose).toHaveBeenCalledWith('o1', 'f1', DiagnosisPass.Initial, 'en');
  });

  it('runs the server_refined pass on refine', async () => {
    await controller.refine('o1', {}, user);
    expect(recognition.diagnose).toHaveBeenCalledWith('o1', 'f1', DiagnosisPass.ServerRefined, undefined);
  });

  it('passes answers with the farm scope', async () => {
    await controller.answer('r1', { answers: { halo: 'yes' } }, user);
    expect(recognition.answer).toHaveBeenCalledWith('r1', 'f1', { halo: 'yes' });
  });

  it('reads the latest diagnosis and the status', () => {
    controller.latest('o1', user);
    controller.status();
    expect(recognition.latest).toHaveBeenCalledWith('o1', 'f1');
    expect(recognition.status).toHaveBeenCalled();
  });
});
