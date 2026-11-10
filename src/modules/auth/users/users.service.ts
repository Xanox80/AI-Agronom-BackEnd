import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
import { Repository } from 'typeorm';
import { UserEntity } from '../../../domain/entities';
import { Page, UserDto } from '../../../domain/types';
import { DEFAULT_LOCALE } from '../auth.constants';
import { AuthSettings } from '../auth.settings';
import { UpdateProfileDto } from '../dto/auth.dto';
import { CreateUserDto, PageQueryDto, UpdateUserDto } from '../dto/users.dto';
import { stripUndefined } from '../strip-undefined';
import { TokenService } from '../token/token.service';
import { toUserDto } from './user.mapper';
import { TrustWeightResolver } from './trust-weight.resolver';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly settings: AuthSettings,
    private readonly trustWeights: TrustWeightResolver,
    private readonly tokens: TokenService,
  ) {}

  async list(farmId: string, { page, pageSize }: PageQueryDto): Promise<Page<UserDto>> {
    const [rows, total] = await this.users.findAndCount({
      where: { farmId }, order: { displayName: 'ASC' }, skip: (page - 1) * pageSize, take: pageSize,
    });
    return { items: rows.map(toUserDto), total, page, pageSize };
  }

  async get(id: string): Promise<UserDto> {
    return toUserDto(await this.require({ id }));
  }

  async create(farmId: string, dto: CreateUserDto): Promise<UserDto> {
    const email = dto.email.toLowerCase();
    if (await this.users.existsBy({ email })) throw new ConflictException('Email already in use');
    const user = this.users.create({
      farmId, email, displayName: dto.displayName, role: dto.role, regionCode: dto.regionCode ?? null,
      passwordHash: await this.hashPassword(dto.password), trustWeight: this.trustWeights.forRole(dto.role),
      locale: DEFAULT_LOCALE, geoCollectionEnabled: true, isActive: true,
    });
    return toUserDto(await this.users.save(user));
  }

  async update(farmId: string, id: string, dto: UpdateUserDto): Promise<UserDto> {
    const user = await this.require({ id, farmId });
    if (dto.displayName !== undefined) user.displayName = dto.displayName;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.role !== undefined) {
      user.role = dto.role;
      user.trustWeight = this.trustWeights.forRole(dto.role);
    }
    if (dto.geoCollectionEnabled !== undefined) user.geoCollectionEnabled = dto.geoCollectionEnabled;
    if (dto.trustWeight !== undefined) user.trustWeight = dto.trustWeight;
    if (dto.password !== undefined) user.passwordHash = await this.hashPassword(dto.password);
    const saved = await this.users.save(user);
    if (dto.password !== undefined || dto.isActive === false) await this.tokens.revokeAllFor(id);
    return toUserDto(saved);
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<UserDto> {
    const user = await this.require({ id });
    const { displayName, locale, geoCollectionEnabled } = dto;
    Object.assign(user, stripUndefined({ displayName, locale, geoCollectionEnabled }));
    return toUserDto(await this.users.save(user));
  }

  hashPassword(password: string): Promise<string> {
    return hash(password, this.settings.auth.bcryptRounds);
  }

  private async require(where: { id: string; farmId?: string }): Promise<UserEntity> {
    const user = await this.users.findOne({ where });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
