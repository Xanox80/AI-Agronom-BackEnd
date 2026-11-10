/** Implemented by be-recognition (pass `server_refined`, FR-26); sync only schedules it. */
export interface ObservationRefiner {
  refine(observationId: string, farmId: string): Promise<void>;
}

export const OBSERVATION_REFINER = Symbol('OBSERVATION_REFINER');
