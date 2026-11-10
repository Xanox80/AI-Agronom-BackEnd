import { Body, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProposalEntityType, ProposalOperation, Role } from '../../domain/enums';
import type { Page } from '../../domain/types';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CatalogProposalService } from './catalog-proposal.service';
import { ProposalQueryDto } from './dto/catalog-query.dto';
import {
  ApproveProposalDto, CreateProposalDto, ProposalDto, ReferenceImageUploadDto, RejectProposalDto,
} from './dto/proposal.dto';
import { ReferenceImageFileService } from './reference-image-file.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller('catalog')
export class CatalogProposalsController {
  constructor(
    private readonly proposals: CatalogProposalService,
    private readonly imageFiles: ReferenceImageFileService,
  ) {}

  @Get('proposals') @Roles(Role.ChiefAgronomist, Role.Expert) @ApiOperation({ summary: 'Directory change proposals' })
  list(@Query() query: ProposalQueryDto): Promise<Page<ProposalDto>> { return this.proposals.list(query); }

  @Post('proposals') @Roles(Role.ChiefAgronomist, Role.Expert) @ApiOperation({ summary: 'Propose a directory change' })
  create(@Body() dto: CreateProposalDto, @CurrentUser() user: AuthUser): Promise<ProposalDto> {
    return this.proposals.create(dto, user);
  }

  @Post('proposals/:id/approve') @Roles(Role.ChiefAgronomist) @ApiOperation({ summary: 'Approve, apply and publish a proposal' })
  approve(@Param('id') id: string, @Body() dto: ApproveProposalDto, @CurrentUser() user: AuthUser): Promise<ProposalDto> {
    return this.proposals.approve(id, user.id, dto.comment);
  }

  @Post('proposals/:id/reject') @Roles(Role.ChiefAgronomist) @ApiOperation({ summary: 'Reject a proposal' })
  reject(@Param('id') id: string, @Body() dto: RejectProposalDto, @CurrentUser() user: AuthUser): Promise<ProposalDto> {
    return this.proposals.reject(id, user.id, dto.comment);
  }

  @Post('reference-images') @Roles(Role.ChiefAgronomist, Role.Expert)
  @ApiConsumes('multipart/form-data') @ApiOperation({ summary: 'Upload a reference image as a pending proposal' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadReferenceImage(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: ReferenceImageUploadDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ProposalDto> {
    const storageKey = await this.imageFiles.store(file);
    return this.proposals.create({
      entityType: ProposalEntityType.ReferenceImage, operation: ProposalOperation.Create,
      payload: { diagnosisId: dto.diagnosisId, caption: dto.caption, attribution: dto.attribution, stage: dto.stage ?? null, storageKey },
    }, user);
  }
}
