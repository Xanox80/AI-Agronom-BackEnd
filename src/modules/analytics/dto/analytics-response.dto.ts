import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HeatmapPointDto {
  @ApiProperty() lat: number;
  @ApiProperty() lng: number;
  @ApiProperty({ description: 'Confirmed = 1, otherwise the top-1 calibrated probability' }) weight: number;
  @ApiProperty() diagnosisCode: string;
  @ApiProperty() observationId: string;
}

export class HeatmapFieldDto {
  @ApiProperty() fieldId: string;
  @ApiProperty() name: string;
  @ApiProperty() count: number;
  @ApiPropertyOptional({ type: Object, description: 'GeoJSON geometry' }) contour?: unknown;
}

export class HeatmapResponseDto {
  @ApiProperty({ type: [HeatmapPointDto] }) points: HeatmapPointDto[];
  @ApiProperty({ type: [HeatmapFieldDto] }) fields: HeatmapFieldDto[];
}

export class CountByDiagnosisDto {
  @ApiProperty() code: string;
  @ApiProperty() name: string;
  @ApiProperty() count: number;
}

export class CountByFieldDto {
  @ApiProperty() fieldId: string;
  @ApiProperty() name: string;
  @ApiProperty() count: number;
}

export class CountByWeekDto {
  @ApiProperty({ description: 'Monday of the week, YYYY-MM-DD (UTC)' }) week: string;
  @ApiProperty() count: number;
}

export class SummaryResponseDto {
  @ApiProperty() total: number;
  @ApiProperty({ type: [CountByDiagnosisDto] }) byDiagnosis: CountByDiagnosisDto[];
  @ApiProperty({ type: [CountByFieldDto] }) byField: CountByFieldDto[];
  @ApiProperty({ type: [CountByWeekDto] }) byWeek: CountByWeekDto[];
}

export class ExportPageDto {
  @ApiProperty({ type: [Object], description: 'Versioned export DTOs (schemaVersion 1); item schema per endpoint' }) items: unknown[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty({ type: [String], description: 'Scout ids removed since updatedSince (fields only; empty otherwise)' }) deleted: string[];
}
