import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { getPrisma } from '../utils/prisma';

const router = Router();

// Endpoint para verificar atualizações (já existe, mas vamos garantir que está correto)
router.get('/update/check', async (req: Request, res: Response) => {
  try {
    const { version, versionCode } = req.query;
    
    console.log('🔍 [update/check] Verificando atualizações...', {
      version,
      versionCode,
      query: req.query
    });
    
    const prisma = getPrisma();
    if (!prisma) {
      console.error('❌ [update/check] Database not available');
      return res.status(503).json({
        error: 'Database not available'
      });
    }

    // Buscar a versão mais recente ativa
    const latestVersion = await prisma.appVersion.findFirst({
      where: {
        isActive: true,
        platform: 'android'
      },
      orderBy: {
        versionCode: 'desc'
      }
    });

    console.log('📦 [update/check] Versão mais recente no banco:', latestVersion ? {
      id: latestVersion.id,
      version: latestVersion.version,
      versionCode: latestVersion.versionCode,
      isActive: latestVersion.isActive,
      apkUrl: latestVersion.apkUrl
    } : 'Nenhuma versão encontrada');

    if (!latestVersion) {
      console.log('ℹ️ [update/check] Nenhuma versão ativa encontrada');
      return res.json({
        hasUpdate: false,
        message: 'Nenhuma versão disponível'
      });
    }

    const currentVersionCode = versionCode ? parseInt(versionCode as string, 10) : 0;
    const hasUpdate = latestVersion.versionCode > currentVersionCode;
    
    console.log('🔍 [update/check] Comparação:', {
      currentVersionCode,
      latestVersionCode: latestVersion.versionCode,
      hasUpdate,
      currentVersion: version,
      latestVersion: latestVersion.version
    });

    // Se apkUrl for uma URL do GitHub Release, usar diretamente
    // Caso contrário, usar o endpoint de download
    let apkUrl = null;
    if (hasUpdate && latestVersion.apkUrl) {
      if (latestVersion.apkUrl.startsWith('https://github.com/') || 
          latestVersion.apkUrl.startsWith('https://github-releases')) {
        // URL direta do GitHub Release
        apkUrl = latestVersion.apkUrl;
      } else {
        // URL relativa - construir URL do endpoint
        apkUrl = `/api/app/update/apk/${latestVersion.id}`;
      }
    }

    const responseData = {
      hasUpdate,
      latestVersion: hasUpdate ? {
        version: latestVersion.version,
        versionCode: latestVersion.versionCode,
        releaseNotes: latestVersion.releaseNotes,
        isMandatory: latestVersion.isMandatory,
        apkSize: latestVersion.apkSize,
        apkUrl: apkUrl, // URL direta para download
        versionId: latestVersion.id
      } : null
    };
    
    console.log('📤 [update/check] Enviando resposta:', JSON.stringify(responseData, null, 2));
    res.json(responseData);
  } catch (error: any) {
    console.error('❌ Erro ao verificar atualizações:', error);
    res.status(500).json({
      error: 'Erro ao verificar atualizações',
      message: error.message
    });
  }
});

// Endpoint para baixar APK diretamente do servidor
router.get('/update/apk/:versionId', async (req: Request, res: Response) => {
  try {
    const { versionId } = req.params;
    
    const prisma = getPrisma();
    if (!prisma) {
      return res.status(503).json({
        error: 'Database not available'
      });
    }

    // Buscar a versão no banco
    const version = await prisma.appVersion.findUnique({
      where: { id: versionId }
    });

    if (!version) {
      return res.status(404).json({
        error: 'Versão não encontrada'
      });
    }

    // Verificar se tem apkUrl configurado
    if (!version.apkUrl) {
      return res.status(404).json({
        error: 'APK não disponível para esta versão'
      });
    }

    // Se apkUrl for um caminho relativo (arquivo local), servir do servidor
    // Se for URL externa, redirecionar
    if (version.apkUrl.startsWith('http://') || version.apkUrl.startsWith('https://')) {
      // URL externa - redirecionar
      return res.redirect(version.apkUrl);
    }

    // Caminho local - construir caminho completo
    // APKs devem estar em backend/uploads/apks/
    const projectRoot = path.resolve(__dirname, '../../..');
    
    // Se apkUrl já for um caminho absoluto ou relativo ao projeto, usar direto
    // Caso contrário, assumir que está em uploads/apks/
    let apkPath;
    if (version.apkUrl.startsWith('/') || version.apkUrl.includes('..')) {
      // Caminho absoluto ou com .. - usar com cuidado
      apkPath = path.resolve(projectRoot, version.apkUrl.replace(/^\/+/, ''));
    } else if (version.apkUrl.startsWith('uploads/apks/') || version.apkUrl.startsWith('backend/uploads/apks/')) {
      // Já está no formato correto
      apkPath = path.resolve(projectRoot, version.apkUrl);
    } else {
      // Assumir que está em uploads/apks/
      apkPath = path.resolve(projectRoot, 'backend/uploads/apks', version.apkUrl);
    }

    // Verificar se arquivo existe
    try {
      await fs.access(apkPath);
    } catch {
      return res.status(404).json({
        error: 'Arquivo APK não encontrado no servidor',
        path: apkPath
      });
    }

    // Obter informações do arquivo
    const stats = await fs.stat(apkPath);
    
    // Configurar headers para download
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="liga-do-bem-${version.version}.apk"`);
    res.setHeader('Content-Length', stats.size);
    
    // Ler e enviar arquivo
    const fileBuffer = await fs.readFile(apkPath);
    res.send(fileBuffer);

  } catch (error: any) {
    console.error('❌ Erro ao servir APK:', error);
    res.status(500).json({
      error: 'Erro ao servir APK',
      message: error.message
    });
  }
});

export default router;

