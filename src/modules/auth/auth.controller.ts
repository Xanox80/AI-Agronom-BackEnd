import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserDto } from '../../domain/types';
import { AuthService, LoginResult, RefreshResult } from './auth.service';
import { AuthUser } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/roles.decorator';
import { LoginDto, RefreshDto, UpdateProfileDto } from './dto/auth.dto';
import { UsersService } from './users/users.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly users: UsersService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange email and password for tokens' })
  login(@Body() dto: LoginDto, @Req() req: { ip?: string }): Promise<LoginResult> {
    return this.auth.login(dto, req.ip ?? null);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token' })
  refresh(@Body() dto: RefreshDto): Promise<RefreshResult> {
    return this.auth.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() dto: RefreshDto): Promise<void> {
    return this.auth.logout(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.users.get(user.id);
  }

  @ApiBearerAuth()
  @Patch('me')
  @ApiOperation({ summary: 'Update own profile, locale and the geolocation-collection opt-out' })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto): Promise<UserDto> {
    return this.users.updateProfile(user.id, dto);
  }
}
