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

/** Человеческие названия для кодов/enum, которые иначе утекали в UI сырыми. */
export const LABELS: Record<string, string> = {
  // роли
  buyer: "заказчик", supplier: "поставщик", contractor: "подрядчик", supervisor: "технадзор", admin: "админ",
  // режимы заявок и источники лидов
  matched: "подбор поставщиков", direct: "точечный запрос", broadcast: "массовая рассылка", rematch: "повторный подбор", dispatcher: "назначен диспетчером",
  // объём КП и части сделки
  material_and_work: "материал и работа", material_only: "только материал", install_only: "только монтаж", material: "материал", install: "монтаж", delivery: "доставка",
  // акты
  acceptance: "акт приёмки", reconciliation: "акт сверки", supervisor_conclusion: "заключение технадзора",
  // политика отмены
  full_refund_before_start: "полный возврат до начала работ", partial_after_start: "частичный возврат после начала работ", no_refund: "без возврата",
  // ввод в эксплуатацию, тип работ
  not_started: "не начат", commissioned: "введён в эксплуатацию", new: "новое строительство", capital: "капитальный ремонт", cosmetic: "косметический ремонт", reconstruction: "реконструкция",
  // типы объектов (дублируют справочник object_types на случай отсутствия)
  house: "частный дом", hangar: "ангар", shop: "магазин", stable: "конюшня", warehouse: "склад", factory: "завод", cafe: "кафе", bathhouse: "баня", fence: "забор", garage: "гараж", premium_residential: "премиум-ЖК", mall: "ТРЦ", apartment_renovation: "ремонт квартиры",
  // каналы и документы
  in_app: "в приложении", push: "push", sms: "SMS", whatsapp: "WhatsApp", email: "e-mail", license: "лицензия", attestation: "аттестат", bin: "БИН", registration: "регистрация",
  // категории споров
  quality: "качество", deadline: "сроки", payment: "оплата", lead_refund: "возврат лида", act_unsigned: "акт не подписан", other: "другое",
};
export const L = (s: string | null | undefined) => (s ? LABELS[s] ?? STATUS_RU[s] ?? s : "—");

/** Человекочитаемое уведомление (вместо type + JSON). */
export function describeNotification(type: string, p: Record<string, unknown>): { title: string; href: string | null } {
  const s = (k: string) => (p[k] == null ? "" : String(p[k]));
  const map: Record<string, [string, string | null]> = {
    "lead.new": [`Новая заявка: ${s("category")}${s("city") ? ", " + s("city") : ""} — купите лид, чтобы ответить`, "/supplier/leads"],
    "request.direct": [`Заказчик выбрал вас: ${s("category")} (${s("project")}) — ответьте КП`, "/supplier/leads"],
    "request.broadcast": [`Массовый запрос: ${s("category")} — ответьте КП`, "/supplier/leads"],
    "offer.received": [`Новое коммерческое предложение от ${s("company")} по заявке «${s("category")}»`, `/requests/${s("request_id")}`],
    "offers.over_budget": ["Все предложения выше вашего бюджета — уточните бюджет или дождитесь других КП", `/requests/${s("request_id")}`],
    "offers.reminder": [`У вас ${s("offers")} непринятых предложений — сравните и выберите`, `/requests/${s("request_id")}`],
    "offer.not_selected": [`По заявке «${s("category")}» заказчик выбрал другого исполнителя`, "/supplier/leads"],
    "deal.created": ["Сделка создана — следующий шаг: оплата первого этапа в эскроу", s("deal_id") ? `/deals/${s("deal_id")}` : "/deals"],
    "milestone.funded": ["Заказчик оплатил этап — деньги в эскроу, можно начинать работы", `/deals/${s("deal_id")}`],
    "milestone.submitted": ["Исполнитель сдал этап — проверьте по чек-листу и примите", `/deals/${s("deal_id")}`],
    "milestone.accepted": [`Этап принят, ${s("accepted")} ₸ раскрыто из эскроу — подпишите акт`, "/deals"],
    "milestone.partially_accepted": [`Этап принят частично (${s("accepted")} ₸) — подпишите акт`, "/deals"],
    "act.generated": ["Сформирован акт — требуется ваша подпись", `/deals/${s("deal_id")}`],
    "dispute.opened": ["Открыт спор — эскроу по этапу заблокирован до решения", `/deals/${s("deal_id")}`],
    "dispute.resolved": ["Спор решён", "/deals"], "dispute.rejected": ["Спор отклонён", "/deals"],
    "pitch.received": [`Встречное предложение от ${s("company")} (${s("category")}) — примите или отклоните`, "/inbox"],
    "pitch.accepted": ["Заказчик принял ваше встречное предложение — создана заявка", "/supplier/leads"],
    "pitch.declined": ["Заказчик отклонил встречное предложение", "/supplier/leads"],
    "message.new": ["Новое сообщение в чате", `/threads/${s("thread_id")}`],
    "review.new": [`Новый отзыв (${s("rating")}★)`, null], "review.response": ["Компания ответила на ваш отзыв", null],
    "warranty.claim": ["Гарантийная претензия по сделке", `/deals/${s("deal_id")}`],
    "timeline.upcoming_need": [`Скоро этап «${s("stage")}» — пора собирать предложения по «${s("category")}»`, `/projects/${s("project_id")}`],
    "request.needs_dispatcher": [`Заявка «${s("category")}» (${s("city")}) без кандидатов — назначьте поставщика`, "/admin"],
    "verification.verified": ["Документ верифицирован", "/supplier/settings"], "verification.rejected": ["Документ отклонён", "/supplier/settings"], "verification.expiring": ["Срок лицензии истекает — обновите документ", "/supplier/settings"],
    "payout.approved": ["Вывод средств одобрен", "/supplier/wallet"], "payout.completed": ["Вывод средств выполнен", "/supplier/wallet"], "payout.rejected": ["Вывод средств отклонён — деньги возвращены на баланс", "/supplier/wallet"],
    "deal.cancelled": ["Сделка отменена", "/deals"], "lead.dispute": ["Запрос на возврат лида", "/admin"], "review.dispute": ["Оспаривание отзыва", "/admin"],
  };
  const m = map[type];
  return m ? { title: m[0], href: m[1] } : { title: type, href: null };
}
