import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../domain/enums';
import { Page } from '../../domain/types';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { StockImportResultDto, StockItemDto, StockQueryDto, UpsertStockDto } from './dto/stock.dto';
import { StockService } from './stock.service';
import { StockSettings } from './stock.settings';

@ApiTags('stock')
@ApiBearerAuth()
@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService, private readonly settings: StockSettings) {}

  @Get()
  @ApiOperation({ summary: 'List stock items of the caller farm' })
  list(@CurrentUser() user: AuthUser, @Query() query: StockQueryDto): Promise<Page<StockItemDto>> {
    return this.stock.list(user.farmId, query);
  }

  @Post('import')
  @Roles(Role.ChiefAgronomist)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Import stock rows from CSV' })
  @UseInterceptors(FileInterceptor('file'))
  importCsv(@CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File): Promise<StockImportResultDto> {
    if (!file) throw new BadRequestException('CSV file is required');
    if (file.size > this.settings.maxImportKb * 1024) throw new BadRequestException('CSV file is too large');
    return this.stock.importCsv(user.farmId, file.buffer.toString('utf8'));
  }

  @Put(':productId')
  @Roles(Role.ChiefAgronomist)
  @ApiOperation({ summary: 'Create or replace the stock row of a product/warehouse/lot' })
  upsert(
    @CurrentUser() user: AuthUser, @Param('productId', ParseUUIDPipe) productId: string, @Body() dto: UpsertStockDto,
  ): Promise<StockItemDto> {
    return this.stock.upsert(user.farmId, productId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.ChiefAgronomist)
  @ApiOperation({ summary: 'Delete a stock row' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.stock.remove(user.farmId, id);
  }
}
