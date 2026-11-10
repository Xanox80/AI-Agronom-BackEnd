import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/roles.decorator';

@ApiTags('sync')
@Controller('health')
export class HealthController {
  @Get() @Public()
  @ApiOperation({ summary: 'Liveness probe used by the client to detect connectivity' })
  health(): { status: 'ok'; time: string } {
    return { status: 'ok', time: new Date().toISOString() };
  }
}
