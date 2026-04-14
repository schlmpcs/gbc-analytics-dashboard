# GBC Analytics Dashboard

Мини-дашборд аналитики заказов с интеграцией RetailCRM, Supabase, Vercel и Telegram.

## Стек технологий

- **Next.js 16** (App Router, TypeScript)
- **Supabase** (PostgreSQL база данных + realtime)
- **Tailwind CSS** (стилизация)
- **Recharts** (графики)
- **RetailCRM API** (источник заказов)
- **Telegram Bot API** (уведомления о крупных заказах)

## Как запустить

### 1. Установить зависимости

```bash
npm install
```

### 2. Настроить переменные окружения

Создать `.env.local` в корне проекта:

```env
RETAILCRM_URL=https://<subdomain>.retailcrm.ru
RETAILCRM_API_KEY=<your-api-key>
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
TELEGRAM_BOT_TOKEN=<your-telegram-bot-token>
TELEGRAM_CHAT_ID=<your-telegram-chat-id>
```

### 3. Создать таблицу в Supabase

Выполнить в Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR(255) UNIQUE,
  number VARCHAR(255),
  total_sum DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50),
  customer_name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  city VARCHAR(255),
  delivery_address TEXT,
  items_count INTEGER DEFAULT 0,
  items_summary TEXT
);
```

### 4. Загрузить тестовые заказы в RetailCRM

```bash
npx tsx scripts/upload_to_crm.ts
```

### 5. Синхронизировать заказы в Supabase

```bash
npx tsx scripts/sync_to_supabase.ts
```

### 6. Запустить локально

```bash
npm run dev
```

Открыть [http://localhost:3000](http://localhost:3000).

### 7. Задеплоить на Vercel

Добавить все переменные из `.env.local` в Vercel Environment Variables и задеплоить.

## Структура проекта

```
scripts/
  upload_to_crm.ts       — загрузка mock_orders.json в RetailCRM
  sync_to_supabase.ts    — синхронизация заказов из RetailCRM в Supabase
src/app/
  page.tsx               — дашборд: метрики, график, таблица заказов
  orders/page.tsx        — страница всех заказов
  api/sync/orders/       — маршрут синхронизации (GET, вызывается каждые 60 сек)
  api/webhook/retailcrm/ — вебхук для Telegram-уведомлений (>50 000 ₸)
src/lib/
  telegramWebhook.ts     — логика обработки вебхука и отправки сообщений
  orderSync.ts           — маппинг данных RetailCRM → Supabase
  supabaseAdmin.ts       — Supabase клиент с сервисным ключом
```

---

## Процесс разработки с Claude Code и Codex

### Подход

Проект строился итеративно: сначала рабочий скелет, затем замена UI через Google Stitch, затем фичи поверх готовой базы. Claude Code CLI использовался на основных этапах — от написания скриптов до отладки edge-кейсов в runtime. Позже для точечных задач по поддержке репозитория и документации также использовался Codex: проверка git-конфигурации, исправление `origin`, push в новый GitHub-репозиторий и синхронизация README с локальными инструкциями агента.

Для ускорения работы активно использовались **субагенты** (Agent tool в Claude Code). Независимые задачи запускались параллельно вместо последовательного выполнения — это существенно сократило время на исследование кодовой базы и реализацию фич. Например, пока один субагент изучал структуру RetailCRM API и маппинг полей, второй параллельно настраивал схему Supabase и писал миграцию. При интеграции Stitch-экспорта один субагент анализировал существующую логику данных, второй — новые компоненты, после чего основной агент объединял результаты.

Текущий workflow теперь зафиксирован и в `AGENTS.md`, чтобы одинаково работать и с Claude Code, и с Codex:

- перед изменениями в приложении агент сначала читает локальные гайды Next.js из `node_modules/next/dist/docs/`, а не полагается на старые знания о Next.js;
- перед архитектурными вопросами и крупными изменениями агент сначала смотрит `graphify-out/GRAPH_REPORT.md`;
- если позже появится `graphify-out/wiki/index.md`, навигация должна идти через wiki, а не через хаотичное чтение исходников;
- после изменений в коде граф graphify нужно пересобирать командой `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`.

---

### Этап 1 — Скелет проекта и первая рабочая версия

**Промпты (English):**

```
Before writing any code, read the Next.js docs in node_modules/next/dist/docs/
to understand the App Router conventions in this version. Then implement the
following plan from @CLAUDE_PLAN.md step by step, committing after each
logical unit. Do not add features not listed in the plan.
```

```
Write a TypeScript script at scripts/upload_to_crm.ts that reads mock_orders.json
and uploads each order to RetailCRM v5 API using POST /api/v5/orders/create.
Handle rate limiting with exponential backoff. Log each result — success or error —
with the order number. Do not use any libraries outside of what's already in
package.json.
```

```
Write scripts/sync_to_supabase.ts that fetches all orders from RetailCRM
/api/v5/orders (paginated, limit 100 per page) and upserts them into the
Supabase `orders` table using the service role key. The upsert should be
idempotent — conflict on external_id. Map CRM fields to Supabase columns
exactly as defined in the migration file.
```

Claude Code сгенерировал полную структуру: скрипты загрузки и синхронизации, маршруты API, базовый дашборд с графиком Recharts и таблицей заказов.

**Где застрял:**

- **RetailCRM: "Order is not loaded"** — скрипт включал поля `orderType: "eshop-individual"` и `orderMethod: "shopping-cart"` из mock-данных, которых не существовало в демо-аккаунте. Все 50 заказов падали. **Решение:** убрал CRM-специфичные enum-поля (`orderType`, `orderMethod`, `status`, `customFields`), оставил только базовые. Все 50 загрузились.

- **TypeScript ошибка с Recharts Tooltip** — typed `(value: number)` не проходил, Recharts ожидает `ValueType | undefined`. **Решение:** убрал аннотацию типа, добавил `Number(value)` внутри форматтера.

- **`.env.local` без точки** — файл был создан как `env.local`, Next.js его не читал. **Решение:** переименовал, убрал пробелы в значениях.

- **`NEXT_PUBLIC_` префикс** — `SUPABASE_ANON_KEY` недоступна в клиентских компонентах без префикса. **Решение:** переименовал в `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

### Этап 2 — Полная замена UI через Google Stitch

Первая версия дашборда была функциональной, но визуально слабой. Вместо того чтобы просить Claude Code улучшать CSS по одному компоненту, использовал **Google Stitch** для генерации полноценного UI с нуля.

**Как работал с Stitch:**

Описал в промпте точную дизайн-систему: цветовую палитру (тёмно-синий бренд, светлые нейтралы), типографику (Inter), компоненты (карточки KPI с иконками, area chart с градиентом, таблица с drawer-деталями заказа, боковая навигация). Stitch сгенерировал полный Next.js/Tailwind проект со всеми компонентами.

Скачал экспорт и передал Claude Code задачу на интеграцию:

```
I have a new UI exported from Google Stitch in /stitch-export. The data logic
lives in the existing API routes and lib/ files — do not touch those.
Your job: replace src/app/page.tsx and src/components/ with the Stitch components,
wire them to the existing hooks and API calls (useEffect → /api/orders/overview),
and make sure TypeScript compiles clean. Preserve all existing functionality:
search, pagination, date filtering, order drawer.
```

```
The Stitch export uses hardcoded mock arrays for chart data and KPI values.
Replace every hardcoded data source with the real API responses from
/api/orders/overview. Keep the component structure and all className strings
exactly as Stitch generated them — only swap the data layer.
```

Claude Code перенёс логику данных в новую структуру компонентов без потери функциональности и без изменения дизайна.

---

### Этап 3 — Telegram-уведомления + graphify

На этом этапе подключил **graphify** — расширение для Claude Code, которое строит граф знаний кодовой базы. Вместо того чтобы Claude читал каждый файл заново в каждой сессии, graphify даёт ему структурированную карту проекта. Это ощутимо сократило количество лишних чтений файлов и улучшило точность изменений в крупных модулях.

**Промпты (English):**

```
Before reading any source files, check graphify-out/GRAPH_REPORT.md for the
god nodes and community structure of this codebase. Then implement a Telegram
notification: when a new order arrives via POST /api/webhook/retailcrm and
its totalSumm exceeds 50000, send an HTML-formatted message to the configured
TELEGRAM_CHAT_ID. Use parse_mode: "HTML". Escape all user-supplied values
before interpolating into the message template.
```

```
Harden the webhook handler at src/lib/telegramWebhook.ts:
- Accept both application/json and application/x-www-form-urlencoded content types
- Parse nested RetailCRM-style keys like order[totalSumm] from form payloads
- Support JSON-stringified order field (parse it if it looks like a JSON object)
- Skip non-create events (order.edit, order.update, etc.) — return 200 with
  { ignored: true } instead of notifying
- Validate the extracted totalSumm — return 400 if missing or non-numeric
- Check res.ok after the Telegram API call and throw on failure instead of
  silently treating it as success
```

```
Write a local verification script at scripts/check_telegram_webhook.ts that
exercises four cases without hitting real external services: high-value JSON
payload, high-value form-encoded payload, low-value payload (should not notify),
and an ignored non-create event. Mock globalThis.fetch. Print all four results
as JSON.
```

**Где застрял:**

- **Вебхуки отсутствуют в демо-плане RetailCRM** — раздела настройки вебхуков в интерфейсе нет. Webhook-маршрут не мог запускаться автоматически. **Решение:** перенёс логику уведомлений в `/api/sync/orders`. Синк теперь перед upsert проверяет, каких `external_id` нет в Supabase, и отправляет Telegram только для новых заказов с суммой > 50 000 ₸.

- **HTML-инъекция в Telegram** — символы `<`, `>`, `&` в именах клиентов ломали `parse_mode: "HTML"`. **Решение:** добавил `escapeHtml()` перед всеми пользовательскими значениями в шаблоне.

- **`Invalid time value` на графике** — `parseISO(d)` падал на строках `"null"` и `"undefine"` (результат `String(null).slice(0, 10)`). **Решение:** в API-маршруте добавил фильтрацию перед записью в dailyMap, в компонентах графика обернул форматтеры в try/catch.

---

### Этап 4 — Realtime-обновления и поиск

**Промпты (English):**

```
Add Supabase Realtime to the dashboard. Subscribe to postgres_changes on the
orders table (all events). On any change, re-fetch the overview data without
a full page reload. The subscription should be cleaned up on component unmount.
Do not use polling — use the realtime channel only for triggering refetches,
not for updating local state directly from the event payload.
```

```
Add server-side search to /api/orders/overview. Accept a ?search= query param
and filter orders by customer_name, number, or phone using Supabase ilike.
The search should be applied before pagination. On the frontend, debounce the
input by 300ms before updating the query param.
```

Подключил Supabase Realtime через `postgres_changes` — при любом изменении таблицы `orders` дашборд автоматически рефетчит данные. В связке с автосинком каждые 60 секунд это даёт полный цикл без ручного вмешательства.

---

## Итоговая схема работы

```
RetailCRM
   │
   │  каждые 60 сек (автосинк из браузера)
   ▼
/api/sync/orders
   │  upsert новых заказов
   │  новые + сумма > 50 000 ₸ → Telegram
   ▼
Supabase (orders)
   │
   │  Realtime postgres_changes
   ▼
Дашборд обновляется автоматически
```
