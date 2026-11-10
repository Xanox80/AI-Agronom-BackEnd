import { Repository } from 'typeorm';
import { ObservationEntity } from '../../../domain/entities';
import { DiagnosisPass } from '../../../domain/enums';

const PENDING_REFINEMENT_SQL = `
  EXISTS (SELECT 1 FROM sync_records s WHERE s.entityType = 'observation' AND s.serverId = o.id)
  AND EXISTS (SELECT 1 FROM photos p WHERE p.observationId = o.id)
  AND NOT EXISTS (SELECT 1 FROM diagnosis_results d WHERE d.observationId = o.id AND d.pass = :refinedPass)`;

/** Synced observations with photos that still lack a `server_refined` diagnosis (FR-26); the database is the durable queue. */
export const pendingRefinementQuery = (observations: Repository<ObservationEntity>) =>
  observations.createQueryBuilder('o').where(PENDING_REFINEMENT_SQL, { refinedPass: DiagnosisPass.ServerRefined });
