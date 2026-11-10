/** Combines one class's per-frame scores (missing frames passed as 0; `minProbability` floors them for the geometric mean) into a single score. */
export type FrameScoreAggregation = (scores: number[], minProbability: number) => number;

const mean = (scores: number[]): number => scores.reduce((total, score) => total + score, 0) / scores.length;

export const FRAME_SCORE_AGGREGATIONS: Record<'mean_prob' | 'mean_log_prob', FrameScoreAggregation> = {
  mean_prob: mean,
  mean_log_prob: (scores, minProbability) => Math.exp(mean(scores.map((score) => Math.log(Math.max(score, minProbability))))),
};
