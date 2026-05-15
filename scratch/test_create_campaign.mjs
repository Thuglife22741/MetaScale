import fs from 'fs';

function getEnv() {
  const content = fs.readFileSync('.env.local', 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) {
      env[key.trim()] = value.join('=').trim();
    }
  });
  return env;
}

async function createTestCampaign() {
  const env = getEnv();
  const token = env.META_ACCESS_TOKEN;
  const adAccountId = env.META_AD_ACCOUNT_ID;

  if (!token || !adAccountId) {
    console.error('META_ACCESS_TOKEN or META_AD_ACCOUNT_ID not found in .env.local');
    return;
  }

  const url = `https://graph.facebook.com/v19.0/${adAccountId}/campaigns`;
  
  const params = new URLSearchParams({
    name: 'Teste IA Antigravity - Campanha de Curtidas',
    objective: 'OUTCOME_ENGAGEMENT',
    status: 'PAUSED',
    special_ad_categories: '[]',
    is_adset_budget_sharing_enabled: 'false',
    access_token: token
  });

  try {
    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'POST',
    });

    const data = await response.json();

    if (data.error) {
      console.error('FAILED: Error creating campaign:');
      console.error(JSON.stringify(data.error, null, 2));
    } else {
      console.log('SUCCESS: Campaign created!');
      console.log('CAMPAIGN_ID:', data.id);
    }
  } catch (error) {
    console.error('CRITICAL: Fetch failed:', error);
  }
}

createTestCampaign();
