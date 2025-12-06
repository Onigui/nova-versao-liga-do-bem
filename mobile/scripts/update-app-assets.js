/**
 * Script para atualizar logo e ícone do app com as imagens configuradas no admin
 * Este script deve ser executado durante o build do APK
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const API_BASE_URL = process.env.API_BASE_URL || 'https://nova-versao-liga-do-bem.vercel.app';
const ASSETS_PATH = path.join(__dirname, '../src/assets/images');

// Garantir que o diretório existe
if (!fs.existsSync(ASSETS_PATH)) {
  fs.mkdirSync(ASSETS_PATH, { recursive: true });
}

async function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      const fileStream = fs.createWriteStream(outputPath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      
      fileStream.on('error', reject);
    }).on('error', reject);
  });
}

async function saveBase64Image(base64Data, outputPath) {
  // Remover o prefixo data:image/...;base64,
  const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync(outputPath, base64Content, 'base64');
}

async function fetchAppConfig() {
  try {
    console.log('🔄 Buscando configurações do app da API...');
    const response = await fetch(`${API_BASE_URL}/api/app/config`);
    
    if (!response.ok) {
      console.warn('⚠️ Não foi possível buscar configurações da API');
      return null;
    }
    
    const config = await response.json();
    console.log('✅ Configurações recebidas da API');
    return config;
  } catch (error) {
    console.error('❌ Erro ao buscar configurações:', error);
    return null;
  }
}

async function updateAppAssets() {
  try {
    const config = await fetchAppConfig();
    
    if (!config) {
      console.log('ℹ️ Usando assets padrão');
      return;
    }
    
    // Buscar logo da página inicial
    const appLogoUrl = config['app.logoUrl'];
    if (appLogoUrl && appLogoUrl.trim() !== '') {
      console.log('📥 Baixando logo da página inicial...');
      const logoPath = path.join(ASSETS_PATH, 'app-logo.png');
      
      if (appLogoUrl.startsWith('data:')) {
        await saveBase64Image(appLogoUrl, logoPath);
      } else {
        await downloadImage(appLogoUrl, logoPath);
      }
      console.log('✅ Logo da página inicial salvo');
    } else {
      console.log('ℹ️ Nenhum logo da página inicial configurado');
    }
    
    // Buscar logo do login
    const loginLogoUrl = config['login.logoUrl'] || config['app.logoUrl'];
    if (loginLogoUrl && loginLogoUrl.trim() !== '') {
      console.log('📥 Baixando logo do login...');
      const loginLogoPath = path.join(ASSETS_PATH, 'login-logo.png');
      
      if (loginLogoUrl.startsWith('data:')) {
        await saveBase64Image(loginLogoUrl, loginLogoPath);
      } else {
        await downloadImage(loginLogoUrl, loginLogoPath);
      }
      console.log('✅ Logo do login salvo');
    } else {
      console.log('ℹ️ Nenhum logo do login configurado');
    }
    
    // Buscar ícone (imagem)
    const iconImage = config['login.iconImage'];
    if (iconImage && iconImage.trim() !== '') {
      console.log('📥 Baixando ícone...');
      const iconPath = path.join(ASSETS_PATH, 'app-icon.png');
      
      if (iconImage.startsWith('data:')) {
        await saveBase64Image(iconImage, iconPath);
      } else {
        await downloadImage(iconImage, iconPath);
      }
      console.log('✅ Ícone salvo');
    } else {
      console.log('ℹ️ Nenhum ícone (imagem) configurado');
    }
    
    // Salvar também o ícone emoji/texto como arquivo de configuração
    const iconEmoji = config['login.icon'] || '🐾';
    const iconConfigPath = path.join(ASSETS_PATH, 'icon-config.json');
    fs.writeFileSync(iconConfigPath, JSON.stringify({ icon: iconEmoji }, null, 2));
    console.log('✅ Configuração do ícone salva');
    
    console.log('✅ Assets do app atualizados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao atualizar assets do app:', error);
    // Não falhar o build se houver erro
    process.exit(0);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  updateAppAssets();
}

module.exports = { updateAppAssets };

