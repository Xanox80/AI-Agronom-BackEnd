import { VisionPhoto } from '../vision-provider/vision.types';

export const IMAGE_EMBEDDER = Symbol('IMAGE_EMBEDDER');
export const REFERENCE_INDEX = Symbol('REFERENCE_INDEX');

/** Turns a photo into a unit-length vector; similar-looking photos get close vectors. */
export interface ImageEmbedder {
  embed(photo: VisionPhoto): Promise<number[]>;
}

/** What is stored next to each vector: the label, never the image itself. */
export interface ReferencePayload {
  diagnosisCode: string;
  cropCode: string;
  /** Dataset name from the mapping file, e.g. "plantvillage" or "expert". */
  source: string;
  /** Path relative to the dataset folder (or the photo storage key for confirmed observations). */
  imagePath: string;
  datasetLabel: string;
  /** Dataset folder relative to SIMILARITY_DATASETS_DIR; absent for confirmed observations. */
  datasetRoot?: string;
  /** Credit shown under the photo, e.g. "Kaggle: wheat-plant-diseases (CC0)". */
  attribution?: string;
}

/** Source name of photos added from confirmed observations in the app. */
export const CONFIRMED_SOURCE = 'confirmed';

export interface ReferencePoint {
  id: string;
  vector: number[];
  payload: ReferencePayload;
}

export interface LabelledReference {
  vector: number[];
  diagnosisCode: string;
  source: string;
}

export interface ReferenceNeighbour {
  id: string;
  attribution: string;
  diagnosisCode: string;
  cropCode: string;
  /** Cosine similarity, 1 = identical. */
  score: number;
}

/** Vector store of labelled reference photos. */
export interface ReferenceIndex {
  /** Creates the collection and its payload indexes when missing. */
  prepare(dimension: number): Promise<void>;
  upsert(points: ReferencePoint[]): Promise<void>;
  /** Drops every point of one dataset source, so a re-index with another selection leaves no stale points. */
  removeSource(source: string): Promise<void>;
  /** Every stored vector with its diagnosis code and dataset source: the training set for the reference classifier. */
  labelledVectors(): Promise<LabelledReference[]>;
  nearest(vector: number[], cropCode: string | null, limit: number): Promise<ReferenceNeighbour[]>;
  /** Stored label and file location of one point; null when it does not exist. */
  payloadOf(id: string): Promise<ReferencePayload | null>;
}

/** A labelled photo close to the scout's photo, shown for comparison. */
export interface ReferenceExample {
  id: string;
  diagnosisCode: string;
  score: number;
  attribution: string;
}

/** The labelled neighbours' opinion on a set of photos. */
export interface SimilarityEvidence {
  /** Diagnosis code to vote share; shares sum to 1. */
  votes: Record<string, number>;
  bestScore: number;
  neighbourCount: number;
  /** Where `votes` came from: the trained classifier, or the kNN vote when no classifier is trained. */
  voteSource: 'classifier' | 'neighbours';
  /** Closest labelled photos per diagnosis code, best first. */
  examples: ReferenceExample[];
  /** True when even the closest labelled photo is below SIMILARITY_OOD_MIN_SCORE. */
  farFromReferences: boolean;
}
