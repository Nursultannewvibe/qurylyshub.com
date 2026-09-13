export type Locale = "ru" | "kk";
const dict = {
  ru: {
    app: "Qurylys Hub", tagline: "Операционная система стройки и ремонта", catalog: "Каталог поставщиков", map: "Карта объектов", login: "Войти", logout: "Выйти", dashboard: "Кабинет",
    projects: "Объекты", inbox: "Входящие", outbox: "Исходящие", deals: "Сделки", leads: "Лиды", offers: "КП", pitches: "Встречные предложения", wallet: "Кошелёк", settings: "Настройки", admin: "Админ / диспетчер", supervisor: "Технадзор", notifications: "Уведомления", threads: "Чаты",
    new_project: "Новый объект", send_request: "Отправить заявку", compare: "Сравнить КП", broadcast: "Массовая рассылка", phone: "Телефон", otp: "Код из SMS", get_code: "Получить код", confirm: "Подтвердить",
    hero_title: "Стройте и ремонтируйте без хаоса в мессенджерах", hero_text: "Объект → этапы → структурированные заявки → КП по единому формату → эскроу → акты → репутация. Работает по всему Казахстану, пилот — Алматы и пригороды.",
    role_buyer: "Заказчик", role_supplier: "Поставщик", role_contractor: "Подрядчик", role_supervisor: "Технадзор", role_admin: "Админ", guest: "Гость",
    legal: "Платформа — информационный посредник, не сторона договора и не технадзор. Акты подписывают стороны. Персональные данные хранятся на серверах в Республике Казахстан.",
    lang: "Қазақша",
  },
  kk: {
    app: "Qurylys Hub", tagline: "Құрылыс пен жөндеудің операциялық жүйесі", catalog: "Жеткізушілер каталогы", map: "Нысандар картасы", login: "Кіру", logout: "Шығу", dashboard: "Кабинет",
    projects: "Нысандар", inbox: "Кіріс", outbox: "Шығыс", deals: "Мәмілелер", leads: "Лидтер", offers: "КҰ", pitches: "Қарсы ұсыныстар", wallet: "Әмиян", settings: "Баптаулар", admin: "Әкімші / диспетчер", supervisor: "Техқадағалау", notifications: "Хабарламалар", threads: "Чаттар",
    new_project: "Жаңа нысан", send_request: "Өтінім жіберу", compare: "КҰ салыстыру", broadcast: "Жаппай жіберу", phone: "Телефон", otp: "SMS коды", get_code: "Код алу", confirm: "Растау",
    hero_title: "Мессенджерлердегі хаоссыз құрылыс пен жөндеу", hero_text: "Нысан → кезеңдер → құрылымдық өтінімдер → бірыңғай форматтағы КҰ → эскроу → актілер → бедел. Бүкіл Қазақстан бойынша, пилот — Алматы және маңы.",
    role_buyer: "Тапсырыс беруші", role_supplier: "Жеткізуші", role_contractor: "Мердігер", role_supervisor: "Техқадағалау", role_admin: "Әкімші", guest: "Қонақ",
    legal: "Платформа — ақпараттық делдал, шарт тарапы да, техқадағалау да емес. Актілерге тараптар қол қояды. Дербес деректер Қазақстан Республикасындағы серверлерде сақталады.",
    lang: "Русский",
  },
} as const;
export type Key = keyof typeof dict.ru;
export const t = (locale: Locale, key: Key): string => dict[locale][key] ?? dict.ru[key];
export const STATUS_RU: Record<string, string> = {
  draft: "черновик", published: "опубликована", needs_dispatcher: "нужен диспетчер", expired: "истекла", cancelled: "отменена", closed: "закрыта",
  offered: "предложен", declined: "отклонён", purchased: "куплен", refunded: "возвращён", sent: "отправлено", not_selected: "не выбрано", accepted: "принято",
  created: "создана", awaiting_payment: "ожидает оплаты", in_progress: "в работе", completed: "завершена", pending: "ожидает", funded: "оплачен (эскроу)", submitted: "сдан", partially_accepted: "принят частично", rejected: "отклонён",
  held: "удержано", released: "раскрыто", signed: "подписан", disputed: "оспорен", open: "открыт", in_review: "на рассмотрении", resolved: "решён", approved: "одобрен", verified: "верифицирован", viewed: "просмотрено", active: "активен", paused: "пауза", archived: "архив", retry_pending: "повтор", succeeded: "успешно", failed: "ошибка",
};
export const ru = (s: string) => STATUS_RU[s] ?? s;
