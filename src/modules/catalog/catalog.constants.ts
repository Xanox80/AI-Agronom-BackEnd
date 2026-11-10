import { ProposalEntityType } from '../../domain/enums';

export const SEED_REGISTRY_SOURCE = 'DEMO seed - verify against the State Register of pesticides of Ukraine';
export const SEED_REFERENCE_SOURCE = 'DEMO seed - verify against agronomist technology cards and the BBCH monograph';
export const SEED_ACTUALITY_DATE = '2026-11-10';
export const SEED_SOURCE_REF = 'seed-v1';
export const REFERENCE_IMAGES_PER_DIAGNOSIS = 3;
export const APPROVED_PROPOSAL_SOURCE = 'approved_proposal';

export const MS_PER_DAY = 86_400_000;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const REFERENCE_IMAGE_DIR = 'reference-images';
export const PLACEHOLDER_PREFIX = 'placeholder:';
export const REFERENCE_IMAGE_ROUTE = 'catalog/reference-images';

export const EXPERT_PROPOSAL_TYPES: readonly ProposalEntityType[] = [
  ProposalEntityType.Diagnosis,
  ProposalEntityType.ReferenceImage,
];

export const STORAGE_KEY_PATTERN = /^[\w-]+\.\w+$/;
