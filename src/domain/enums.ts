export enum Role { Scout = 'scout', ChiefAgronomist = 'chief_agronomist', Mechanic = 'mechanic', Expert = 'expert' }
export enum ProblemCategory { Disease = 'disease', Pest = 'pest', Weed = 'weed', Nutrition = 'nutrition', AbioticStress = 'abiotic_stress', MechanicalDamage = 'mechanical_damage', Normal = 'normal' }
export enum Organ { Leaf = 'leaf', Ear = 'ear', Stem = 'stem', Fruit = 'fruit', Root = 'root', Pest = 'pest', Field = 'field' }
export enum ActionLevel { Observe = 'observe', Threshold = 'threshold', Treat = 'treat', Urgent = 'urgent' }
export enum RecommendationStatus { Draft = 'draft', Approved = 'approved', Rejected = 'rejected' }
export enum TaskType { Treatment = 'treatment', Reinspection = 'reinspection', Sampling = 'sampling' }
export enum TaskStatus { Open = 'open', InProgress = 'in_progress', Done = 'done', Cancelled = 'cancelled' }
export enum TaskPriority { Low = 'low', Normal = 'normal', High = 'high', Urgent = 'urgent' }
export enum ObservationStatus { Draft = 'draft', PendingSync = 'pending_sync', Synced = 'synced', Diagnosed = 'diagnosed', Confirmed = 'confirmed' }
export enum WeatherVerdict { Go = 'go', NoGo = 'no_go', Wait = 'wait' }
export enum ExpertCaseReason { LowConfidence = 'low_confidence', UserModelDisagreement = 'user_model_disagreement', RareClass = 'rare_class', OutOfDistribution = 'out_of_distribution', UnsureMode = 'unsure_mode' }
export enum ExpertCaseStatus { Open = 'open', InReview = 'in_review', Resolved = 'resolved' }
export enum ProposalStatus { Pending = 'pending', Approved = 'approved', Rejected = 'rejected' }
export enum ProductSource { Registry = 'registry', InternalTechCard = 'internal_tech_card', DemoSeed = 'demo_seed' }
export enum PestStage { Imago = 'imago', Larva = 'larva', Nymph = 'nymph', Egg = 'egg', Pupa = 'pupa', Unknown = 'unknown' }
export enum LabelSource { User = 'user', Expert = 'expert', Model = 'model' }

export enum FieldSource { Manual = 'manual', ImportKml = 'import_kml', ImportGeojson = 'import_geojson', ImportShp = 'import_shp', Drawn = 'drawn' }
export enum FieldLinkMethod { Gps = 'gps', Manual = 'manual', None = 'none' }
export enum DiagnosisPass { Initial = 'initial', ServerRefined = 'server_refined', Confirmed = 'confirmed' }
export enum LabelAction { Confirm = 'confirm', Change = 'change', AddNewClass = 'add_new_class', Reject = 'reject' }
export enum ProposalEntityType { Product = 'product', Registration = 'registration', Threshold = 'threshold', Diagnosis = 'diagnosis', ActiveSubstance = 'active_substance', ReferenceImage = 'reference_image', Crop = 'crop' }
export enum ProposalOperation { Create = 'create', Update = 'update', Delete = 'delete' }
export enum ThresholdMetric { PercentLeafArea = 'percent_leaf_area', PestsPerM2 = 'pests_per_m2', PestsPerPlant = 'pests_per_plant', PercentPlants = 'percent_plants' }
export enum ResistanceSystem { Frac = 'FRAC', Irac = 'IRAC', Hrac = 'HRAC', None = 'none' }
export enum PollinatorHazard { High = 'high', Moderate = 'moderate', Low = 'low', Unknown = 'unknown' }
export enum RateUnit { LPerHa = 'l/ha', KgPerHa = 'kg/ha' }
export enum StockSource { Manual = 'manual', Csv = 'csv', Erp = 'erp' }
export enum SyncOperation { Upsert = 'upsert', Delete = 'delete' }
export enum SyncStatus { Applied = 'applied', Conflict = 'conflict', Failed = 'failed' }
export enum SyncEntityType { Observation = 'observation', Task = 'task', Treatment = 'treatment', Field = 'field', Feedback = 'feedback' }
export enum AnswerType { YesNo = 'yes_no', Choice = 'choice' }
