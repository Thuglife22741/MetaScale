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

async function listAdAccounts() {
  const env = getEnv();
  const token = env.META_ACCESS_TOKEN;
  
  if (!token) {
    console.error('META_ACCESS_TOKEN not found in .env.local');
    return;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name&access_token=${token}`);
    const data = await response.json();
    
    if (data.error) {
      console.error('Error fetching ad accounts:', JSON.stringify(data.error, null, 2));
    } else {
      console.log('Available Ad Accounts:');
      console.log(JSON.stringify(data.data, null, 2));
    }
  } catch (error) {
    console.error('Fetch failed:', error);
  }
}

listAdAccounts();
