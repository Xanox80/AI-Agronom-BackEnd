import { Body, Controller, Get, Headers, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Role } from '../../domain/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { CatalogPackService } from './catalog-pack.service';
import { CatalogStatusService } from './catalog-status.service';
import { CatalogService } from './catalog.service';
import { DiagnosisQueryDto, PackQueryDto, ProductQueryDto, ThresholdQueryDto } from './dto/catalog-query.dto';
import type {
  ActiveSubstanceDto, BbchStageDto, CatalogDiagnosisDto, CatalogPackDto, CatalogStatusDto, CropDto, ProductDto,
  ProductRegistrationDto, ReferenceImageDto, ThresholdDto,
} from './dto/catalog.dto';
import { VerifyCatalogDto } from './dto/proposal.dto';
import { ReferenceImageFileService } from './reference-image-file.service';

const NOT_MODIFIED = 304;

@ApiTags('catalog')
@ApiBearerAuth()
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly status: CatalogStatusService,
    private readonly packs: CatalogPackService,
    private readonly imageFiles: ReferenceImageFileService,
  ) {}

  @Get('crops') @ApiOperation({ summary: 'Pilot crops' })
  crops(): Promise<CropDto[]> { return this.catalog.listCrops(); }

  @Get('crops/:id/bbch') @ApiOperation({ summary: 'BBCH stages of a crop' })
  bbch(@Param('id') id: string): Promise<BbchStageDto[]> { return this.catalog.listBbchStages(id); }

  @Get('diagnoses') @ApiOperation({ summary: 'Diagnosis catalogue' })
  diagnoses(@Query() query: DiagnosisQueryDto): Promise<CatalogDiagnosisDto[]> { return this.catalog.listDiagnoses(query); }

  @Get('diagnoses/:id/references') @ApiOperation({ summary: 'Reference images of a diagnosis (FR-10)' })
  references(@Param('id') id: string): Promise<ReferenceImageDto[]> { return this.catalog.getReferenceImages(id); }

  @Get('thresholds') @ApiOperation({ summary: 'Economic thresholds, EPSH (FR-13)' })
  thresholds(@Query() query: ThresholdQueryDto): Promise<ThresholdDto[]> { return this.catalog.getThresholds(query); }

  @Get('products') @ApiOperation({ summary: 'Plant protection products (FR-14)' })
  products(@Query() query: ProductQueryDto): Promise<ProductDto[]> { return this.catalog.listProducts(query); }

  @Get('products/:id/registrations') @ApiOperation({ summary: 'Allowed uses of a product' })
  registrations(@Param('id') id: string): Promise<ProductRegistrationDto[]> { return this.catalog.getProductRegistrations(id); }

  @Get('active-substances') @ApiOperation({ summary: 'Active substances with FRAC/IRAC/HRAC groups (FR-17)' })
  substances(): Promise<ActiveSubstanceDto[]> { return this.catalog.listActiveSubstances(); }

  @Get('status') @ApiOperation({ summary: 'Catalogue version and stale-data warning' })
  getStatus(@Query('region') region?: string): Promise<CatalogStatusDto> { return this.status.getStatus(region); }

  @Get('pack') @ApiOperation({ summary: 'Regional pack for offline use, full or delta; supports ETag / If-None-Match (FR-25)' })
  async pack(
    @Query() query: PackQueryDto,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CatalogPackDto | undefined> {
    const etag = await this.packs.etag(query.region, query.sinceVersion);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'no-cache');
    if (ifNoneMatch === etag) {
      res.status(NOT_MODIFIED);
      return undefined;
    }
    return this.packs.build(query.region, query.sinceVersion);
  }

  @Get('reference-images/:id/file') @ApiOperation({ summary: 'Reference image bytes' })
  async imageFile(@Param('id') id: string, @Res() res: Response): Promise<void> { await this.imageFiles.send(id, res); }

  @Post('verify') @Roles(Role.ChiefAgronomist) @ApiOperation({ summary: 'Mark reference data as re-verified' })
  verify(@Body() dto: VerifyCatalogDto): Promise<CatalogStatusDto> {
    return this.status.markVerified(dto.regionCode);
  }
}
