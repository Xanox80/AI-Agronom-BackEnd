import { AuditRecord } from '../auth/audit/audit.service';
import { AuthUser } from '../auth/auth.types';

/** Domain audit actions; the generic request interceptor of be-auth writes the plain `recommendation.approve` style rows separately. */
export const AuditAction = {
  RecommendationDrafted: 'recommendation.drafted',
  RecommendationAutoApproved: 'recommendation.auto_approved',
  RecommendationApproved: 'recommendation.approved',
  RecommendationRejected: 'recommendation.rejected',
  RecommendationRecomputed: 'recommendation.recomputed',
  AutoApproveSettingSaved: 'auto_approve_setting.saved',
  AutoApproveSettingRemoved: 'auto_approve_setting.removed',
} as const;

export const RECOMMENDATION_ENTITY = 'recommendation';
export const AUTO_APPROVE_SETTING_ENTITY = 'auto_approve_setting';

export interface RequestMeta { ip?: string; locale?: string }

export function auditEntry(action: string, user: AuthUser, entityType: string, entityId: string, meta: Record<string, unknown>, ip?: string): AuditRecord {
  return { farmId: user.farmId, userId: user.id, action, entityType, entityId, ip: ip ?? null, meta };
}
