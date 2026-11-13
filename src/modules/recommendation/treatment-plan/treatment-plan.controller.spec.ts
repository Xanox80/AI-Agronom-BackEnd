import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TreatmentPlanController, TreatmentPlanRequestDto } from './treatment-plan.controller';
import { TreatmentPlanService } from './treatment-plan.service';

describe('TreatmentPlanController', () => {
  it('asks for the plan of the caller farm with the given tank volume', async () => {
    const generate = jest.fn().mockResolvedValue({ status: 'ready' });
    const controller = new TreatmentPlanController({ generate } as unknown as TreatmentPlanService);
    await controller.generate({ id: 'u', farmId: 'farm' } as never, 'rec', { tankVolumeL: 2000 });
    expect(generate).toHaveBeenCalledWith('farm', 'rec', 2000);
  });

  it('accepts no tank volume and rejects an impossible one', async () => {
    expect(await validate(plainToInstance(TreatmentPlanRequestDto, {}))).toHaveLength(0);
    expect(await validate(plainToInstance(TreatmentPlanRequestDto, { tankVolumeL: 10 }))).toHaveLength(1);
  });
});
