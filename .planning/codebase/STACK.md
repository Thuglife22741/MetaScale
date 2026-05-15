# MetaScale Stack

## Frontend & Framework
- **Framework**: Next.js 14.2.35 (App Router)
- **Language**: TypeScript (^5)
- **Styling**: Tailwind CSS (^3.4.1), PostCSS
- **UI Components/Icons**: Lucide React (^1.14.0)
- **Data Visualization**: Recharts (^3.8.1)
- **Environment**: Node.js (^20), React (^18)

## Backend & Database
- **Backend API**: Next.js Route Handlers (`src/app/api/`)
- **Database / BaaS**: Supabase (PostgreSQL, Authentication) via `@supabase/supabase-js` (^2.105.1)

## AI & APIs
- **AI Engine**: Anthropic Claude API (`@anthropic-ai/sdk` ^0.92.0) - Model `claude-3-5-sonnet-20241022`
- **External Ads API**: Meta Graph API (simulated/integrated in `src/lib/meta-api.ts`)
