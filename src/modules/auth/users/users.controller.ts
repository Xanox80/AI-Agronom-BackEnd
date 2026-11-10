import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../domain/enums';
import { Page, UserDto } from '../../../domain/types';
import { AuthUser } from '../auth.types';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { CreateUserDto, PageQueryDto, UpdateUserDto } from '../dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Roles(Role.ChiefAgronomist)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: PageQueryDto): Promise<Page<UserDto>> {
    return this.users.list(user.farmId, query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto): Promise<UserDto> {
    return this.users.create(user.farmId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto): Promise<UserDto> {
    return this.users.update(user.farmId, id, dto);
  }
}
