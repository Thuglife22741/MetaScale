import { NextResponse } from 'next/server';
import { fetchAccountInfo, hasMetaCredentials } from '@/lib/meta-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  if (!hasMetaCredentials()) {
    return NextResponse.json({ accounts: [] });
  }

  const account = await fetchAccountInfo();

  return NextResponse.json({
    accounts: account
      ? [
          {
            id: account.id,
            name: account.name,
            status: account.account_status === 1 ? 'ACTIVE' : 'INACTIVE',
            currency: account.currency,
          },
        ]
      : [],
  });
}
