# AP Scout architecture contract

Status: authoritative for all implementation agents. Spec: `ТЗ_AP_Scout_...pdf` (v0.1, 10.11.2026). If code and this file disagree, fix the code or amend this file in the same change.

Stack: backend NestJS 10 + TypeORM + SQLite (better-sqlite3) in `backend/`; frontend Angular 21 standalone + PrimeNG 21 + ngx-translate + Leaflet PWA in `frontend/`. API prefix `/api/v1`. Dates are ISO-8601 UTC strings. All ids are UUID v4 strings. Code and comments in English; UI strings via i18n (`uk` default, `en`).

General rules (all modules):
- No magic numbers or endpoints: tunables come from `ConfigService` (section 4). Never log secrets, tokens, or personal data (no coordinates of users in logs, no raw photo bytes).
- One test file per production class (`*.spec.ts` beside it). Strategies instead of growing `switch` chains. Constructor injection.
- UI components hold display logic only; work lives in services (`core/api` clients + feature services).
- Cross-module calls on the backend go through exported services/interfaces of the other module, or `EventEmitter2` events listed in 3.14. Never import another module's internals.

---

## 1. Traceability (FR / sections -> modules)

| Requirement | Backend module(s) | Frontend module(s) |
|---|---|---|
| Section 2 roles | be-auth | fe-shell |
| Scenario step 1 (pick field by GPS, crop remembered) | be-fields, be-observations | fe-scouting, fe-fields |
| Scenario step 2 (capture hint, quality check) | - | fe-scouting, fe-quality-gate |
| Scenario step 3 (1-3 photos, voice/text note) | be-observations | fe-scouting |
| Scenario step 4 (top-3, references, questions) | be-recognition, be-vision-provider, be-catalog | fe-diagnosis |
| Scenario step 5 (recommendation) | be-recommendation | fe-recommendation |
| Scenario step 6 (confirm/correct, create task) | be-tasks, be-observations | fe-diagnosis, fe-tasks |
| Scenario step 7 (history, corrections to dataset) | be-observations, be-expert | fe-diagnosis |
| FR-1 capture hints | - | fe-scouting |
| FR-2 on-device quality gate | - | fe-quality-gate |
| FR-3 2-3 angles, aggregation | be-observations, be-recognition | fe-scouting |
| FR-4 scale marker (optional) | be-observations (flag `scaleMarkerUsed`) | fe-scouting |
| FR-5 metadata (GPS, time, field, crop, BBCH, weather, device) | be-observations, be-weather | fe-scouting |
| FR-6 3-step classification | be-recognition, be-vision-provider | fe-diagnosis |
| FR-7 top-3 calibrated | be-recognition, be-vision-provider (raw) | fe-diagnosis |
| FR-8 "not sure" mode | be-recognition | fe-diagnosis |
| FR-9 pest species/stage/density | be-recognition, be-vision-provider | fe-diagnosis |
| FR-10 explanation (region + references) | be-vision-provider (region), be-catalog (reference images), be-recognition | fe-diagnosis |
| FR-11 clarifying questions | be-vision-provider, be-recognition | fe-diagnosis |
| FR-12 rule-based recommendations | be-recommendation | fe-recommendation |
| FR-13 thresholds (EPSH) and phase | be-catalog, be-recommendation | fe-recommendation |
| FR-14 products from registry | be-catalog, be-recommendation | fe-recommendation |
| FR-15 stock | be-stock, be-recommendation | fe-recommendation, fe-settings |
| FR-16 72h weather window | be-weather, be-recommendation | fe-recommendation |
| FR-17 resistance rotation | be-catalog (groups), be-recommendation | fe-recommendation |
| FR-18 safety restrictions | be-recommendation | fe-recommendation |
| FR-19 draft status + auto-approve | be-recommendation | fe-recommendation, fe-settings |
| FR-20 field directory + import/draw | be-fields | fe-fields |
| FR-21 point-in-polygon link | be-fields, be-observations | fe-fields, fe-scouting |
| FR-22 tasks + treatment log | be-tasks, be-observations (link) | fe-tasks |
| FR-23 heatmap + CSV/GeoJSON/REST export | be-analytics | fe-heatmap |
| FR-24 offline + cache + send on connect | be-sync | fe-offline |
| FR-25 reference packs by region | be-catalog, be-sync | fe-offline, fe-settings |
| FR-26 server refinement after sync | be-recognition, be-sync | fe-offline, fe-diagnosis |
| FR-27 expert queue | be-expert | fe-expert |
| FR-28 labeling tool | be-expert | fe-expert |
| FR-29 trust levels | be-expert, be-auth | fe-expert |
| 4.3 multimodal input, calibration, multi-frame, unknown detection | be-vision-provider, be-recognition | - |
| 4.4 data flywheel | be-expert | fe-expert |
| 5 whole (deterministic engine, transparency) | be-recommendation, be-catalog | fe-recommendation |
| 5 directory approval process | be-catalog | fe-settings (catalog-admin) |
| 7 security (roles, audit log, tenant separation, hashing) | be-auth (+ `audit_log` writes by all) | - |
| 7 privacy (geo opt-out) | be-auth (user flag), be-observations | fe-settings |
| 7 localization, field accessibility | - | fe-shell |
| 7 offline | be-sync | fe-offline |
| 10 stale reference data warning | be-catalog | fe-recommendation, fe-settings |

---

## 2. Data model

Location: `backend/src/domain/**` (scaffold-owned). Entities extend `BaseEntity`:
- `id` varchar(36) PK (server-generated UUID unless client supplied).
- `createdAt`, `updatedAt` datetime.
- Tenant-scoped entities also have `farmId` varchar(36) FK -> `farms.id` (indexed) for customer data separation.
- Offline-created rows (observations, photos, voice notes, tasks, treatments, feedback) carry `clientId` varchar(36) UNIQUE: UUID generated on the device; the server accepts it as the row `id` (idempotent upsert). `clientCreatedAt` datetime is the device time.
- SQLite types: `uuid`->varchar(36), `json`->simple-json (text), `enum`->varchar with a TS enum, `datetime`->datetime, `bool`->boolean.

Enums (in `backend/src/domain/enums.ts`, mirrored in `frontend/src/app/core/api/models`):
`Role` = scout | chief_agronomist | mechanic | expert. `ProblemCategory` = disease | pest | weed | nutrition | abiotic_stress | mechanical_damage | normal. `Organ` = leaf | ear | stem | fruit | root | pest | field. `ActionLevel` = observe | threshold | treat | urgent. `RecommendationStatus` = draft | approved | rejected. `TaskType` = treatment | reinspection | sampling. `TaskStatus` = open | in_progress | done | cancelled. `TaskPriority` = low | normal | high | urgent. `ObservationStatus` = draft | pending_sync | synced | diagnosed | confirmed. `WeatherVerdict` = go | no_go | wait. `ExpertCaseReason` = low_confidence | user_model_disagreement | rare_class | out_of_distribution | unsure_mode. `ExpertCaseStatus` = open | in_review | resolved. `ProposalStatus` = pending | approved | rejected. `ProductSource` = registry | internal_tech_card | demo_seed. `PestStage` = imago | larva | nymph | egg | pupa | unknown. `LabelSource` = user | expert | model.

### 2.1 Identity and tenancy

**users** (`UserEntity`): id; `farmId` FK; `email` unique varchar; `passwordHash` varchar (bcrypt); `displayName`; `role` Role; `trustWeight` float default from config (FR-29, derived from role, overridable by chief agronomist); `locale` varchar(5) default `uk`; `geoCollectionEnabled` bool default true (7 privacy); `isActive` bool; `regionCode` varchar nullable.

**farms** (`FarmEntity`): id; `name`; `regionCode` varchar (catalogue pack region, FR-25); `timezone` varchar; `defaultSafetyBuffers` json (water/apiary/settlement metres, defaults from config). One farm = one tenant.

### 2.2 Fields

**fields**: id; `clientId`; `farmId`; `name`; `areaHa` float (computed from polygon by @turf/area when contour present, else manual); `cropId` FK crops nullable; `variety` varchar nullable (variety or hybrid); `sowingDate` date nullable; `contour` json GeoJSON Polygon/MultiPolygon nullable; `bbox` json [minLng,minLat,maxLng,maxLat] nullable; `centroidLat`, `centroidLng` float nullable; `source` varchar (manual | import_kml | import_geojson | import_shp | drawn); `nearWater`, `nearApiary`, `nearSettlement` bool (safety flags, FR-18); `deletedAt` nullable.

**field_crop_memory**: id; `farmId`; `userId`; `fieldId`; `cropId`; `lastUsedAt`. Unique (userId, fieldId). Remembers the crop chosen per field (scenario step 1).

### 2.3 Observations and media

**observations**: id; `clientId`; `farmId`; `userId`; `fieldId` nullable; `fieldLinkMethod` (gps | manual | none); `cropId` nullable; `bbchStage` int nullable; `lat`, `lng` float nullable (null if user opted out of geo); `gpsAccuracyM` float nullable; `capturedAt` datetime; `deviceModel` varchar nullable; `temperatureC`, `humidityPct` float nullable (from weather); `organ` Organ nullable; `textNote` text nullable; `scaleMarkerUsed` bool; `status` ObservationStatus; `isQuickCapture` bool (mechanic flow: no diagnosis chosen); `confirmedDiagnosisId` FK diagnoses nullable; `confirmedByUserId` nullable; `confirmedAt` nullable; `correctedFromDiagnosisId` nullable (set when user overrides model top-1); `clientCreatedAt`.

**photos**: id; `clientId`; `observationId`; `farmId`; `seq` int (1..3); `storageKey` varchar (relative path under storage dir); `mimeType`; `widthPx`, `heightPx` int; `sizeBytes` int; `qualityReport` json ({sharpness, exposure, plantCoverage, objectSize, passed}); `sha256` varchar.

**voice_notes**: id; `clientId`; `observationId`; `farmId`; `storageKey`; `mimeType`; `durationSec` float; `transcript` text nullable.

### 2.4 Diagnosis

**diagnoses_results** (`DiagnosisResultEntity`, table `diagnosis_results`): id; `observationId` unique per `pass` (see below); `farmId`; `pass` varchar (initial | server_refined | confirmed); `providerName` varchar; `modelVersion` varchar; `cropCode` nullable; `organ` nullable; `problemCategory` nullable; `calibrationTemperature` float; `entropy` float; `unsure` bool; `unsureReason` varchar nullable; `outOfDistribution` bool; `pestSpecies` varchar nullable; `pestStage` PestStage nullable; `pestDensityPerPlant` float nullable; `pestDensityPerM2` float nullable; `clarifyingQuestions` json (QuestionDto[]); `answers` json (question id -> answer); `rawResponse` json (provider JSON without secrets); `latencyMs` int.

**diagnosis_hypotheses**: id; `diagnosisResultId` FK; `rank` int (1..3); `diagnosisId` FK catalogue diagnoses nullable (null when unmapped); `diagnosisCode` varchar; `rawProbability` float; `probability` float (calibrated); `stage` varchar nullable; `evidence` text; `regionX`, `regionY`, `regionW`, `regionH` float nullable (normalised 0..1, FR-10); `regionPhotoSeq` int nullable.

### 2.5 Expert loop

**expert_cases**: id; `farmId`; `observationId`; `diagnosisResultId`; `reason` ExpertCaseReason; `status` ExpertCaseStatus; `priority` int; `assignedExpertId` nullable; `resolvedAt` nullable.

**labels**: id; `expertCaseId` nullable; `observationId`; `photoId` nullable; `labelerUserId`; `labelSource` LabelSource; `diagnosisId` FK nullable; `newClassProposalId` FK catalog_change_proposals nullable; `affectedRegion` json nullable (polygon/rect normalised, FR-28); `weight` float (labeler trust at time of labelling, FR-29); `action` varchar (confirm | change | add_new_class | reject); `comment` text nullable; `inDataset` bool default false (4.4 step 3).

### 2.6 Catalogue (reference data, FR-13/14/17/25, section 5)

All catalogue rows carry `source` (ProductSource or text), `sourceRef` varchar, `verifiedAt` date nullable, `isDemo` bool, `regionCode` nullable (null = all regions), `version` int.

**crops**: id; `code` unique (wheat_winter, maize, sunflower, soybean, rapeseed); `nameUk`, `nameEn`.

**bbch_stages**: id; `cropId`; `bbchFrom` int; `bbchTo` int; `nameUk`, `nameEn`; `phase` varchar (vegetative | flowering | ripening ...).

**diagnoses** (`CatalogDiagnosisEntity`, table `catalog_diagnoses`): id; `code` unique; `nameUk`, `nameEn`, `latinName` nullable; `problemCategory`; `isQuarantine` bool; `isCritical` bool (recall >= 90% target); `typicalOrgans` json; `descriptionUk`, `descriptionEn`; `clarifyingQuestions` json (default question bank, QuestionDto[]); `cropIds` many-to-many join table `diagnosis_crops`.

**thresholds** (EPSH): id; `diagnosisId`; `cropId`; `bbchFrom`, `bbchTo` int; `metric` varchar (percent_leaf_area | pests_per_m2 | pests_per_plant | percent_plants); `thresholdValue` float; `urgentValue` float nullable; `unit`; plus catalogue meta fields.

**active_substances**: id; `code` unique; `nameUk`, `nameEn`; `resistanceSystem` varchar (FRAC | IRAC | HRAC | none); `resistanceGroup` varchar (e.g. "3", "M5"); `maxApplicationsPerSeason` int nullable (default override in config).

**products** (registry): id; `registrationNumber` nullable; `name`; `formulation` nullable; `registrant` nullable; `pollinatorHazard` varchar (high | moderate | low | unknown); `waterProtectionZoneM` int; `apiaryZoneM` int; `settlementZoneM` int; `pricePerHaUah` float nullable; `efficacyNote` text nullable; plus catalogue meta. `isDemo` true for all seed rows.

**product_active_substances**: id; `productId`; `activeSubstanceId`; `concentration` varchar.

**product_registrations** (registration per crop+diagnosis, one row = one allowed use): id; `productId`; `cropId`; `diagnosisId`; `rateMin`, `rateMax` float; `rateUnit` (l/ha | kg/ha); `maxApplications` int; `minIntervalDays` int; `preHarvestIntervalDays` int; `bbchFrom`, `bbchTo` int; `efficacyScore` float 0..1; `incompatibleWith` json (productIds); `maxWindSpeedMs`, `minTempC`, `maxTempC` float nullable (label limits override config).

**reference_images**: id; `diagnosisId`; `cropId` nullable; `stage` nullable; `storageKey`; `caption`; `attribution`; `regionCode` nullable; plus meta. Served as pack items for offline (FR-25).

**catalog_change_proposals**: id; `entityType` varchar (product | registration | threshold | diagnosis | active_substance | reference_image | crop); `entityId` nullable (null = create); `operation` (create | update | delete); `payload` json; `status` ProposalStatus; `proposedByUserId`; `reviewedByUserId` nullable; `reviewedAt` nullable; `reviewComment` nullable. Directory updates require approval by chief agronomist (section 5). New classes proposed by experts (FR-28) arrive here too.

**catalog_state**: single-row-per-region: `regionCode` PK; `version` int; `publishedAt`; `lastVerifiedAt` (stale warning uses this).

### 2.7 Recommendations

**recommendations**: id; `farmId`; `observationId`; `diagnosisResultId`; `confirmedDiagnosisId` nullable; `status` RecommendationStatus (always `draft` initially, FR-19); `actionLevel` ActionLevel; `thresholdExceeded` bool nullable; `weatherVerdict` WeatherVerdict nullable; `weatherReason` text nullable; `weatherForecast` json (72h hourly summary snapshot); `safetyWarnings` json (string codes + params); `explanation` text (why so; deterministic template, optional LLM rephrase); `sources` json ([{kind, ref, verifiedAt}]); `catalogVersion` int; `catalogStale` bool; `autoApproved` bool; `approvedByUserId` nullable; `approvedAt` nullable; `rejectionReason` nullable.

**recommendation_items**: id; `recommendationId`; `rank` int; `productRegistrationId` FK; `productId`; `activeSubstanceCodes` json; `rateValue` float; `rateUnit`; `applicationTiming` text; `bbchFrom`, `bbchTo`; `preHarvestIntervalDays`; `resistanceSystem`, `resistanceGroup` (primary substance); `rotationOk` bool; `rotationNote` nullable; `stockQty` float nullable; `stockUnit` nullable; `inStock` bool; `costPerHaUah` float nullable; `excluded` bool + `excludedReason` text nullable (filtered-out items are kept for transparency); `score` float.

**auto_approve_settings**: id; `farmId`; `problemCategory` ProblemCategory nullable; `diagnosisId` nullable; `minConfidence` float; `enabled` bool; `enabledByUserId`; unique (farmId, problemCategory, diagnosisId). Only chief_agronomist may write (FR-19).

### 2.8 Tasks, treatments, stock, audit, sync

**tasks**: id; `clientId`; `farmId`; `type` TaskType; `fieldId`; `observationId` nullable; `lat`, `lng` nullable; `diagnosisId` nullable; `recommendationId` nullable; `photoIds` json (denormalised for export); `priority` TaskPriority; `assigneeUserId` nullable; `createdByUserId`; `deadline` datetime nullable; `status` TaskStatus; `title`; `notes` text; `completedAt` nullable; `clientCreatedAt`.

**treatment_log**: id; `clientId`; `farmId`; `fieldId`; `taskId` nullable; `productId`; `activeSubstanceCodes` json; `resistanceGroups` json ([{system, group}]); `doseValue` float; `doseUnit`; `treatedAreaHa` float; `appliedAt` date; `recordedByUserId`. Feeds FR-17 rotation.

**stock_items** (FR-15, local table, ERP later): id; `farmId`; `productId`; `quantity` float; `unit`; `warehouse` varchar nullable; `lotNumber` nullable; `expiresAt` nullable; `source` varchar (manual | csv | erp); `syncedAt` nullable. Unique (farmId, productId, warehouse, lotNumber).

**audit_log**: id; `farmId` nullable; `userId` nullable; `action` varchar (e.g. `observation.create`, `recommendation.approve`); `entityType`; `entityId`; `ip` nullable; `meta` json (no secrets/PII); `createdAt`. Append-only.

**sync_records**: id; `farmId`; `userId`; `deviceId` varchar; `entityType`; `clientId`; `serverId`; `operation` (upsert | delete); `status` (applied | conflict | failed); `error` text nullable; `clientTimestamp`; `appliedAt`. Unique (deviceId, entityType, clientId) makes sync idempotent.

### 2.9 Export DTOs (FR-23, AP Agronomist ready)

`backend/src/domain/export/` defines versioned DTOs `FieldExportDto`, `ObservationExportDto`, `TaskExportDto`, `TreatmentExportDto`, each `{ schemaVersion: 1, externalIds: { scoutId: uuid, agronomistId?: string }, ... }`. Rules: flat primitives, ISO dates, GeoJSON for geometry (RFC 7946, WGS84 lng/lat), reference catalogue by `code` not by id (`cropCode`, `diagnosisCode`, `productRegistrationNumber`), no internal user ids (use `userEmail`/`displayName`), photo URLs absolute-path relative to `/api/v1/photos/{id}/file`. Entities are never serialised directly; mappers in `domain/export/` do it. CSV export flattens these DTOs; GeoJSON export is a FeatureCollection whose `properties` is the DTO minus geometry.

---

## 3. REST API (`/api/v1`)

Conventions: JSON bodies; auth header `Authorization: Bearer <jwt>` unless `public`. Errors: `{ "statusCode": 400, "error": "Bad Request", "message": ["..."], "code": "VALIDATION_FAILED" }`. Lists: `?page=1&pageSize=20` -> `{ items: [], total, page, pageSize }`. Roles abbreviations: S scout, C chief agronomist, M mechanic, E expert. "any" = any authenticated role. All data is implicitly restricted to the caller's `farmId` except catalogue (global) and expert endpoints (cross-farm for role E). Swagger at `/api/docs`. Photo upload is `multipart/form-data` (multer, size/type limits from config).

### 3.1 Auth (be-auth)

| Method Path | Roles | Request -> Response |
|---|---|---|
| POST /auth/login | public | `{email,password}` -> `{accessToken, expiresIn, user: UserDto}` |
| POST /auth/refresh | public (refresh token in body) | `{refreshToken}` -> `{accessToken, refreshToken, expiresIn}` |
| POST /auth/logout | any | `{refreshToken}` -> 204 |
| GET /auth/me | any | -> `UserDto` |
| PATCH /auth/me | any | `{displayName?, locale?, geoCollectionEnabled?}` -> `UserDto` |
| GET /users | C | page -> `{items: UserDto[]}` |
| POST /users | C | `{email,password,displayName,role,regionCode?}` -> `UserDto` |
| PATCH /users/:id | C | `{displayName?,role?,isActive?,trustWeight?,password?}` -> `UserDto` |
| GET /audit-log | C | `?userId&entityType&from&to&page` -> page of `AuditEntryDto` |

`UserDto = {id, email, displayName, role, locale, geoCollectionEnabled, trustWeight, farmId, regionCode}`. Passwords hashed with bcryptjs; login rate-limited (config); roles enforced by `@Roles()` + `RolesGuard`; every write action appends to `audit_log`.

### 3.2 Farms (be-auth)

GET /farms/me (any) -> `FarmDto {id,name,regionCode,timezone,defaultSafetyBuffers}`; PATCH /farms/me (C) same fields.

### 3.3 Fields (be-fields)

`FieldDto = {id, clientId?, name, areaHa, cropId?, cropCode?, variety?, sowingDate?, contour?: GeoJSON, centroid?: {lat,lng}, source, nearWater, nearApiary, nearSettlement}`.

| Method Path | Roles | Request -> Response |
|---|---|---|
| GET /fields | any | `?q&cropId&page` -> page of FieldDto |
| GET /fields/:id | any | -> FieldDto |
| POST /fields | S,C | `FieldInput` (FieldDto minus id/areaHa) -> FieldDto (area computed from contour if present) |
| PATCH /fields/:id | S,C | partial FieldInput -> FieldDto |
| DELETE /fields/:id | C | -> 204 (soft delete) |
| POST /fields/import | C | multipart `file` (.kml .geojson .json .zip shapefile) -> `{ imported: FieldDto[], skipped: [{index, reason}] }` (preview mode with `?dryRun=true`) |
| GET /fields/locate | any | `?lat&lng` -> `{ matches: [{fieldId, name}] }` (point-in-polygon, empty -> pick from list) |
| GET /fields/:id/crop-memory | any | -> `{cropId?}` for current user |
| PUT /fields/:id/crop-memory | any | `{cropId}` -> 204 |

### 3.4 Observations (be-observations)

`ObservationDto = {id, clientId, fieldId?, fieldLinkMethod, cropId?, bbchStage?, lat?, lng?, gpsAccuracyM?, capturedAt, deviceModel?, temperatureC?, humidityPct?, organ?, textNote?, scaleMarkerUsed, isQuickCapture, status, photos: PhotoDto[], voiceNote?: VoiceNoteDto, confirmedDiagnosisId?, diagnosis?: DiagnosisResultDto}`; `PhotoDto = {id, clientId, seq, widthPx, heightPx, qualityReport, url}`.

| Method Path | Roles | Request -> Response |
|---|---|---|
| POST /observations | S,C,M | `ObservationInput` (all fields above except server ones; `clientId` required, idempotent) -> ObservationDto; server fills weather (be-weather) if lat/lng present and temp/humidity missing; links field by point-in-polygon when `fieldId` omitted |
| GET /observations | any | `?fieldId&cropId&status&from&to&page` -> page of ObservationDto |
| GET /observations/:id | any | -> ObservationDto |
| PATCH /observations/:id | S,C,M (owner or C) | `{fieldId?, cropId?, bbchStage?, textNote?, organ?}` -> ObservationDto |
| POST /observations/:id/photos | S,C,M | multipart `file`, `clientId`, `seq`, `qualityReport` (JSON string) -> PhotoDto (max photos per observation from config) |
| GET /photos/:id/file | any | -> image bytes (farm-scoped; `?w=` optional thumbnail not in MVP) |
| POST /observations/:id/voice-note | S,C,M | multipart `file`, `clientId`, `durationSec` -> VoiceNoteDto |
| POST /observations/:id/confirm | S,C | `{diagnosisId, correctedFromModel: boolean}` -> ObservationDto (sets confirmed; emits `observation.confirmed`; with `SIMILARITY_ENABLED` the observation's photos join the reference base under the confirmed diagnosis and the local classifier is retrained `SIMILARITY_RETRAIN_DELAY_MS` later) |
| DELETE /observations/:id | C | -> 204 |

### 3.5 Diagnosis / recognition (be-recognition, uses be-vision-provider)

`DiagnosisResultDto = {id, observationId, pass, modelVersion, cropCode?, organ?, problemCategory?, unsure, unsureReason?, outOfDistribution, hypotheses: HypothesisDto[], pest?: {species?, stage?, densityPerPlant?, densityPerM2?}, clarifyingQuestions: QuestionDto[], answers, referenceImages: ReferenceImageDto[], needsMorePhotos: boolean, createdAt}`; `HypothesisDto = {rank, diagnosisId?, diagnosisCode, nameUk, nameEn, probability, stage?, evidence, region?: {x,y,w,h,photoSeq}}` (probabilities calibrated, sum over listed <= 1, `x,y,w,h` normalised 0..1); `QuestionDto = {id, textUk, textEn, answerType: "yes_no"|"choice", options?: [{value, labelUk, labelEn}], narrowsDiagnosisCodes: string[]}`; `ReferenceImageDto = {id, diagnosisCode, stage?, url, caption, attribution}`.

| Method Path | Roles | Request -> Response |
|---|---|---|
| POST /observations/:id/diagnose | S,C,M,E | `{}` -> DiagnosisResultDto (pass `initial`; multi-frame aggregation over all photos; context from observation + field history + weather; sets `unsure` and creates expert case when below threshold/OOD) |
| GET /observations/:id/diagnosis | any | -> latest DiagnosisResultDto (404 if none) |
| POST /diagnoses/:resultId/answers | S,C,M | `{answers: {[questionId]: string}}` -> DiagnosisResultDto (re-ranks hypotheses with answers, calls provider again with answers) |
| POST /observations/:id/refine | S,C | `{}` -> DiagnosisResultDto (pass `server_refined`; also run automatically by be-sync after sync, FR-26; the automatic run skips photos already refined successfully and retries provider failures; the PWA waits for it and does not call `/diagnose` for synced observations) |
| GET /recognition/status | any | -> `{provider, model, thresholds: {unsure, ood}, temperature}` (diagnostics, no secrets) |
| GET /similarity/photos/:id | any | -> image bytes of a labelled photo from the reference base (be-similarity); `referenceImages` of a diagnosis list the photos most similar to the scout's photos first (caption "Схоже на ваше фото на N%", `attribution` = dataset credit), then catalogue images, at most `RECOGNITION_REFERENCES_PER_HYPOTHESIS` per hypothesis |

### 3.6 Catalogue (be-catalog)

Read endpoints: any role. Write endpoints go through proposals (section 5).

| Method Path | Roles | Request -> Response |
|---|---|---|
| GET /catalog/crops | any | -> `CropDto[] {id, code, nameUk, nameEn}` |
| GET /catalog/crops/:id/bbch | any | -> `BbchStageDto[]` |
| GET /catalog/diagnoses | any | `?cropId&category&q` -> `CatalogDiagnosisDto[] {id, code, nameUk, nameEn, latinName?, problemCategory, isQuarantine, isCritical, descriptionUk, descriptionEn, cropIds, clarifyingQuestions}` |
| GET /catalog/diagnoses/:id/references | any | -> `ReferenceImageDto[]` |
| GET /catalog/thresholds | any | `?diagnosisId&cropId` -> `ThresholdDto[]` |
| GET /catalog/products | any | `?q&cropId&diagnosisId&activeSubstance` -> `ProductDto[] {id, name, registrationNumber?, activeSubstances: [{code, nameUk, concentration, resistanceSystem, resistanceGroup}], pollinatorHazard, zones: {water, apiary, settlement}, isDemo, source, verifiedAt?}` |
| GET /catalog/products/:id/registrations | any | -> `ProductRegistrationDto[]` |
| GET /catalog/active-substances | any | -> `ActiveSubstanceDto[]` |
| GET /catalog/status | any | -> `{regionCode, version, publishedAt, lastVerifiedAt, daysSinceVerified, stale: boolean, staleAfterDays, containsDemoData}` |
| GET /catalog/pack | any | `?region&sinceVersion` -> `CatalogPackDto {regionCode, version, publishedAt, crops, bbch, diagnoses, thresholds, products, registrations, activeSubstances, referenceImages (with URLs), deleted: {entity: ids[]}}` (full when `sinceVersion` omitted, delta otherwise; FR-25) |
| GET /catalog/proposals | C,E | `?status&page` -> page of ProposalDto |
| POST /catalog/proposals | C,E | `{entityType, entityId?, operation, payload}` -> ProposalDto (E can only propose `diagnosis`/`reference_image`) |
| POST /catalog/proposals/:id/approve | C | `{comment?}` -> ProposalDto (applies change, bumps catalog version) |
| POST /catalog/proposals/:id/reject | C | `{comment}` -> ProposalDto |
| POST /catalog/reference-images | C,E | multipart `file`, `diagnosisId`, `caption`, `stage?`, `attribution` -> creates a pending proposal, returns ProposalDto |
| GET /catalog/reference-images/:id/file | any | -> image bytes |
| POST /catalog/verify | C | `{regionCode, note?}` -> CatalogStatusDto (marks reference data re-verified, resets stale clock) |

### 3.7 Weather (be-weather)

| Method Path | Roles | Request -> Response |
|---|---|---|
| GET /weather/forecast | any | `?lat&lng&hours=72` -> `WeatherForecastDto {fetchedAt, source: "open-meteo", cached: boolean, hourly: [{time, temperatureC, humidityPct, windSpeedMs, windGustMs, precipitationMm, precipitationProbPct}]}` |
| GET /weather/current | any | `?lat&lng` -> `{time, temperatureC, humidityPct, windSpeedMs}` |
| POST /weather/window | S,C | `{lat, lng, constraints?: {maxWindMs?, minTempC?, maxTempC?, maxRainMm?, rainFreeHours?}}` -> `WeatherWindowDto {verdict: "go"|"no_go"|"wait", reason: string (i18n code + params), reasonParams, nextGoAt?: string, hours: [{time, verdict, causes: string[]}]}` |

Cache by rounded coordinates (precision and TTL from config); on provider failure serve the stale cache with `cached: true`, else 503 `WEATHER_UNAVAILABLE`.

### 3.8 Recommendations (be-recommendation)

`RecommendationDto = {id, observationId, status, actionLevel, thresholdExceeded?, weather: {verdict, reason, reasonParams, forecastSummary}, safetyWarnings: [{code, params, severity}], items: RecommendationItemDto[], excludedItems: [...with excludedReason], explanation, sources: [{kind, ref, verifiedAt?}], catalogVersion, catalogStale, autoApproved, approvedBy?, approvedAt?, disclaimerCode}`; `RecommendationItemDto = {rank, product: ProductDto, activeSubstanceCodes, rate: {value, unit}, applicationTiming, bbchFrom, bbchTo, preHarvestIntervalDays, resistance: {system, group, rotationOk, note?}, stock: {inStock, quantity?, unit?}, costPerHaUah?, score}`.

| Method Path | Roles | Request -> Response |
|---|---|---|
| POST /recommendations | S,C | `{observationId, diagnosisId? (confirmed or chosen hypothesis), bbchStage?}` -> RecommendationDto (status `draft`, or `approved` with `autoApproved` when a matching auto-approve rule applies, never for quarantine/critical diagnoses) |
| GET /recommendations/:id | any | -> RecommendationDto |
| GET /observations/:id/recommendations | any | -> RecommendationDto[] |
| POST /recommendations/:id/approve | C | `{}` -> RecommendationDto |
| POST /recommendations/:id/reject | C | `{reason}` -> RecommendationDto |
| POST /recommendations/:id/recompute | S,C | `{}` -> RecommendationDto (fresh weather/stock; keeps draft) |
| POST /recommendations/:id/treatment-plan | S,C | `{tankVolumeL?}` -> TreatmentPlanDto; 503 `TREATMENT_PLAN_DISABLED` without GROQ_API_KEY, 503 `TREATMENT_PLAN_UNAVAILABLE` when Groq fails |
| GET /auto-approve-settings | C | -> `AutoApproveSettingDto[] {id, problemCategory?, diagnosisId?, minConfidence, enabled}` |
| PUT /auto-approve-settings | C | `{problemCategory?, diagnosisId?, minConfidence, enabled}` -> AutoApproveSettingDto |
| DELETE /auto-approve-settings/:id | C | -> 204 |

Engine pipeline (section 5), implemented as ordered steps (strategy per step): action level -> allowed products (crop+diagnosis) -> filters (pre-harvest interval, application count, compatibility, rotation from treatment_log) -> weather window + safety -> rank (efficacy, stock, cost per ha) -> explanation. The LLM never selects products or doses.

Treatment plan (on request, not stored): a Groq text model (`TREATMENT_PLAN_MODEL`) gets only the products the engine kept, with their registry limits, and arranges them into a course (which product on which day, rate, spray volume, timing, precautions). The answer is re-checked in code: unknown product, rate outside `rateMin..rateMax`, spray volume outside `TREATMENT_PLAN_WATER_*`, more than `maxApplications` per product or applications closer than `minIntervalDays` reject the whole plan (`status: rejected`, `validationErrors`). Tank and field proportions are computed in code, never by the model. `TreatmentPlanDto = {recommendationId, status: ready|no_treatment|rejected, model?, summary, applications: [{productId, productName, rateValue, rateUnit, waterLPerHa, dayOffset, timing, note, solution: {productPerHa, productUnit, waterLPerHa, productPer100L, tankVolumeL, productPerTank, hectaresPerTank, tanksForField?, productForField?}}], precautions, monitoring, validationErrors, disclaimerCode: treatment_plan_needs_agronomist, generatedAt}`.

### 3.9 Tasks (be-tasks)

`TaskDto = {id, clientId, type, fieldId, fieldName, observationId?, lat?, lng?, diagnosisId?, diagnosisName?, recommendationId?, photoUrls: string[], priority, assigneeUserId?, assigneeName?, deadline?, status, title, notes, completedAt?, createdAt}`.

| Method Path | Roles | Request -> Response |
|---|---|---|
| GET /tasks | any (M sees own) | `?status&fieldId&assigneeId&type&page` -> page of TaskDto |
| GET /tasks/:id | any | -> TaskDto |
| POST /tasks | S,C | `TaskInput` (`clientId` required) -> TaskDto (idempotent by clientId) |
| PATCH /tasks/:id | S,C (assignee may set status) | partial -> TaskDto |
| POST /tasks/:id/complete | S,C | `{treatment?: {productId, doseValue, doseUnit, treatedAreaHa, appliedAt}}` -> TaskDto (writes `treatment_log` row for treatment tasks) |
| DELETE /tasks/:id | C | -> 204 |
| GET /treatments | any | `?fieldId&from&to` -> page of `TreatmentDto {id, clientId, fieldId, productId, productName, activeSubstanceCodes, resistanceGroups, doseValue, doseUnit, treatedAreaHa, appliedAt}` |
| POST /treatments | S,C | `TreatmentInput` (clientId required) -> TreatmentDto (manual history entry) |

### 3.10 Analytics (be-analytics)

| Method Path | Roles | Request -> Response |
|---|---|---|
| GET /analytics/heatmap | any | `?fieldId&cropId&diagnosisId&from&to&season` -> `{points: [{lat, lng, weight, diagnosisCode, observationId}], fields: [{fieldId, name, count, contour?}]}` |
| GET /analytics/summary | any | same filters -> `{total, byDiagnosis: [{code, name, count}], byField: [...], byWeek: [{week, count}]}` |
| GET /analytics/export/observations.csv | C | filters -> text/csv (columns of ObservationExportDto) |
| GET /analytics/export/observations.geojson | C | filters -> FeatureCollection |
| GET /analytics/export/fields.geojson | C | -> FeatureCollection of FieldExportDto |
| GET /analytics/export/tasks.csv | C | filters -> text/csv |
| GET /analytics/export/tasks.geojson | C | filters -> FeatureCollection |
| GET /analytics/export/treatments.csv | C | filters -> text/csv |
| GET /export/v1/fields, /export/v1/observations, /export/v1/tasks, /export/v1/treatments | C | `?updatedSince&page` -> page of export DTOs (the REST API for the future AP Agronomist integration) |

### 3.11 Sync (be-sync)

| Method Path | Roles | Request -> Response |
|---|---|---|
| POST /sync/push | S,C,M | `{deviceId, items: [{entityType: "observation"|"task"|"treatment"|"field"|"feedback", clientId, operation: "upsert"|"delete", clientTimestamp, payload}]}` -> `{results: [{clientId, entityType, status: "applied"|"conflict"|"failed", serverId?, error?}], serverTime}` (idempotent via sync_records; photos/voice are uploaded via 3.4 endpoints after their observation is applied; applied observations with photos are queued for server refinement, FR-26) |
| GET /sync/pull | any | `?since=ISO&deviceId` -> `{serverTime, changes: {fields: [], tasks: [], observations: [], recommendations: [], diagnoses: [], treatments: []}, deleted: {entityType: ids[]}}` |
| GET /sync/status | any | `?deviceId` -> `{pendingRefinement: number, lastPushAt?, lastPullAt?, catalogVersion}` |
| GET /health | public | -> `{status: "ok", time}` |

Conflict rule: server wins on `diagnosis`, `recommendation`, and `catalog`; last-writer-wins by `clientTimestamp` for observation/task fields edited by humans; `confirmedDiagnosisId` is never overwritten by an older client timestamp.

### 3.12 Expert (be-expert)

`ExpertCaseDto = {id, reason, status, priority, observation: ObservationDto, diagnosis: DiagnosisResultDto, userCorrection?: {fromDiagnosisId, toDiagnosisId}, labels: LabelDto[], createdAt}`; `LabelDto = {id, labelerName, labelerRole, labelSource, action, diagnosisId?, affectedRegion?, weight, comment?, createdAt}`.

| Method Path | Roles | Request -> Response |
|---|---|---|
| GET /expert/cases | E,C | `?status&reason&cropId&page` -> page of ExpertCaseDto (cross-farm for E; queue ordered by priority then age) |
| GET /expert/cases/:id | E,C | -> ExpertCaseDto |
| POST /expert/cases/:id/claim | E | `{}` -> ExpertCaseDto (status in_review) |
| POST /expert/cases/:id/labels | E | `{action: "confirm"|"change"|"add_new_class"|"reject", diagnosisId?, newClass?: {code, nameUk, nameEn, problemCategory, cropIds}, affectedRegion?: {type: "rect"|"polygon", points: [{x,y}], photoSeq}, comment?}` -> LabelDto (weight from labeler trust; `add_new_class` creates a catalogue proposal) |
| POST /expert/cases/:id/resolve | E | `{finalDiagnosisId}` -> ExpertCaseDto (resolves; consensus weighted by label weights; resolved labels flagged `inDataset`) |
| POST /feedback | S,C | `{observationId, clientId, finalDiagnosisId, correctedFromModel}` -> 204 (user label with user trust weight; opens an expert case on disagreement) |
| GET /expert/dataset/stats | E,C | -> `{labeled, byDiagnosis: [{code, count}], pendingReview, exportableCount}` |
| GET /expert/dataset/export | E | `?since` -> NDJSON of `{photoUrl, diagnosisCode, weight, region?, cropCode, bbch, context}` (data flywheel step 3) |

### 3.13 Stock (be-stock)

| Method Path | Roles | Request -> Response |
|---|---|---|
| GET /stock | any | `?q&productId` -> page of `StockItemDto {id, productId, productName, quantity, unit, warehouse?, lotNumber?, expiresAt?, source, syncedAt?}` |
| PUT /stock/:productId | C | `{quantity, unit, warehouse?, lotNumber?, expiresAt?}` -> StockItemDto |
| POST /stock/import | C | multipart CSV (`registrationNumber|productName,quantity,unit,warehouse`) -> `{upserted, skipped: [...]}` |
| DELETE /stock/:id | C | -> 204 |

ERP connector is out of MVP: be-stock exposes `StockProvider` interface (`LocalStockProvider` now, `ErpStockProvider` later). be-recommendation depends only on the interface.

### 3.14 Internal events (EventEmitter2, no HTTP)

`observation.created`, `observation.confirmed` (be-expert listens, be-recommendation may listen), `photo.uploaded` (be-sync queues refinement), `diagnosis.completed` (be-expert opens cases, be-observations updates status), `recommendation.approved`, `task.completed` (be-tasks writes treatment; be-recommendation uses via treatment_log), `catalog.published`. Payloads are typed in `backend/src/domain/events.ts`.

---

## 4. Configuration keys (`backend/.env`, documented in `backend/.env.example`)

Existing `backend/.env` holds the real `GEMINI_API_KEY`: never print/overwrite. Append new keys only. `.env.example` contains the same keys with placeholder values. Read via `ConfigService`, validated at boot by a Joi/zod-free typed `configuration.ts` (no extra deps: manual validation function).

| Key | Default | Meaning |
|---|---|---|
| PORT | 3000 | HTTP port |
| NODE_ENV | development | |
| API_PREFIX | api/v1 | |
| CORS_ORIGINS | http://localhost:4200 | comma-separated |
| DB_PATH | ./data/ap-scout.sqlite | SQLite file |
| DB_SYNCHRONIZE | true | dev only; `false` + migrations in prod |
| JWT_SECRET | (required, no default in prod; dev default `dev-only-change-me`) | |
| JWT_EXPIRES_IN | 15m | access token |
| REFRESH_TOKEN_EXPIRES_DAYS | 30 | |
| BCRYPT_ROUNDS | 10 | |
| LOGIN_MAX_ATTEMPTS | 5 | per window |
| LOGIN_WINDOW_SECONDS | 300 | |
| TRUST_WEIGHT_EXPERT | 3.0 | FR-29 expert label weight |
| TRUST_WEIGHT_CHIEF | 2.0 | |
| TRUST_WEIGHT_SCOUT | 1.0 | |
| TRUST_WEIGHT_MECHANIC | 0.5 | |
| EXPERT_CONSENSUS_MIN_WEIGHT | 3.0 | summed weight needed to auto-resolve a case |
| STORAGE_DIR | ./data/storage | photos, voice, reference images |
| UPLOAD_MAX_PHOTO_MB | 10 | |
| UPLOAD_MAX_VOICE_MB | 5 | |
| UPLOAD_ALLOWED_IMAGE_TYPES | image/jpeg,image/png,image/webp | |
| MAX_PHOTOS_PER_OBSERVATION | 3 | |
| AI_PROVIDER | gemini | `gemini`, `groq`, `mock` (deterministic, for tests/offline dev) or `local` (trained reference classifier only, no external AI) |
| GEMINI_API_KEY | (secret, already present) | |
| GEMINI_MODEL | gemini-3.5-flash | |
| GROQ_API_KEY | (secret) | Groq: vision provider when AI_PROVIDER=groq, and treatment plans |
| GROQ_MODEL | qwen/qwen3.8-27b | Groq vision model (must accept images) |
| TREATMENT_PLAN_MODEL | openai/gpt-oss-120b | Groq text model for treatment plans (independent of AI_PROVIDER) |
| TREATMENT_PLAN_TEMPERATURE | 0.2 | |
| TREATMENT_PLAN_TIMEOUT_MS | 45000 | |
| TREATMENT_PLAN_WATER_MIN_L_PER_HA | 100 | spray volumes the plan may use |
| TREATMENT_PLAN_WATER_MAX_L_PER_HA | 400 | |
| TREATMENT_PLAN_DEFAULT_TANK_L | 3000 | sprayer tank when the request names none |
| GEMINI_TIMEOUT_MS | 30000 | |
| GEMINI_MAX_RETRIES | 2 | retried only on 429, 5xx, timeout, network errors |
| GEMINI_RETRY_BASE_DELAY_MS | 1500 | pause before retry n is base * 2^(n-1); on 429 the `retryDelay` Gemini returns is used instead |
| GEMINI_RETRY_MAX_DELAY_MS | 30000 | upper bound of one pause; a spent daily quota (`PerDay` quota id) is not retried |
| AI_TEMPERATURE | 0.2 | provider sampling temperature (not calibration) |
| RECOGNITION_CALIBRATION_TEMPERATURE | 1.5 | temperature scaling T applied to logits derived from raw scores (4.3) |
| RECOGNITION_UNSURE_THRESHOLD | 0.5 | top-1 calibrated probability below this -> "not sure" (FR-8) |
| RECOGNITION_OOD_ENTROPY_THRESHOLD | 0.85 | normalised entropy above this -> unknown (4.3) |
| RECOGNITION_CLOSE_MARGIN | 0.15 | top1-top2 gap below this triggers clarifying questions (FR-11) |
| RECOGNITION_TOP_K | 3 | hypotheses returned |
| RECOGNITION_MULTIFRAME_AGGREGATION | mean_log_prob | `mean_log_prob` or `mean_prob` |
| RECOGNITION_CRITICAL_RECALL_BIAS | 0.1 | probability boost for critical/quarantine diagnoses to favour recall |
| SIMILARITY_ENABLED | false | kNN over labelled reference photos in Qdrant (be-similarity); off = recognition uses the vision provider only |
| QDRANT_URL | (empty) | required when SIMILARITY_ENABLED; e.g. `http://localhost:6333` or a Qdrant Cloud cluster URL |
| QDRANT_API_KEY | (secret, empty for local) | Qdrant Cloud API key |
| QDRANT_COLLECTION | crop_references | |
| SIMILARITY_EMBEDDER_MODEL | Xenova/clip-vit-base-patch32 | transformers.js image model (CLIP or DINOv2, e.g. `onnx-community/dinov2-base`), downloaded once into SIMILARITY_MODEL_CACHE_DIR |
| SIMILARITY_EMBEDDER_DTYPE | fp32 | `fp32`, `fp16` or `q8`; changing model or dtype requires re-indexing into a new collection |
| SIMILARITY_EMBEDDER_DEVICE | cpu | `cpu` or `dml` (DirectML GPU, Windows) |
| SIMILARITY_EMBEDDER_GPU_ID | 0 | DirectML adapter index; laptops often have the integrated GPU at 0 |
| SIMILARITY_MODEL_CACHE_DIR | ./data/models | |
| SIMILARITY_NEIGHBOURS | 20 | neighbours per photo, filtered by the observation crop |
| SIMILARITY_BLEND_WEIGHT | 0.3 | raw score = (1 - w) * provider + w * neighbour vote, before calibration |
| SIMILARITY_VOTE_EXPONENT | 4 | neighbour vote weight = cosine similarity ^ exponent |
| SIMILARITY_OOD_MIN_SCORE | 0 | best neighbour similarity below this -> `out_of_distribution`; 0 = off (CLIP similarities sit around 0.8-0.95, tune on data) |
| SIMILARITY_TIMEOUT_MS | 15000 | lookup budget; on timeout or error recognition continues without neighbours |
| SIMILARITY_INDEX_BATCH_SIZE | 32 | images per upsert in `npm run index:references` |
| SIMILARITY_CLASSIFIER_PATH | ./data/models/reference-classifier.json | probe trained by `npm run train:classifier` on the Qdrant vectors; when present it replaces the kNN vote (neighbours still give the OOD score); read once, restart after re-training |
| SIMILARITY_TRAIN_EPOCHS | 300 | full-batch gradient descent epochs |
| SIMILARITY_TRAIN_LEARNING_RATE | 0.5 | on standardised embeddings |
| SIMILARITY_TRAIN_L2 | 0.001 | weight decay |
| SIMILARITY_TRAIN_VALIDATION_FRACTION | 0.15 | held out per class to report accuracy before the final fit on all vectors |
| SIMILARITY_TRAIN_MAX_SAMPLE_WEIGHT | 10 | each dataset source weighs the same within a class; this caps one photo's weight (a single confirmed photo must not outweigh a dataset) |
| SIMILARITY_RETRAIN_DELAY_MS | 60000 | after a confirmation, retrain this much later (bursts cost one retrain; training yields to the event loop) |
| SIMILARITY_DATASETS_DIR | ./data/datasets | indexed datasets live below it; `GET /similarity/photos/:id` serves dataset files from here only |
| SIMILARITY_LAB_DIR | ./data/lab | `npm run lab`: embedding cache, run history, HTML training reports |
| SIMILARITY_EXAMPLES_PER_DIAGNOSIS | 3 | most similar labelled photos kept per hypothesis for comparison |
| WEATHER_PROVIDER_URL | https://api.open-meteo.com/v1/forecast | |
| WEATHER_HORIZON_HOURS | 72 | FR-16 |
| WEATHER_CACHE_TTL_MINUTES | 60 | |
| WEATHER_CACHE_COORD_PRECISION | 2 | decimal places for cache key |
| WEATHER_TIMEOUT_MS | 8000 | |
| WEATHER_MAX_WIND_MS | 5 | spraying not allowed above |
| WEATHER_MIN_TEMP_C | 5 | |
| WEATHER_MAX_TEMP_C | 25 | |
| WEATHER_MAX_RAIN_MM | 0.5 | |
| WEATHER_RAIN_FREE_HOURS | 4 | needed rain-free hours after application |
| WEATHER_MAX_PRECIP_PROB_PCT | 40 | |
| SAFETY_WATER_BUFFER_M | 50 | default if product has none |
| SAFETY_APIARY_BUFFER_M | 4000 | |
| SAFETY_SETTLEMENT_BUFFER_M | 300 | |
| RECOMMENDATION_MAX_ITEMS | 3 | |
| RECOMMENDATION_MAX_SAME_GROUP_PER_SEASON | 2 | rotation: max uses of same resistance group |
| RECOMMENDATION_SEASON_START_MONTH | 3 | season window for treatment history |
| RECOMMENDATION_RANK_WEIGHT_EFFICACY | 0.5 | |
| RECOMMENDATION_RANK_WEIGHT_STOCK | 0.3 | |
| RECOMMENDATION_RANK_WEIGHT_COST | 0.2 | |
| RECOMMENDATION_AUTO_APPROVE_MIN_CONFIDENCE | 0.9 | floor, per-setting `minConfidence` cannot be lower |
| CATALOG_STALE_DAYS | 180 | after this the pack is flagged stale (section 10) |
| CATALOG_SEED_DEMO | true | seeds DEMO catalogue on first boot |
| CATALOG_DEFAULT_REGION | UA-DEFAULT | |
| SYNC_BACKOFF_BASE_MS | 2000 | server-advertised client backoff |
| SYNC_BACKOFF_MAX_MS | 300000 | |
| SYNC_BACKOFF_FACTOR | 2 | |
| SYNC_BATCH_SIZE | 25 | max items per push |
| SYNC_REFINE_CONCURRENCY | 2 | server refinement queue |
| SYNC_REFINE_MAX_ATTEMPTS | 5 | a refinement whose provider failed on every photo is retried; only the last failure is stored |
| SYNC_REFINE_RETRY_BASE_MS | 60000 | pause before retry n is base * 2^(n-1) |
| SYNC_REFINE_RETRY_MAX_MS | 900000 | upper bound of one refinement retry pause |
| SYNC_REFINE_QUOTA_PAUSE_MS | 3600000 | on HTTP 429 the whole refinement queue pauses without spending attempts: this long for a spent daily quota, else the provider's `retryDelay` (at least SYNC_REFINE_RETRY_BASE_MS) |
| SYNC_CLIENT_CONFIG_EXPOSED | true | `/sync/status` returns the backoff/batch values so the client reads them |
| STOCK_LOW_THRESHOLD_FRACTION | 0.1 | |
| AUDIT_RETENTION_DAYS | 730 | |
| EXPORT_PAGE_SIZE | 500 | |

Frontend config: `frontend/src/environments/environment*.ts` with `apiBaseUrl` (`/api/v1`, dev proxy to `http://localhost:3000`), `defaultLocale` (`uk`), `supportedLocales`, `qualityGate` thresholds (`minLaplacianVariance`, `exposureMin`, `exposureMax`, `minPlantCoverage`, `minObjectFraction`, `maxImageEdgePx`), `sync` (`pollIntervalMs`, `backoff` same keys), `map` (`defaultCenter`, `defaultZoom`, `tileUrl`), `maxPhotos`. These are the single source for numbers; no literals in components.

---

## 5. Modules and owned paths

An agent edits only its own paths. Shared, scaffold-owned: `backend/src/domain/**` (all entities, shared enums/DTOs, events, export DTOs), `backend/src/app.module.ts`, `frontend/src/app/core/api/**` (typed models + one API client service per backend module: `AuthApi, FieldsApi, ObservationsApi, RecognitionApi, CatalogApi, WeatherApi, RecommendationApi, TasksApi, AnalyticsApi, SyncApi, ExpertApi, StockApi`), `app.routes.ts`, `app.config.ts`, global styles. Need a change in a shared file -> request it from the scaffold owner / amend this contract.

| Key | Owned paths | Covers |
|---|---|---|
| be-auth | backend/src/modules/auth/** | Roles (scout/agronomist, chief agronomist, mechanic/foreman, expert/phytopathologist), JWT, guards, users, farms, audit log writer service, section 7 security |
| be-fields | backend/src/modules/fields/** | FR-20, FR-21 (import via @tmcw/togeojson + @xmldom/xmldom + shpjs; area via @turf/area; PIP via @turf/boolean-point-in-polygon) |
| be-observations | backend/src/modules/observations/** | FR-3, FR-5, FR-22 (link), scenario steps 1-3, 6-7, photo/voice storage |
| be-vision-provider | backend/src/modules/vision-provider/** | `VisionProvider` interface, `GeminiVisionProvider`, `MockVisionProvider`; FR-6, FR-7 (raw scores), FR-9, FR-10 (region), FR-11 (questions), 4.3 multimodal input |
| be-recognition | backend/src/modules/recognition/** | FR-6..FR-11, FR-26, 4.3 (calibration, multi-frame, unknown detection) |
| be-catalog | backend/src/modules/catalog/** | FR-10 (reference images), FR-13, FR-14, FR-17 (groups), FR-25 (pack), section 5 transparency, section 10 stale data, DEMO seed, proposals |
| be-weather | backend/src/modules/weather/** | FR-5 (temp/humidity), FR-16 (Open-Meteo, window verdict) |
| be-recommendation | backend/src/modules/recommendation/** | FR-12..FR-19, whole of section 5 |
| be-tasks | backend/src/modules/tasks/** | FR-22, scenario step 6, treatment log |
| be-analytics | backend/src/modules/analytics/** | FR-23 (heatmap, CSV/GeoJSON, export API) |
| be-sync | backend/src/modules/sync/** | FR-24, FR-25, FR-26, NFR offline |
| be-expert | backend/src/modules/expert/** | FR-27, FR-28, FR-29, 4.4 data flywheel |
| be-stock | backend/src/modules/stock/** | FR-15 |
| fe-shell | frontend/src/app/features/shell/**, frontend/src/app/features/auth/**, frontend/src/app/features/home/** | section 2 roles, section 7 localization + field accessibility (big buttons, glove mode, sunlight theme, low-power mode) |
| fe-fields | frontend/src/app/features/fields/** | FR-20, FR-21 |
| fe-scouting | frontend/src/app/features/scouting/** | scenario steps 1-3, FR-1, FR-3, FR-4, FR-5 |
| fe-quality-gate | frontend/src/app/core/quality-gate/** | FR-2 (Laplacian variance, exposure, plant presence, object size; canvas based, pure functions + `QualityGateService`) |
| fe-diagnosis | frontend/src/app/features/diagnosis/** | FR-6..FR-11, scenario steps 4, 6 |
| fe-recommendation | frontend/src/app/features/recommendation/** | FR-12..FR-19, section 5 transparency |
| fe-tasks | frontend/src/app/features/tasks/** | FR-22 |
| fe-heatmap | frontend/src/app/features/heatmap/** | FR-23 (Leaflet + leaflet.heat) |
| fe-expert | frontend/src/app/features/expert/** | FR-27, FR-28, FR-29 |
| fe-offline | frontend/src/app/core/offline/**, frontend/ngsw-config.json | FR-24, FR-25, FR-26, NFR offline (IndexedDB via idb, outbox, backoff, pack cache, service worker) |
| fe-settings | frontend/src/app/features/settings/**, frontend/src/app/features/catalog-admin/** | FR-19 auto-approve, FR-25 region, section 5 directory approval, section 7 privacy, FR-15 stock view |

Each backend module: `<name>.module.ts`, `<name>.controller.ts`, services, `dto/`, `*.spec.ts`. Each frontend feature: lazy-loaded routes file `<name>.routes.ts` exporting `<NAME>_ROUTES`, standalone components, feature services that call `core/api` clients. Role-gated routes use a shared `roleGuard(...roles)` from fe-shell.

Entry-point contract between backend modules (exported provider tokens):
- `VisionProvider.analyze(input: VisionInput): Promise<VisionOutput>` (be-vision-provider). `VisionInput = {photos: [{bytes, mimeType}], context: {cropCode?, bbch?, temperatureC?, humidityPct?, fieldHistory?: string[], variety?, organHint?, answers?: Record<string,string>}, locale}`; `VisionOutput` = the JSON in section 8 plus `raw`.
- `CatalogService` (be-catalog): `getDiagnosisByCode`, `getReferenceImages`, `getThresholds`, `getAllowedRegistrations(cropId, diagnosisId, bbch)`, `getStatus(region)`, `getPack`.
- `WeatherService` (be-weather): `getForecast(lat,lng,hours)`, `evaluateWindow(forecast, constraints)`.
- `StockProvider` (be-stock): `getStock(farmId, productIds)`.
- `TreatmentHistory` read model from be-tasks: `getTreatments(fieldId, seasonStart)`.
- `AuditService.record(...)` (be-auth), global module.

---

## 6. npm dependencies (exact; pin caret ranges as listed)

### Backend (`backend/package.json`), Node >= 20

dependencies:
- @nestjs/common ^10.4.15, @nestjs/core ^10.4.15, @nestjs/platform-express ^10.4.15
- @nestjs/config ^3.3.0, @nestjs/typeorm ^10.0.2, typeorm ^0.3.20, better-sqlite3 ^12.2.0 (^11 has no Node 24 prebuilt binary)
- @nestjs/jwt ^10.2.0, @nestjs/passport ^10.0.3, passport ^0.7.0, passport-jwt ^4.0.1, bcryptjs ^2.4.3 (pure JS, no native build on Windows)
- @nestjs/swagger ^7.4.2, @nestjs/event-emitter ^2.1.1
- class-validator ^0.14.1, class-transformer ^0.5.1
- @google/genai ^1.0.0
- @turf/boolean-point-in-polygon ^7.2.0, @turf/area ^7.2.0
- @tmcw/togeojson ^5.8.1, @xmldom/xmldom ^0.8.10, shpjs ^6.1.0
- reflect-metadata ^0.2.2, rxjs ^7.8.1

devDependencies:
- @nestjs/cli ^10.4.9, @nestjs/testing ^10.4.15, @nestjs/schematics ^10.2.3
- typescript ^5.6.3, ts-node ^10.9.2, ts-loader ^9.5.1, tsconfig-paths ^4.2.0
- jest ^29.7.0, ts-jest ^29.2.5, @types/jest ^29.5.14, supertest ^7.0.0, @types/supertest ^6.0.2
- @types/node ^20.17.0, @types/express ^4.17.21, @types/multer ^1.4.12, @types/passport-jwt ^4.0.1, @types/bcryptjs ^2.4.6, @types/better-sqlite3 ^7.6.11, @types/geojson ^7946.0.14

HTTP to Open-Meteo uses Node global `fetch` (no axios). Multer comes with `@nestjs/platform-express`. Scripts: `build`, `start`, `start:dev`, `test` (`jest`), `test:e2e`.

### Frontend (`frontend/package.json`), Angular 21

dependencies:
- @angular/core, common, compiler, forms, platform-browser, router, animations, service-worker: ^21.0.0
- primeng ^21.0.0, @primeng/themes ^21.0.0 (theme preset; if the package is unavailable at 21 use `@primeuix/themes` equivalent and note it here), primeicons ^7.0.0
- @ngx-translate/core ^16.0.4, @ngx-translate/http-loader ^16.0.1
- leaflet ^1.9.4, leaflet-draw ^1.0.4, leaflet.heat ^0.2.0
- idb ^8.0.0
- rxjs ^7.8.1, tslib ^2.8.1, zone.js ~0.15.0 (omit if zoneless is chosen by the scaffold)

devDependencies:
- @angular/cli ^21.0.0, @angular/build ^21.0.0, @angular/compiler-cli ^21.0.0, typescript ~5.9.0
- @types/leaflet ^1.9.12, @types/leaflet-draw ^1.0.11, @types/leaflet.heat ^0.2.4
- vitest ^3.2.4, jsdom ^26.0.0

Locale files: `frontend/src/assets/i18n/uk.json` (default) and `en.json`; every feature adds keys under its own top-level namespace (`scouting.*`, `diagnosis.*`, ...) to avoid merge conflicts; shared keys under `common.*`.

---

## 7. Testing

- Backend, one module: `cd backend && npx jest src/modules/<name>` (e.g. `npx jest src/modules/recognition`); one file: `npx jest src/modules/recognition/calibration.service.spec.ts`. All: `npx jest`. `passWithNoTests` is on, so the filter works for modules that have no specs yet. E2E (supertest, in-memory SQLite `:memory:`): `npx jest --config test/jest-e2e.json`. Tests never call Gemini: use `AI_PROVIDER=mock` or a stubbed `VisionProvider`; never require a real key.
- Frontend (Angular 21 unit-test builder with Vitest): one feature: `cd frontend && npx ng test --include "src/app/features/<name>/**/*.spec.ts"`; core folder: `--include "src/app/core/<name>/**/*.spec.ts"`. Add `--watch=false` for a single run. This is the wired command (documented in `frontend/README.md`); plain vitest is not used. The frontend `.npmrc` sets `legacy-peer-deps=true`, and the installed Vitest is ^4 / jsdom ^28 (Angular 21 default). Zoneless Angular: no zone.js. PrimeNG theme comes from `@primeuix/themes`; animations package is installed but unused.
- Conventions: one spec per class, descriptive names (`it('returns unsure when top probability is below the threshold')`), no network, fixtures in `__fixtures__/` of the module, time and randomness injected.
- Mandatory unit coverage: calibration math, multi-frame aggregation, unsure/OOD rules, point-in-polygon link, KML/GeoJSON/SHP import, weather window verdict, every recommendation pipeline step, rotation rule, auto-approve rule, quality gate functions, outbox backoff, sync idempotency, role guards.

---

## 8. Gemini vision response schema (be-vision-provider)

The provider requests structured JSON (`responseMimeType: "application/json"` + `responseSchema`), validates the reply, and maps it to `VisionOutput`. Schema:

```json
{
  "crop": "wheat_winter | maize | sunflower | soybean | rapeseed | other | unknown",
  "organ": "leaf | ear | stem | fruit | root | pest | field | unknown",
  "problemCategory": "disease | pest | weed | nutrition | abiotic_stress | mechanical_damage | normal | unknown",
  "hypotheses": [
    {
      "diagnosisCode": "string (must be a catalogue code from the allowed list passed in the prompt, or \"other\")",
      "probability": 0.0,
      "stage": "string | null",
      "evidence": "short visual evidence, in the request locale",
      "region": { "x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0, "photoIndex": 0 }
    }
  ],
  "pest": {
    "species": "string | null",
    "stage": "imago | larva | nymph | egg | pupa | unknown",
    "countVisible": 0,
    "densityPerPlant": 0.0
  },
  "clarifyingQuestions": [
    { "id": "string", "textUk": "string", "textEn": "string", "answerType": "yes_no | choice",
      "options": [{ "value": "string", "labelUk": "string", "labelEn": "string" }],
      "narrowsDiagnosisCodes": ["string"] }
  ],
  "outOfDistribution": false
}
```

Rules: `hypotheses` has up to 3 entries sorted by probability, raw probabilities (the provider's self-reported scores) sum to <= 1; `region` is normalised 0..1 relative to photo `photoIndex` and may be null; `pest` is null unless organ is `pest` or category is `pest`; `outOfDistribution` is true when the image is not a crop, is unreadable, or matches no allowed class. The prompt receives the allowed crop/diagnosis code list from be-catalog and the multimodal context (crop, BBCH, temperature, humidity, field history, variety, answers). The LLM only classifies and phrases questions/evidence; it never outputs products or doses. Invalid JSON/codes -> one retry, then `VisionProviderError` -> recognition returns `unsure` with `unsureReason: "provider_error"`. Calibration (temperature scaling on log of raw scores, then renormalise) happens in be-recognition, not in the provider.

---

## 9. Known deviations from the spec (web MVP)

1. Platform: an Angular PWA, not Flutter/native mobile apps (spec section 6 allows flexibility only for Flutter/native). iOS/Android install via PWA.
2. No trained on-device CNN (FR-24, 4.3 INT8/TFLite): diagnosis uses a vision API (Gemini) behind `VisionProvider`; the offline path performs the Quality Gate (FR-2), stores a draft observation, and server diagnosis plus refinement runs after sync (FR-26). Therefore "full offline diagnostics" (section 7) is only partially met: offline gives capture, drafts, task drafts, cached catalogue/references, not a diagnosis. The 1-2 s on-device target is unmet.
3. Probabilities are the LLM's self-reported scores post-processed by temperature scaling with a configured T; they are not calibrated on a validation set. ECE target (4.5) cannot be claimed until a labelled set exists; the flywheel (4.4) collects it.
4. Grad-CAM is replaced by model-provided bounding regions (FR-10); regions are approximate.
5. Vector DB (section 6) is optional: be-similarity stores CLIP embeddings of labelled dataset photos in Qdrant and blends a vote into the provider's hypotheses: from a softmax probe trained on those vectors (`npm run train:classifier`) when present, else kNN (`SIMILARITY_*`, off by default; datasets are indexed with `npm run index:references`, see `docs/datasets/README.md`). `AI_PROVIDER=local` replaces the external vision API with that probe (`LocalVisionProvider`): ranked codes only, no crop/organ detection, regions, pest counts or clarifying questions; crops it was not trained on come back out of distribution. Catalogue reference images are still looked up by diagnosis code. No GPU inference service, no ML platform/model registry, no drift monitoring (4.4 steps 4-5) in MVP.
6. SSO: local email/password with JWT; group SSO later. Encryption at rest relies on host disk encryption, backups are an ops task (file copy of the SQLite DB and storage dir).
7. Stock: local table with CSV import; AP Storage/ERP connector is behind `StockProvider`, not implemented.
8. Seed catalogue data (products, registrations, thresholds, rates, intervals, buffers) is DEMO (`isDemo = true`, `source = demo_seed`) and must be verified against the State Register of Pesticides and Agrochemicals of Ukraine and the farm's technology cards before any real use (acceptance criterion 11.4). The UI shows a demo-data banner while `containsDemoData` is true.
9. AP Agronomist integration is stage 2: only the export DTOs/REST API are provided now (FR-23).
10. Field accessibility "economy of charge", glove mode, and sunlight mode are best-effort in a web app (large touch targets, high-contrast theme, reduced polling).
11. The mechanic role's quick capture creates an observation without a diagnosis choice; it is still diagnosable by the server later.
