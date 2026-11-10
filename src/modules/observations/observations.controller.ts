import {
  Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../domain/enums';
import type { ObservationDto, Page, PhotoDto, VoiceNoteDto } from '../../domain/types';
import { ConfirmObservationDto } from './dto/confirm-observation.dto';
import { CreateObservationDto } from './dto/create-observation.dto';
import { ListObservationsQuery } from './dto/list-observations.query';
import { UpdateObservationDto } from './dto/update-observation.dto';
import { UploadPhotoDto, UploadVoiceNoteDto } from './dto/upload-media.dto';
import { AuthUser, CurrentUser, Roles } from './observation-access';
import { ObservationConfirmationService } from './observation-confirmation.service';
import { ObservationMediaService } from './observation-media.service';
import { ObservationsService } from './observations.service';

const FILE_FIELD = 'file';

@ApiTags('observations')
@ApiBearerAuth()
@Controller('observations')
export class ObservationsController {
  constructor(
    private readonly observations: ObservationsService,
    private readonly confirmation: ObservationConfirmationService,
    private readonly media: ObservationMediaService,
  ) {}

  @Post()
  @Roles(Role.Scout, Role.ChiefAgronomist, Role.Mechanic)
  @ApiOperation({ summary: 'Create an observation (idempotent by clientId); mechanics create quick captures' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateObservationDto, @Headers('user-agent') userAgent?: string): Promise<ObservationDto> {
    return this.observations.create(user, dto, userAgent);
  }

  @Get()
  @ApiOperation({ summary: 'List observations of the farm' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListObservationsQuery): Promise<Page<ObservationDto>> {
    return this.observations.list(user, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ObservationDto> {
    return this.observations.get(user, id);
  }

  @Patch(':id')
  @Roles(Role.Scout, Role.ChiefAgronomist, Role.Mechanic)
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateObservationDto): Promise<ObservationDto> {
    return this.observations.update(user, id, dto);
  }

  @Post(':id/photos')
  @Roles(Role.Scout, Role.ChiefAgronomist, Role.Mechanic)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor(FILE_FIELD))
  uploadPhoto(
    @CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined, @Body() dto: UploadPhotoDto,
  ): Promise<PhotoDto> {
    return this.media.uploadPhoto(user, id, file, dto);
  }

  @Post(':id/voice-note')
  @Roles(Role.Scout, Role.ChiefAgronomist, Role.Mechanic)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor(FILE_FIELD))
  uploadVoiceNote(
    @CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined, @Body() dto: UploadVoiceNoteDto,
  ): Promise<VoiceNoteDto> {
    return this.media.uploadVoiceNote(user, id, file, dto);
  }

  @Post(':id/confirm')
  @Roles(Role.Scout, Role.ChiefAgronomist)
  @ApiOperation({ summary: 'Confirm or correct the diagnosis' })
  confirm(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmObservationDto): Promise<ObservationDto> {
    return this.confirmation.confirm(user, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ChiefAgronomist)
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.observations.remove(user, id);
  }
}
