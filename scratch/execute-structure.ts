import fs from 'fs';
import path from 'path';
import { createCampaign, createAdSet, createAd, createAdCreative } from '../src/lib/meta-api-extended';

// Note: I'm creating a temporary file for the extended API to avoid polluting the main file if I made mistakes, 
// but actually I already updated src/lib/meta-api.ts. I'll just use that.
import { createTestCampaign, createAdSet as apiCreateAdSet, createAd as apiCreateAd, createAdCreative as apiCreateAdCreative } from '../src/lib/meta-api';

async function run() {
  console.log('--- Iniciando criação da estrutura completa ---');

  // 1. Criar Campanha
  console.log('Passo 1: Criando Campanha...');
  // Note: createTestCampaign is hardcoded in meta-api.ts. 
  // I should have made it more flexible. I'll use a custom fetch for the campaign to match the requirements exactly.
  
  const envPath = path.resolve(process.cwd(), '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env: Record<string, string> = {};
  envContent.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length > 0) env[key.trim()] = val.join('=').trim();
  });

  const AD_ACCOUNT_ID = env.META_AD_ACCOUNT_ID;
  const META_ACCESS_TOKEN = env.META_ACCESS_TOKEN;

  // Criar Campanha via Fetch direto para garantir os parâmetros exatos do usuário
  const campaignParams = new URLSearchParams({
    name: 'Teste Estrutura Completa - IA Antigravity',
    objective: 'OUTCOME_TRAFFIC',
    status: 'PAUSED',
    special_ad_categories: '[]',
    is_adset_budget_sharing_enabled: 'false',
    access_token: META_ACCESS_TOKEN
  });
  
  const campaignRes = await fetch(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/campaigns?${campaignParams.toString()}`, { method: 'POST' });
  const campaignData = await campaignRes.json();

  if (campaignData.error) {
    console.error('Erro ao criar campanha:', campaignData.error);
    return;
  }

  const campaignId = campaignData.id;
  console.log(`Campanha criada com sucesso! ID: ${campaignId}`);

  // 2. Criar AdSet
  console.log('Passo 2: Criando AdSet...');
  const adsetResult = await apiCreateAdSet(campaignId, 'Conjunto de Teste - Localização Brasil', 5.00);
  
  if (!adsetResult.success) {
    console.error('Erro ao criar AdSet:', adsetResult.error);
    return;
  }

  const adsetId = adsetResult.adset_id;
  console.log(`AdSet criado com sucesso! ID: ${adsetId}`);

  // 3. Criar Ad
  console.log('Passo 3: Criando Ad (Rascunho)...');
  // Como não temos um Page ID, tentaremos encontrar um ou criar um criativo mínimo.
  // Se falhar, informaremos os IDs da Campanha e AdSet.
  
  // Tentativa de encontrar uma página vinculada ao usuário para o criativo
  const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${META_ACCESS_TOKEN}`);
  const pagesData = await pagesRes.json();
  
  let pageId = '';
  if (pagesData.data && pagesData.data.length > 0) {
    pageId = pagesData.data[0].id;
  } else {
    console.warn('AVISO: Nenhuma página encontrada. A criação do Ad (Criativo) pode falhar.');
    // Usaremos um placeholder se possível, mas Meta exige uma página real.
    // Se não tiver página, o nível 3 falhará.
  }

  if (pageId) {
    const creativeResult = await apiCreateAdCreative('Criativo de Teste - Placeholder', pageId);
    if (creativeResult.success) {
      const adResult = await apiCreateAd(adsetId, creativeResult.creative_id, 'Anúncio de Teste - Upload Manual');
      if (adResult.success) {
        console.log(`Ad criado com sucesso! ID: ${adResult.ad_id}`);
        console.log('--- ESTRUTURA COMPLETA GERADA ---');
        console.log(`Campaign ID: ${campaignId}`);
        console.log(`AdSet ID: ${adsetId}`);
        console.log(`Ad ID: ${adResult.ad_id}`);
      } else {
        console.error('Erro ao criar Ad:', adResult.error);
      }
    } else {
      console.error('Erro ao criar Criativo:', creativeResult.error);
    }
  } else {
    console.error('ERRO: Não foi possível criar o Ad porque nenhuma Página do Facebook foi encontrada para este usuário.');
    console.log('IDs gerados até agora:');
    console.log(`Campaign ID: ${campaignId}`);
    console.log(`AdSet ID: ${adsetId}`);
  }
}

run();
