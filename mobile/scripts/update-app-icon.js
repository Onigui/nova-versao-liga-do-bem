/**
 * Script para atualizar o ícone do app Android com a imagem configurada no admin
 * Este script deve ser executado durante o build do APK
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const API_BASE_URL = process.env.API_BASE_URL || 'https://nova-versao-liga-do-bem.vercel.app';
const ANDROID_RES_PATH = path.join(__dirname, '../android/app/src/main/res');

// Tamanhos de ícone para diferentes densidades
const ICON_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

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

async function fetchAppIcon() {
  try {
    console.log('🔄 Buscando ícone do app da API...');
    const response = await fetch(`${API_BASE_URL}/api/app/config`);
    
    if (!response.ok) {
      console.warn('⚠️ Não foi possível buscar configurações da API');
      return null;
    }
    
    const config = await response.json();
    const iconImage = config['login.iconImage'] || config['app.logoUrl'];
    
    if (!iconImage) {
      console.log('ℹ️ Nenhum ícone configurado no admin');
      return null;
    }
    
    console.log('✅ Ícone encontrado:', iconImage.substring(0, 50) + '...');
    return iconImage;
  } catch (error) {
    console.error('❌ Erro ao buscar ícone:', error);
    return null;
  }
}

async function updateAppIcon() {
  try {
    const iconImage = await fetchAppIcon();
    
    if (!iconImage) {
      console.log('ℹ️ Usando ícone padrão');
      return;
    }
    
    // Se for base64, salvar temporariamente
    let tempImagePath = null;
    if (iconImage.startsWith('data:')) {
      const base64Data = iconImage.replace(/^data:image\/\w+;base64,/, '');
      tempImagePath = path.join(__dirname, '../temp_icon.png');
      fs.writeFileSync(tempImagePath, base64Data, 'base64');
    } else {
      tempImagePath = path.join(__dirname, '../temp_icon.png');
      await downloadImage(iconImage, tempImagePath);
    }
    
    console.log('📝 Atualizando ícones do app...');
    // Aqui você precisaria usar uma biblioteca como sharp ou jimp para redimensionar
    // Por enquanto, apenas copiamos para todas as densidades
    // Em produção, você deve redimensionar para cada tamanho
    
    for (const [density, size] of Object.entries(ICON_SIZES)) {
      const densityPath = path.join(ANDROID_RES_PATH, density);
      if (fs.existsSync(densityPath)) {
        const launcherPath = path.join(densityPath, 'ic_launcher.png');
        const launcherRoundPath = path.join(densityPath, 'ic_launcher_round.png');
        
        // Copiar imagem (em produção, redimensionar para o tamanho correto)
        fs.copyFileSync(tempImagePath, launcherPath);
        fs.copyFileSync(tempImagePath, launcherRoundPath);
        console.log(`✅ Ícone atualizado para ${density}`);
      }
    }
    
    // Limpar arquivo temporário
    if (fs.existsSync(tempImagePath)) {
      fs.unlinkSync(tempImagePath);
    }
    
    console.log('✅ Ícones do app atualizados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao atualizar ícone do app:', error);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  updateAppIcon();
}

module.exports = { updateAppIcon };

