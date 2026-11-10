import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditActionResolver } from './audit-action.resolver';
import { AuditService } from './audit.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Appends an audit row for each successful mutating request by an authenticated user; bodies are never stored. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly audit: AuditService, private readonly actions: AuditActionResolver) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    if (!MUTATING_METHODS.has(req.method)) return next.handle();
    return next.handle().pipe(
      tap((body) => {
        if (req.user) void this.write(req, http.getResponse().statusCode, body);
      }),
    );
  }

  private async write(req: any, statusCode: number, body: unknown): Promise<void> {
    const routePath: string = req.route?.path ?? req.path;
    const { action, entityType } = this.actions.resolve(req.method, routePath);
    const entityId = req.params?.id ?? (body as { id?: string } | undefined)?.id ?? '';
    try {
      await this.audit.record({
        farmId: req.user.farmId, userId: req.user.id, action, entityType, entityId: String(entityId),
        ip: req.ip ?? null, meta: { method: req.method, route: routePath, statusCode },
      });
    } catch {
      this.logger.warn(`Audit write failed for ${action}`);
    }
  }
}
