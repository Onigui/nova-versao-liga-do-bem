import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { getPrisma } from '../utils/prisma';

const router = Router();

// Endpoint para verificar atualizações (já existe, mas vamos garantir que está correto)
router.get('/update/check', async (req: Request, res: Response) => {
  try {
    const { version, versionCode } = req.query;
    
    const prisma = getPrisma();
    if (!prisma) {
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

    if (!latestVersion) {
      return res.json({
        hasUpdate: false,
        message: 'Nenhuma versão disponível'
      });
    }

    const currentVersionCode = versionCode ? parseInt(versionCode as string, 10) : 0;
    const hasUpdate = latestVersion.versionCode > currentVersionCode;

    res.json({
      hasUpdate,
      latestVersion: hasUpdate ? {
        version: latestVersion.version,
        versionCode: latestVersion.versionCode,
        releaseNotes: latestVersion.releaseNotes,
        isMandatory: latestVersion.isMandatory,
        apkSize: latestVersion.apkSize,
        // Não retornar apkUrl - o app vai buscar via /api/app/update/apk/:versionId
        versionId: latestVersion.id
      } : null
    });
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
    // APKs devem estar em uma pasta uploads/apks/ ou web/downloads/
    const projectRoot = path.resolve(__dirname, '../../..');
    const apkPath = path.resolve(projectRoot, version.apkUrl);

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

