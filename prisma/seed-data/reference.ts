// Справочники: регионы, типы объектов, категории, длительности этапов, комиссии, чек-листы, регуляторные правила.

export const regions = [
  { code: "almaty", name: "Алматы", name_kk: "Алматы", lat: 43.238, lng: 76.945 },
  { code: "almaty_obl", name: "Алматинская область", name_kk: "Алматы облысы", lat: 43.5, lng: 77.0 },
  { code: "kaskelen", name: "Каскелен", name_kk: "Қаскелең", parent: "almaty_obl", lat: 43.2, lng: 76.62 },
  { code: "boraldai", name: "Боралдай", name_kk: "Боралдай", parent: "almaty_obl", lat: 43.36, lng: 76.85 },
  { code: "uzynagash", name: "Узын-Агач", name_kk: "Ұзынағаш", parent: "almaty_obl", lat: 43.23, lng: 76.31 },
  { code: "chemolgan", name: "Чемолган", name_kk: "Шамалған", parent: "almaty_obl", lat: 43.37, lng: 76.62 },
  { code: "talgar", name: "Талгар", name_kk: "Талғар", parent: "almaty_obl", lat: 43.3, lng: 77.23 },
  { code: "alatau", name: "Алатау", name_kk: "Алатау", parent: "almaty_obl", lat: 43.85, lng: 77.05 },
  { code: "konaev", name: "Конаев", name_kk: "Қонаев", parent: "almaty_obl", lat: 43.88, lng: 77.06 },
  { code: "astana", name: "Астана", name_kk: "Астана", lat: 51.16, lng: 71.43 },
  { code: "shymkent", name: "Шымкент", name_kk: "Шымкент", lat: 42.34, lng: 69.59 },
  { code: "akmola", name: "Акмолинская область", name_kk: "Ақмола облысы" },
  { code: "aktobe", name: "Актюбинская область", name_kk: "Ақтөбе облысы" },
  { code: "atyrau", name: "Атырауская область", name_kk: "Атырау облысы" },
  { code: "vko", name: "Восточно-Казахстанская область", name_kk: "Шығыс Қазақстан облысы" },
  { code: "zhambyl", name: "Жамбылская область", name_kk: "Жамбыл облысы" },
  { code: "zko", name: "Западно-Казахстанская область", name_kk: "Батыс Қазақстан облысы" },
  { code: "karaganda", name: "Карагандинская область", name_kk: "Қарағанды облысы" },
  { code: "kostanay", name: "Костанайская область", name_kk: "Қостанай облысы" },
  { code: "kyzylorda", name: "Кызылординская область", name_kk: "Қызылорда облысы" },
  { code: "mangystau", name: "Мангистауская область", name_kk: "Маңғыстау облысы" },
  { code: "pavlodar", name: "Павлодарская область", name_kk: "Павлодар облысы" },
  { code: "sko", name: "Северо-Казахстанская область", name_kk: "Солтүстік Қазақстан облысы" },
  { code: "turkestan", name: "Туркестанская область", name_kk: "Түркістан облысы" },
  { code: "abai", name: "Область Абай", name_kk: "Абай облысы" },
  { code: "zhetisu", name: "Область Жетысу", name_kk: "Жетісу облысы" },
  { code: "ulytau", name: "Область Улытау", name_kk: "Ұлытау облысы" },
];

export const objectTypes = [
  { code: "house", name: "Частный дом", name_kk: "Жеке үй" },
  { code: "hangar", name: "Ангар", name_kk: "Ангар" },
  { code: "shop", name: "Магазин", name_kk: "Дүкен" },
  { code: "stable", name: "Конюшня", name_kk: "Ат қора" },
  { code: "warehouse", name: "Склад", name_kk: "Қойма" },
  { code: "factory", name: "Завод", name_kk: "Зауыт" },
  { code: "cafe", name: "Кафе", name_kk: "Кафе" },
  { code: "bathhouse", name: "Баня", name_kk: "Монша" },
  { code: "fence", name: "Забор", name_kk: "Қоршау" },
  { code: "garage", name: "Гараж", name_kk: "Гараж" },
  { code: "premium_residential", name: "Премиум-ЖК", name_kk: "Премиум ТҮК" },
  { code: "mall", name: "ТРЦ", name_kk: "СОО" },
  { code: "apartment_renovation", name: "Ремонт квартиры", name_kk: "Пәтер жөндеу", is_renovation: true },
];

const BUILD = ["house", "hangar", "shop", "stable", "warehouse", "factory", "cafe", "bathhouse", "garage", "premium_residential", "mall"];
const RENO = ["apartment_renovation", "house", "cafe", "shop"];
const winter = { months: [11, 12, 1, 2], message: "Зимой работы требуют противоморозных добавок/прогрева — сроки и цена могут вырасти." };

export const categories: {
  code: string; name: string; name_kk: string; object_types: string[]; parent?: string;
  required_license?: boolean; required_attestation?: boolean; seasonal?: object | null; order: number;
}[] = [
  { code: "concrete", name: "Бетон / фундамент", name_kk: "Бетон / іргетас", object_types: [...BUILD, "fence"], seasonal: winter, order: 10 },
  { code: "walls", name: "Стены / блоки", name_kk: "Қабырға / блоктар", object_types: BUILD, seasonal: winter, order: 20 },
  { code: "roof", name: "Крыша / кровля", name_kk: "Шатыр / жабын", object_types: BUILD, order: 30 },
  { code: "windows", name: "Окна", name_kk: "Терезелер", object_types: [...BUILD, "apartment_renovation"], order: 40 },
  { code: "landscaping", name: "Благоустройство / газон", name_kk: "Абаттандыру / көгал", object_types: [...BUILD, "fence"], seasonal: { months: [11, 12, 1, 2, 3], message: "Газон и посадки — только в тёплый сезон." }, order: 50 },
  { code: "fence", name: "Забор / ограждение", name_kk: "Қоршау", object_types: [...BUILD, "fence"], order: 55 },
  // Ремонт квартиры
  { code: "reno_demolition", name: "Демонтаж", name_kk: "Бұзу жұмыстары", object_types: RENO, order: 100 },
  { code: "reno_electrical", name: "Электрика (ремонт)", name_kk: "Электрика (жөндеу)", object_types: RENO, required_license: true, order: 110 },
  { code: "reno_plumbing", name: "Сантехника", name_kk: "Сантехника", object_types: RENO, order: 120 },
  { code: "reno_screed", name: "Стяжка / выравнивание пола", name_kk: "Еден тегістеу", object_types: RENO, order: 130 },
  { code: "reno_plaster", name: "Штукатурка", name_kk: "Сылақ", object_types: RENO, order: 140 },
  { code: "reno_tile", name: "Плитка", name_kk: "Плитка", object_types: RENO, order: 150 },
  { code: "reno_ceiling", name: "Потолки", name_kk: "Төбе", object_types: RENO, order: 160 },
  { code: "reno_paint", name: "Малярка / обои", name_kk: "Сырлау / тұсқағаз", object_types: RENO, order: 170 },
  { code: "reno_floor", name: "Полы (покрытие)", name_kk: "Еден жабыны", object_types: RENO, order: 180 },
  { code: "reno_doors", name: "Двери", name_kk: "Есіктер", object_types: RENO, order: 190 },
  // Инженерные системы и слаботочка
  { code: "eng_electrical", name: "Электроснабжение", name_kk: "Электрмен жабдықтау", object_types: BUILD, required_license: true, order: 200 },
  { code: "eng_water_sewer", name: "Водоснабжение и канализация", name_kk: "Сумен жабдықтау және кәріз", object_types: BUILD, order: 210 },
  { code: "eng_heating", name: "Отопление", name_kk: "Жылыту", object_types: BUILD, order: 220 },
  { code: "eng_hvac", name: "Вентиляция / кондиционирование", name_kk: "Желдету / кондиционер", object_types: BUILD, order: 230 },
  { code: "eng_gas", name: "Газоснабжение", name_kk: "Газбен жабдықтау", object_types: BUILD, required_license: true, order: 240 },
  { code: "eng_smart_home", name: "Умный дом", name_kk: "Ақылды үй", object_types: [...BUILD, "apartment_renovation"], order: 250 },
  { code: "eng_cctv", name: "Видеонаблюдение", name_kk: "Бейнебақылау", object_types: [...BUILD, "apartment_renovation"], order: 260 },
  { code: "eng_security", name: "Охранная сигнализация / СКУД / домофон", name_kk: "Күзет дабылы / СКУД / домофон", object_types: BUILD, required_license: true, order: 270 },
  { code: "eng_fire", name: "Пожарная безопасность", name_kk: "Өрт қауіпсіздігі", object_types: BUILD, required_license: true, order: 280 },
];

// Типовые этапы: (object_type, construction_type|null, stage_name, order, days, category_code)
type STD = { object_type: string; construction_type?: string | null; stage_name: string; order_index: number; typical_days: number; category_code?: string | null };
const buildStages = (ot: string, k = 1): STD[] => [
  { object_type: ot, stage_name: "Подготовка участка", order_index: 1, typical_days: Math.round(7 * k) },
  { object_type: ot, stage_name: "Фундамент", order_index: 2, typical_days: Math.round(21 * k), category_code: "concrete" },
  { object_type: ot, stage_name: "Стены", order_index: 3, typical_days: Math.round(30 * k), category_code: "walls" },
  { object_type: ot, stage_name: "Крыша", order_index: 4, typical_days: Math.round(14 * k), category_code: "roof" },
  { object_type: ot, stage_name: "Окна и двери", order_index: 5, typical_days: Math.round(10 * k), category_code: "windows" },
  { object_type: ot, stage_name: "Инженерные сети", order_index: 6, typical_days: Math.round(21 * k), category_code: "eng_electrical" },
  { object_type: ot, stage_name: "Отделка", order_index: 7, typical_days: Math.round(30 * k), category_code: "reno_plaster" },
  { object_type: ot, stage_name: "Благоустройство", order_index: 8, typical_days: Math.round(10 * k), category_code: "landscaping" },
];
export const stageTypicalDurations: STD[] = [
  ...buildStages("house"),
  ...buildStages("bathhouse", 0.6),
  ...buildStages("garage", 0.5),
  ...buildStages("cafe", 1.2),
  ...buildStages("shop", 1.2),
  ...buildStages("hangar", 1.5),
  ...buildStages("warehouse", 1.8),
  ...buildStages("stable", 1.2),
  ...buildStages("factory", 4),
  ...buildStages("premium_residential", 6),
  ...buildStages("mall", 8),
  { object_type: "fence", stage_name: "Фундамент/столбы", order_index: 1, typical_days: 5, category_code: "concrete" },
  { object_type: "fence", stage_name: "Монтаж ограждения", order_index: 2, typical_days: 5, category_code: "fence" },
  { object_type: "apartment_renovation", stage_name: "Демонтаж", order_index: 1, typical_days: 5, category_code: "reno_demolition" },
  { object_type: "apartment_renovation", stage_name: "Электрика", order_index: 2, typical_days: 7, category_code: "reno_electrical" },
  { object_type: "apartment_renovation", stage_name: "Сантехника", order_index: 3, typical_days: 7, category_code: "reno_plumbing" },
  { object_type: "apartment_renovation", stage_name: "Стяжка", order_index: 4, typical_days: 10, category_code: "reno_screed" },
  { object_type: "apartment_renovation", stage_name: "Штукатурка", order_index: 5, typical_days: 14, category_code: "reno_plaster" },
  { object_type: "apartment_renovation", stage_name: "Плитка", order_index: 6, typical_days: 10, category_code: "reno_tile" },
  { object_type: "apartment_renovation", stage_name: "Потолки", order_index: 7, typical_days: 5, category_code: "reno_ceiling" },
  { object_type: "apartment_renovation", stage_name: "Малярка / обои", order_index: 8, typical_days: 10, category_code: "reno_paint" },
  { object_type: "apartment_renovation", stage_name: "Полы", order_index: 9, typical_days: 5, category_code: "reno_floor" },
  { object_type: "apartment_renovation", stage_name: "Двери", order_index: 10, typical_days: 3, category_code: "reno_doors" },
];

export const commissionTiers = [
  { min_amount: 0, max_amount: 2_000_000, percent: 5 },
  { min_amount: 2_000_000, max_amount: 10_000_000, percent: 3 },
  { min_amount: 10_000_000, max_amount: null, percent: 1 },
];

export const checklists: Record<string, { text: string; text_kk?: string; photo: boolean }[]> = {
  concrete: [
    { text: "Опалубка демонтирована, геометрия соответствует проекту", photo: true },
    { text: "Поверхность без раковин и трещин", photo: true },
    { text: "Арматурные выпуски по проекту", photo: true },
    { text: "Паспорт бетона / накладные предоставлены", photo: false },
  ],
  windows: [
    { text: "Размеры изделий соответствуют заказу", photo: false },
    { text: "Створки открываются/закрываются без усилия", photo: false },
    { text: "Монтажный шов запенен и закрыт лентой", photo: true },
    { text: "Откосы, отливы, подоконники установлены", photo: true },
  ],
  roof: [
    { text: "Стропильная система закреплена, обработана антисептиком", photo: true },
    { text: "Кровельное покрытие без повреждений, нахлёсты по инструкции", photo: true },
    { text: "Водосток и снегозадержание смонтированы", photo: true },
    { text: "Ендовы и примыкания герметичны", photo: false },
  ],
  reno_electrical: [
    { text: "Щит собран, автоматы промаркированы", photo: true },
    { text: "Заземление выполнено, УЗО проверено", photo: true },
    { text: "Схема электрики передана заказчику", photo: false },
  ],
  reno_tile: [
    { text: "Гидроизоляция в мокрых зонах выполнена", photo: true },
    { text: "Швы затёрты, плитка без пустот (простукивание)", photo: false },
    { text: "Раскладка соответствует согласованной", photo: true },
  ],
  eng_electrical: [
    { text: "Ввод и щит учёта смонтированы по ТУ", photo: true },
    { text: "Контур заземления выполнен, протокол замера есть", photo: true },
  ],
  eng_gas: [
    { text: "Газопровод опрессован, акт опрессовки", photo: true },
    { text: "Газоанализатор/клапан установлены", photo: true },
  ],
};

export const regulatoryRules = [
  { object_type: null, construction_type: null, min_area: null, max_area: 500, min_floors: null, responsibility_level: "III", needs_permit: false, needs_expertise: false, needs_tech_supervision: false, note: "ИЖС до 500 м² и до 2 этажей — уведомительный порядок", priority: 0 },
  { object_type: null, construction_type: null, min_area: null, max_area: null, min_floors: 3, responsibility_level: "II", needs_permit: true, needs_expertise: true, needs_tech_supervision: true, note: "3 и более этажей — разрешение + экспертиза", priority: 5 },
  { object_type: null, construction_type: null, min_area: 500, max_area: 5000, min_floors: null, responsibility_level: "II", needs_permit: true, needs_expertise: true, needs_tech_supervision: true, note: "Нормальный уровень ответственности", priority: 4 },
  { object_type: null, construction_type: null, min_area: 5000, max_area: null, min_floors: null, responsibility_level: "I", needs_permit: true, needs_expertise: true, needs_tech_supervision: true, note: "Повышенный уровень ответственности", priority: 8 },
  { object_type: "premium_residential", construction_type: null, min_area: null, max_area: null, min_floors: null, responsibility_level: "I", needs_permit: true, needs_expertise: true, needs_tech_supervision: true, note: "Многоквартирный дом — всегда повышенный", priority: 10 },
  { object_type: "mall", construction_type: null, min_area: null, max_area: null, min_floors: null, responsibility_level: "I", needs_permit: true, needs_expertise: true, needs_tech_supervision: true, note: "ТРЦ — всегда повышенный", priority: 10 },
  { object_type: "factory", construction_type: null, min_area: null, max_area: null, min_floors: null, responsibility_level: "I", needs_permit: true, needs_expertise: true, needs_tech_supervision: true, note: "Промышленный объект", priority: 10 },
  { object_type: "fence", construction_type: null, min_area: null, max_area: null, min_floors: null, responsibility_level: "III", needs_permit: false, needs_expertise: false, needs_tech_supervision: false, note: "Ограждение", priority: 10 },
  { object_type: "apartment_renovation", construction_type: "capital", min_area: null, max_area: null, min_floors: null, responsibility_level: "III", needs_permit: true, needs_expertise: false, needs_tech_supervision: false, note: "Капремонт с перепланировкой — согласование", priority: 10 },
  { object_type: "apartment_renovation", construction_type: "cosmetic", min_area: null, max_area: null, min_floors: null, responsibility_level: "III", needs_permit: false, needs_expertise: false, needs_tech_supervision: false, note: "Косметический ремонт", priority: 10 },
];

export const priceReference = [
  // category, region, unit, min, avg, max
  { category: "concrete", region: "almaty", unit: "м³ (М300 с доставкой)", min: 28000, avg: 34000, max: 42000 },
  { category: "windows", region: "almaty", unit: "м² изделия (с монтажом)", min: 35000, avg: 48000, max: 70000 },
  { category: "roof", region: "almaty", unit: "м² ската (металлочерепица, работа+материал)", min: 9000, avg: 14000, max: 22000 },
  { category: "reno_electrical", region: "almaty", unit: "точка", min: 6000, avg: 9000, max: 14000 },
  { category: "reno_tile", region: "almaty", unit: "м²", min: 7000, avg: 10000, max: 16000 },
  { category: "walls", region: "almaty", unit: "м³ кладки", min: 25000, avg: 32000, max: 45000 },
];
