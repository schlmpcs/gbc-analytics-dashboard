# GBC Analytics Dashboard

Mini-dashboard for order analytics integrating RetailCRM, Supabase, Vercel, and Telegram.

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Supabase** (PostgreSQL database)
- **Tailwind CSS** (styling)
- **Recharts** (charts)
- **RetailCRM API** (order source)
- **Telegram Bot API** (high-value order alerts)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `.env.local` in the project root:

```env
RETAILCRM_URL=https://<subdomain>.retailcrm.ru
RETAILCRM_API_KEY=<your-api-key>
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
TELEGRAM_BOT_TOKEN=<your-telegram-bot-token>
TELEGRAM_CHAT_ID=<your-telegram-chat-id>
```

### 3. Create the Supabase table

Run the migration in [`supabase/migrations/20260414_create_orders.sql`](/D:/Coding/gbc-analytics-dashboard/supabase/migrations/20260414_create_orders.sql) in the Supabase SQL Editor:

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

If the table already exists, run:

```sql
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS city VARCHAR(255),
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS items_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items_summary TEXT;
```

### 4. Upload mock orders to RetailCRM

```bash
npx tsx scripts/upload_to_crm.ts
```

### 5. Sync orders from RetailCRM to Supabase

```bash
npx tsx scripts/sync_to_supabase.ts
```

### 6. Run the dashboard locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 7. Deploy to Vercel

Add all `.env.local` variables to Vercel Environment Variables, then deploy.

### 8. Configure Telegram webhook

In RetailCRM: Settings > Integration > Webhooks > create a webhook pointing to:

```
https://<your-vercel-url>.vercel.app/api/webhook/retailcrm
```

Trigger on "Order Created" or "Order Modified" events. Orders over 50,000 KZT will send a Telegram alert.

## Verification

Smoke checks:

```bash
npm run test:sync-smoke
npm run test:webhook-smoke
```

Quality checks:

```bash
npm run lint
npm run build
```

## Project Structure

```
scripts/
  upload_to_crm.ts      - uploads mock_orders.json to RetailCRM
  sync_to_supabase.ts   - syncs orders from RetailCRM to Supabase
src/app/
  page.tsx              - dashboard with metrics, chart, orders table
  api/webhook/retailcrm/route.ts - webhook for Telegram alerts (>50k KZT)
lib/
  supabase.ts           - Supabase client utility
```

## Claude Code: Prompts, Challenges & Solutions

### Prompts given

1. "read @CLAUDE_PLAN.md and @README.md and start implementing the project" - initial kickoff with a detailed implementation plan.

### Challenges encountered

1. **RetailCRM "Order is not loaded" error:** The initial upload script included `orderType: "eshop-individual"` and `orderMethod: "shopping-cart"` fields from the mock data. These values didn't exist in the demo RetailCRM instance, causing all 50 uploads to fail. **Solution:** Removed CRM-specific enum fields (`orderType`, `orderMethod`, `status`, `customFields`) from the upload payload and let RetailCRM use defaults. All 50 orders uploaded successfully after the fix.

2. **TypeScript type error with Recharts Tooltip:** The `formatter` prop on `<Tooltip>` rejected a typed `(value: number)` parameter because Recharts types expect `ValueType | undefined`. **Solution:** Changed to untyped `(value)` parameter with `Number(value)` cast inside the formatter.

3. **`.env.local` file naming:** The env file was initially created without the leading dot (`env.local` instead of `.env.local`), which Next.js doesn't recognize. **Solution:** Renamed the file and trimmed leading whitespace from variable definitions.

4. **Supabase anon key needs `NEXT_PUBLIC_` prefix:** The env variable was named `SUPABASE_ANON_KEY`, but Next.js client components can only access env vars prefixed with `NEXT_PUBLIC_`. **Solution:** Renamed to `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
