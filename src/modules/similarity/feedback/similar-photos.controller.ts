import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReferencePhotoFiles } from './reference-photo-files.service';

const CACHE_CONTROL = 'private, max-age=86400';

@ApiTags('similarity')
@ApiBearerAuth()
@Controller('similarity')
export class SimilarPhotosController {
  constructor(private readonly files: ReferencePhotoFiles) {}

  @Get('photos/:id') @ApiOperation({ summary: 'Bytes of a labelled photo similar to a diagnosed one (DiagnosisResultDto.referenceImages)' })
  async photo(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response): Promise<void> {
    const { bytes, mimeType } = await this.files.read(id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', CACHE_CONTROL);
    res.send(bytes);
  }
}
