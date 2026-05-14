/**
 * Script para atualizar o ícone do app Android com a imagem configurada no admin.
 * No CI, instale sharp antes (ver workflow). sharp redimensiona e grava PNG por densidade.
 */

const fs = require('fs');
const path = require('path');

const API_BASE_URL = process.env.API_BASE_URL || 'https://nova-versao-liga-do-bem.vercel.app';
const ANDROID_RES_PATH = path.join(__dirname, '../android/app/src/main/res');

/** Evita sobrescrever mipmaps com HTML/JSON da API; aceita PNG/JPEG/GIF/WebP. */
function isRasterImageFile(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    try {
      const buf = Buffer.alloc(12);
      const n = fs.readSync(fd, buf, 0, 12, 0);
      if (n < 3) return false;
      if (
        n >= 8 &&
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47
      ) {
        return true;
      }
      if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
        return true;
      }
      if (n >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
        return true;
      }
      if (
        n >= 12 &&
        buf[0] === 0x52 &&
        buf[1] === 0x49 &&
        buf[2] === 0x46 &&
        buf[3] === 0x46 &&
        buf[8] === 0x57 &&
        buf[9] === 0x45 &&
        buf[10] === 0x42 &&
        buf[11] === 0x50
      ) {
        return true;
      }
      return false;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
}

const ICON_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

async function downloadImage(url, outputPath) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Failed to download: ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputPath, buf);
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

    console.log('✅ Ícone encontrado:', iconImage.length > 60 ? `${iconImage.substring(0, 60)}...` : iconImage);
    return iconImage;
  } catch (error) {
    console.error('❌ Erro ao buscar ícone:', error);
    return null;
  }
}

function isStrictPngFile(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    try {
      const buf = Buffer.alloc(8);
      const n = fs.readSync(fd, buf, 0, 8, 0);
      if (n < 8) return false;
      return (
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a
      );
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
}

async function writeIconsFromSource(sourcePath) {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    sharp = null;
  }

  if (!sharp) {
    if (!isStrictPngFile(sourcePath)) {
      console.warn(
        '⚠️ Sem o pacote sharp: só é possível copiar PNG literal. Use PNG no admin ou adicione sharp em devDependencies e rode npm install.',
      );
      return false;
    }
  }

  for (const [density, size] of Object.entries(ICON_SIZES)) {
    const densityPath = path.join(ANDROID_RES_PATH, density);
    if (!fs.existsSync(densityPath)) {
      fs.mkdirSync(densityPath, { recursive: true });
    }
    const launcherPath = path.join(densityPath, 'ic_launcher.png');
    const launcherRoundPath = path.join(densityPath, 'ic_launcher_round.png');

    if (sharp) {
      const pipeline = sharp(sourcePath).resize(size, size, { fit: 'cover' }).png();
      await pipeline.toFile(launcherPath);
      await sharp(sourcePath).resize(size, size, { fit: 'cover' }).png().toFile(launcherRoundPath);
    } else {
      fs.copyFileSync(sourcePath, launcherPath);
      fs.copyFileSync(sourcePath, launcherRoundPath);
    }
    console.log(`✅ Ícone atualizado para ${density} (${size}px)`);
  }
  return true;
}

async function updateAppIcon() {
  try {
    const iconImage = await fetchAppIcon();

    if (!iconImage) {
      console.log('ℹ️ Usando ícone padrão');
      return;
    }

    let tempImagePath = null;
    if (iconImage.startsWith('data:')) {
      const base64Data = iconImage.replace(/^data:image\/\w+;base64,/, '');
      tempImagePath = path.join(__dirname, '../temp_icon.bin');
      fs.writeFileSync(tempImagePath, base64Data, 'base64');
    } else {
      tempImagePath = path.join(__dirname, '../temp_icon.bin');
      await downloadImage(iconImage, tempImagePath);
    }

    if (!isRasterImageFile(tempImagePath)) {
      console.warn(
        '⚠️ Arquivo não é imagem raster reconhecida (PNG/JPEG/GIF/WebP); mantendo ícones do repositório',
      );
      if (fs.existsSync(tempImagePath)) fs.unlinkSync(tempImagePath);
      return;
    }

    console.log('📝 Gerando mipmaps...');
    const ok = await writeIconsFromSource(tempImagePath);
    if (!ok) {
      if (fs.existsSync(tempImagePath)) fs.unlinkSync(tempImagePath);
      return;
    }

    if (fs.existsSync(tempImagePath)) {
      fs.unlinkSync(tempImagePath);
    }

    console.log('✅ Ícones do app atualizados com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao atualizar ícone do app:', error);
  }
}

if (require.main === module) {
  updateAppIcon();
}

module.exports = { updateAppIcon };
