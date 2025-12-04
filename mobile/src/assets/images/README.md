# Logo da Liga do Bem

Para adicionar o logo da aplicação:

## Opção 1: Asset Local (Recomendado)

1. Coloque o arquivo do logo nesta pasta (`mobile/src/assets/images/`)
2. Nomeie o arquivo como `logo.png` (ou `logo.jpg`)
3. Edite `mobile/src/config/appConfig.js` e descomente a linha:
   ```javascript
   logoLocal: require('../../assets/images/logo.png'),
   ```
4. Comente ou remova a linha `logoUrl`

## Opção 2: URL Externa

1. Hospede o logo em um serviço de hospedagem de imagens (Imgur, Cloudinary, etc.)
2. Edite `mobile/src/config/appConfig.js` e adicione a URL:
   ```javascript
   logoUrl: 'https://exemplo.com/logo.png',
   ```
3. Comente ou remova a linha `logoLocal`

## Tamanho Recomendado

- Largura: ~200-250px
- Altura: ~50-60px
- Formato: PNG com fundo transparente (preferível) ou JPG
- Resolução: Mínimo 2x para telas Retina

