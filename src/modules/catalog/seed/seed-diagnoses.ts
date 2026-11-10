import { AnswerType, Organ, ProblemCategory } from '../../../domain/enums';
import type { QuestionDto } from '../../../domain/types';

export interface SeedDiagnosis {
  code: string;
  nameUk: string;
  nameEn: string;
  latinName: string | null;
  problemCategory: ProblemCategory;
  isQuarantine: boolean;
  isCritical: boolean;
  typicalOrgans: Organ[];
  cropCodes: string[];
  descriptionUk: string;
  descriptionEn: string;
  clarifyingQuestions: QuestionDto[];
}

const yesNo = (id: string, textUk: string, textEn: string, narrows: string[]): QuestionDto => ({
  id, textUk, textEn, answerType: AnswerType.YesNo, narrowsDiagnosisCodes: narrows,
});

const ALL_CROPS = ['wheat_winter', 'maize', 'sunflower', 'soybean', 'rapeseed'];
const D = ProblemCategory;

const base = { latinName: null, isQuarantine: false, isCritical: false };

export const SEED_DIAGNOSES: SeedDiagnosis[] = [
  {
    ...base, code: 'healthy_plant', nameUk: 'Здорова рослина', nameEn: 'Healthy plant', problemCategory: D.Normal,
    typicalOrgans: [Organ.Leaf, Organ.Field], cropCodes: ALL_CROPS,
    descriptionUk: 'Ознак хвороб чи шкідників не виявлено.', descriptionEn: 'No signs of disease or pests.',
    clarifyingQuestions: [],
  },
  {
    ...base, code: 'septoria_leaf_blotch', nameUk: 'Септоріоз листя', nameEn: 'Septoria leaf blotch', latinName: 'Zymoseptoria tritici',
    problemCategory: D.Disease, typicalOrgans: [Organ.Leaf], cropCodes: ['wheat_winter'],
    descriptionUk: 'Світло-бурі плями з темними пікнідами на нижніх листках, що піднімаються вгору.',
    descriptionEn: 'Light brown blotches with dark pycnidia on lower leaves, spreading upward.',
    clarifyingQuestions: [yesNo('septoria_pycnidia', 'Чи видно дрібні чорні крапки (пікніди) всередині плям?', 'Are tiny black dots (pycnidia) visible inside the blotches?', ['septoria_leaf_blotch', 'wheat_leaf_rust'])],
  },
  {
    ...base, code: 'wheat_yellow_rust', nameUk: 'Жовта іржа пшениці', nameEn: 'Wheat yellow rust', latinName: 'Puccinia striiformis',
    problemCategory: D.Disease, isCritical: true, typicalOrgans: [Organ.Leaf], cropCodes: ['wheat_winter'],
    descriptionUk: 'Жовті пустули, розташовані смугами вздовж жилок листка.', descriptionEn: 'Yellow pustules arranged in stripes along leaf veins.',
    clarifyingQuestions: [yesNo('rust_stripes', 'Чи розташовані пустули смугами вздовж жилок?', 'Are the pustules arranged in stripes along the veins?', ['wheat_yellow_rust', 'wheat_leaf_rust'])],
  },
  {
    ...base, code: 'wheat_leaf_rust', nameUk: 'Бура іржа пшениці', nameEn: 'Wheat leaf rust', latinName: 'Puccinia triticina',
    problemCategory: D.Disease, typicalOrgans: [Organ.Leaf], cropCodes: ['wheat_winter'],
    descriptionUk: 'Оранжево-бурі пустули, розкидані хаотично по пластинці листка.', descriptionEn: 'Orange-brown pustules scattered randomly over the leaf blade.',
    clarifyingQuestions: [yesNo('rust_scattered', 'Чи розкидані пустули хаотично, а не смугами?', 'Are the pustules scattered rather than in stripes?', ['wheat_leaf_rust', 'wheat_yellow_rust'])],
  },
  {
    ...base, code: 'powdery_mildew_wheat', nameUk: 'Борошниста роса пшениці', nameEn: 'Wheat powdery mildew', latinName: 'Blumeria graminis',
    problemCategory: D.Disease, typicalOrgans: [Organ.Leaf, Organ.Stem], cropCodes: ['wheat_winter'],
    descriptionUk: 'Білий борошнистий наліт на листках і стеблі.', descriptionEn: 'White powdery coating on leaves and stems.',
    clarifyingQuestions: [yesNo('mildew_wipes', 'Чи легко стирається білий наліт пальцем?', 'Does the white coating wipe off easily with a finger?', ['powdery_mildew_wheat'])],
  },
  {
    ...base, code: 'fusarium_head_blight', nameUk: 'Фузаріоз колоса', nameEn: 'Fusarium head blight', latinName: 'Fusarium graminearum',
    problemCategory: D.Disease, isCritical: true, typicalOrgans: [Organ.Ear], cropCodes: ['wheat_winter'],
    descriptionUk: 'Передчасне побіління окремих колосків, рожевий наліт; ризик мікотоксинів.', descriptionEn: 'Premature bleaching of spikelets, pink coating; mycotoxin risk.',
    clarifyingQuestions: [yesNo('fusarium_pink', 'Чи є рожевий наліт біля основи колоска?', 'Is there a pink coating at the base of the spikelet?', ['fusarium_head_blight'])],
  },
  {
    ...base, code: 'cereal_leaf_beetle', nameUk: "П'явиця червоногруда", nameEn: 'Cereal leaf beetle', latinName: 'Oulema melanopus',
    problemCategory: D.Pest, typicalOrgans: [Organ.Leaf, Organ.Pest], cropCodes: ['wheat_winter'],
    descriptionUk: 'Личинки в слизовому покриві вигризають епідерміс листка, залишаючи поздовжні віконця.', descriptionEn: 'Slime-covered larvae scrape the leaf epidermis, leaving longitudinal windows.',
    clarifyingQuestions: [yesNo('beetle_larvae', 'Чи видно личинок, вкритих слизом?', 'Are slime-covered larvae visible?', ['cereal_leaf_beetle'])],
  },
  {
    ...base, code: 'cereal_aphids', nameUk: 'Попелиці злакові', nameEn: 'Cereal aphids', latinName: 'Sitobion avenae',
    problemCategory: D.Pest, typicalOrgans: [Organ.Ear, Organ.Leaf, Organ.Pest], cropCodes: ['wheat_winter'],
    descriptionUk: 'Колонії дрібних комах на колосі та верхніх листках, липка паділь.', descriptionEn: 'Colonies of small insects on the ear and upper leaves, sticky honeydew.',
    clarifyingQuestions: [yesNo('aphid_honeydew', 'Чи є липка паділь або чорні сажисті нальоти?', 'Is there sticky honeydew or black sooty mould?', ['cereal_aphids'])],
  },
  {
    ...base, code: 'northern_leaf_blight_maize', nameUk: 'Гельмінтоспоріоз кукурудзи', nameEn: 'Northern corn leaf blight', latinName: 'Exserohilum turcicum',
    problemCategory: D.Disease, typicalOrgans: [Organ.Leaf], cropCodes: ['maize'],
    descriptionUk: 'Довгі сигароподібні сіро-бурі плями на листках.', descriptionEn: 'Long cigar-shaped grey-brown lesions on leaves.',
    clarifyingQuestions: [yesNo('blight_cigar', 'Чи мають плями форму довгої сигари (понад 3 см)?', 'Are the lesions long and cigar-shaped (over 3 cm)?', ['northern_leaf_blight_maize'])],
  },
  {
    ...base, code: 'european_corn_borer', nameUk: 'Стебловий кукурудзяний метелик', nameEn: 'European corn borer', latinName: 'Ostrinia nubilalis',
    problemCategory: D.Pest, typicalOrgans: [Organ.Stem, Organ.Ear, Organ.Pest], cropCodes: ['maize'],
    descriptionUk: 'Отвори у стеблі та качані, буре борошно з екскрементів, надломи волоті.', descriptionEn: 'Entry holes in stalk and cob, frass, broken tassels.',
    clarifyingQuestions: [yesNo('borer_frass', 'Чи є біля отворів дрібне буре борошно (екскременти)?', 'Is there fine brown frass near the holes?', ['european_corn_borer'])],
  },
  {
    ...base, code: 'western_corn_rootworm', nameUk: 'Західний кукурудзяний жук', nameEn: 'Western corn rootworm', latinName: 'Diabrotica virgifera virgifera',
    problemCategory: D.Pest, isQuarantine: true, isCritical: true, typicalOrgans: [Organ.Root, Organ.Pest, Organ.Ear], cropCodes: ['maize'],
    descriptionUk: 'Жуки з поздовжніми смугами на надкрильях об’їдають шовк качана; личинки ушкоджують коріння.', descriptionEn: 'Striped beetles feed on silks; larvae damage roots.',
    clarifyingQuestions: [yesNo('rootworm_goosenecking', 'Чи вигнуті стебла гусячою шиєю біля основи (полягання)?', 'Are stalks bent in a gooseneck shape at the base (lodging)?', ['western_corn_rootworm'])],
  },
  {
    ...base, code: 'phomopsis_sunflower', nameUk: 'Фомопсис соняшнику', nameEn: 'Sunflower phomopsis', latinName: 'Diaporthe helianthi',
    problemCategory: D.Disease, typicalOrgans: [Organ.Stem, Organ.Leaf], cropCodes: ['sunflower'],
    descriptionUk: 'Бурі плями на стеблі в місці прикріплення листка з пікнідами.', descriptionEn: 'Brown lesions on the stem at the leaf node with pycnidia.',
    clarifyingQuestions: [yesNo('phomopsis_node', 'Чи починаються плями біля черешка листка на стеблі?', 'Do the lesions start at the leaf petiole on the stem?', ['phomopsis_sunflower', 'white_rot_sclerotinia'])],
  },
  {
    ...base, code: 'sunflower_downy_mildew', nameUk: 'Несправжня борошниста роса соняшнику', nameEn: 'Sunflower downy mildew', latinName: 'Plasmopara halstedii',
    problemCategory: D.Disease, isCritical: true, typicalOrgans: [Organ.Leaf, Organ.Stem], cropCodes: ['sunflower'],
    descriptionUk: 'Карликовість, хлорозна мозаїка листків, білий наліт знизу листка.', descriptionEn: 'Stunting, chlorotic leaf mosaic, white sporulation under the leaf.',
    clarifyingQuestions: [yesNo('downy_stunted', 'Чи відстає рослина в рості порівняно із сусідніми?', 'Is the plant stunted compared with its neighbours?', ['sunflower_downy_mildew'])],
  },
  {
    ...base, code: 'white_rot_sclerotinia', nameUk: 'Біла гниль (склеротиніоз)', nameEn: 'White mould (Sclerotinia)', latinName: 'Sclerotinia sclerotiorum',
    problemCategory: D.Disease, isCritical: true, typicalOrgans: [Organ.Stem, Organ.Fruit], cropCodes: ['sunflower', 'soybean', 'rapeseed'],
    descriptionUk: 'Білий ватоподібний міцелій і чорні склероції на стеблі чи кошику.', descriptionEn: 'White cottony mycelium and black sclerotia on the stem or head.',
    clarifyingQuestions: [yesNo('sclerotia_visible', 'Чи видно чорні тверді склероції всередині тканини?', 'Are hard black sclerotia visible inside the tissue?', ['white_rot_sclerotinia'])],
  },
  {
    ...base, code: 'soybean_downy_mildew', nameUk: 'Пероноспороз сої', nameEn: 'Soybean downy mildew', latinName: 'Peronospora manshurica',
    problemCategory: D.Disease, typicalOrgans: [Organ.Leaf], cropCodes: ['soybean'],
    descriptionUk: 'Жовтувато-зелені плями зверху листка, сірий наліт знизу.', descriptionEn: 'Yellow-green patches above, grey sporulation below the leaf.',
    clarifyingQuestions: [yesNo('soy_underside', 'Чи є сіро-фіолетовий наліт на нижньому боці листка?', 'Is there grey-violet sporulation on the underside?', ['soybean_downy_mildew'])],
  },
  {
    ...base, code: 'spider_mite', nameUk: 'Павутинний кліщ', nameEn: 'Two-spotted spider mite', latinName: 'Tetranychus urticae',
    problemCategory: D.Pest, typicalOrgans: [Organ.Leaf, Organ.Pest], cropCodes: ['soybean', 'sunflower', 'maize'],
    descriptionUk: 'Мармуровість листків, тонке павутиння з нижнього боку, дрібні рухомі точки.', descriptionEn: 'Stippled leaves, fine webbing underneath, tiny moving dots.',
    clarifyingQuestions: [yesNo('mite_web', 'Чи є тонке павутиння на нижньому боці листка?', 'Is there fine webbing on the underside of the leaf?', ['spider_mite'])],
  },
  {
    ...base, code: 'phoma_stem_canker', nameUk: 'Фомоз ріпаку', nameEn: 'Phoma stem canker', latinName: 'Leptosphaeria maculans',
    problemCategory: D.Disease, typicalOrgans: [Organ.Leaf, Organ.Stem], cropCodes: ['rapeseed'],
    descriptionUk: 'Світлі плями з пікнідами на листках восени; сухий рак кореневої шийки навесні.', descriptionEn: 'Pale leaf spots with pycnidia in autumn; dry basal canker in spring.',
    clarifyingQuestions: [yesNo('phoma_canker', 'Чи є темний рак біля кореневої шийки?', 'Is there a dark canker at the stem base?', ['phoma_stem_canker'])],
  },
  {
    ...base, code: 'alternaria_rapeseed', nameUk: 'Альтернаріоз ріпаку', nameEn: 'Rapeseed alternaria leaf spot', latinName: 'Alternaria brassicae',
    problemCategory: D.Disease, typicalOrgans: [Organ.Leaf, Organ.Fruit], cropCodes: ['rapeseed'],
    descriptionUk: 'Темні плями з концентричними кільцями на листках і стручках.', descriptionEn: 'Dark spots with concentric rings on leaves and pods.',
    clarifyingQuestions: [yesNo('alternaria_rings', 'Чи мають плями концентричні кільця?', 'Do the spots show concentric rings?', ['alternaria_rapeseed'])],
  },
  {
    ...base, code: 'pollen_beetle', nameUk: 'Нектароїд ріпаковий', nameEn: 'Pollen beetle', latinName: 'Brassicogethes aeneus',
    problemCategory: D.Pest, typicalOrgans: [Organ.Pest, Organ.Fruit], cropCodes: ['rapeseed'],
    descriptionUk: 'Дрібні чорні блискучі жуки в бутонах; бутони засихають і опадають.', descriptionEn: 'Small shiny black beetles in buds; buds dry up and drop.',
    clarifyingQuestions: [yesNo('beetle_in_buds', 'Чи знаходяться жуки всередині нерозкритих бутонів?', 'Are beetles found inside unopened buds?', ['pollen_beetle'])],
  },
  {
    ...base, code: 'cabbage_stem_flea_beetle', nameUk: 'Стеблова ріпакова блішка', nameEn: 'Cabbage stem flea beetle', latinName: 'Psylliodes chrysocephala',
    problemCategory: D.Pest, typicalOrgans: [Organ.Leaf, Organ.Pest], cropCodes: ['rapeseed'],
    descriptionUk: 'Круглі дрібні отвори в сходах (дірчастість), жуки стрибають при дотику.', descriptionEn: 'Small round shot-holes in seedlings; beetles jump when disturbed.',
    clarifyingQuestions: [yesNo('flea_jumps', 'Чи стрибають дрібні жуки при дотику до рослини?', 'Do small beetles jump when the plant is touched?', ['cabbage_stem_flea_beetle'])],
  },
];
