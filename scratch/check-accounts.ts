import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const content = fs.readFileSync(envPath, 'utf8');
  const env: Record<string, string> = {};
  content.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length > 0) {
      env[key.trim()] = val.join('=').trim();
    }
  });
  return env;
}

const env = loadEnv();
const META_ACCESS_TOKEN = env.META_ACCESS_TOKEN;

async function checkAccounts() {
  if (!META_ACCESS_TOKEN) {
    console.error('META_ACCESS_TOKEN not found');
    return;
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${META_ACCESS_TOKEN}`);
    const data = await res.json();
    console.log('--- PAGES ---');
    console.log(JSON.stringify(data, null, 2));
    
    const adAccountRes = await fetch(`https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,currency&access_token=${META_ACCESS_TOKEN}`);
    const adAccountData = await adAccountRes.json();
    console.log('--- AD ACCOUNTS ---');
    console.log(JSON.stringify(adAccountData, null, 2));

  } catch (error) {
    console.error(error);
  }
}

checkAccounts();
