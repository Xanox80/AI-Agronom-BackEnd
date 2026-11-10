import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../domain/enums';
import type { FieldDto, Page } from '../../domain/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/auth.types';
import { CropMemoryDto, ImportQueryDto, ImportResult, LocateQueryDto, LocateResult } from './dto/field-geo.dto';
import { CreateFieldDto, ListFieldsQueryDto, UpdateFieldDto } from './dto/field.dto';
import { FieldImportService } from './field-import.service';
import { FieldLocatorService } from './field-locator.service';
import { FieldsService } from './fields.service';

@ApiTags('fields')
@ApiBearerAuth()
@Controller('fields')
export class FieldsController {
  constructor(
    private readonly fields: FieldsService,
    private readonly importer: FieldImportService,
    private readonly locator: FieldLocatorService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List fields of the caller farm' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListFieldsQueryDto): Promise<Page<FieldDto>> {
    return this.fields.list(user.farmId, query);
  }

  @Get('locate')
  @ApiOperation({ summary: 'Fields containing a GPS point; nearest candidates when none contains it' })
  locate(@CurrentUser() user: AuthUser, @Query() query: LocateQueryDto): Promise<LocateResult> {
    return this.locator.locate(user.farmId, query.lat, query.lng);
  }

  @Post('import')
  @Roles(Role.ChiefAgronomist)
  @ApiOperation({ summary: 'Import fields from KML, GeoJSON or zipped Shapefile (dryRun=true previews)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file'))
  async import(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query() query: ImportQueryDto,
  ): Promise<ImportResult<FieldDto>> {
    if (!file) throw new BadRequestException({ code: 'IMPORT_FILE_MISSING', message: ['file is required'] });
    return this.importer.import(user.farmId, file.originalname, file.buffer, query.dryRun === 'true', user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<FieldDto> {
    return this.fields.get(user.farmId, id);
  }

  @Post()
  @Roles(Role.Scout, Role.ChiefAgronomist)
  create(@CurrentUser() user: AuthUser, @Body() body: CreateFieldDto): Promise<FieldDto> {
    return this.fields.create(user.farmId, body, user.id);
  }

  @Patch(':id')
  @Roles(Role.Scout, Role.ChiefAgronomist)
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateFieldDto): Promise<FieldDto> {
    return this.fields.update(user.farmId, id, body, user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.ChiefAgronomist)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.fields.remove(user.farmId, id);
  }

  @Get(':id/crop-memory')
  recallCrop(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<{ cropId?: string }> {
    return this.fields.recallCrop(user.farmId, user.id, id);
  }

  @Put(':id/crop-memory')
  @HttpCode(204)
  rememberCrop(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: CropMemoryDto): Promise<void> {
    return this.fields.rememberCrop(user.farmId, user.id, id, body.cropId);
  }
}
