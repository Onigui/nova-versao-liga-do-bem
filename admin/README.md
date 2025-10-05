# 🛠️ Painel Administrativo - Liga do Bem Botucatu

## 📋 **Visão Geral**

Painel administrativo completo para gerenciar toda a plataforma da Liga do Bem, incluindo empresas parceiras, membros, descontos, localizações e relatórios.

## 🚀 **Funcionalidades Implementadas**

### 📊 **Dashboard**
- **Visão geral** da plataforma com métricas em tempo real
- **Cards de estatísticas** com crescimento mensal
- **Tabela de empresas recentes** com status e ações
- **Indicadores visuais** de performance

### 🏢 **Gestão de Empresas Parceiras**
- **Cadastro completo** de empresas com:
  - Nome, categoria e descrição
  - Percentual de desconto oferecido
  - Endereço completo
  - **Coordenadas GPS** (latitude/longitude)
  - **Horários de funcionamento** detalhados
  - Telefone e email de contato
  - Status (Ativo/Pendente/Inativo)

- **Funcionalidades de gestão:**
  - ✅ Aprovar/rejeitar empresas
  - ✅ Editar informações
  - ✅ Visualizar localização no mapa
  - ✅ Configurar descontos específicos
  - ✅ Gerenciar horários de atendimento

### 👥 **Gestão de Membros**
- **Cadastro de membros** com:
  - Dados pessoais completos
  - Informações de contato
  - Sistema de pontuação
  - Status de ativação

- **Funcionalidades:**
  - ✅ Cadastrar novos membros
  - ✅ Editar informações
  - ✅ Gerenciar pontos e benefícios
  - ✅ Ativar/desativar contas

### 📍 **Localização e GPS**
- **Coordenadas precisas** para cada empresa
- **Integração com mapas** para navegação
- **Validação de localização** no cadastro
- **Suporte a múltiplos endereços**

### ⏰ **Horários de Funcionamento**
- **Configuração flexível** de horários
- **Suporte a horários especiais** (feriados, eventos)
- **Status de abertura/fechamento** em tempo real
- **Notificações automáticas** de mudanças

## 🎨 **Design e Interface**

### ✨ **Características Visuais**
- **Design moderno** inspirado em bancos digitais
- **Cores premium** (roxo, rosa, azul, verde)
- **Gradientes sofisticados** e glassmorphism
- **Animações suaves** e transições elegantes
- **Interface responsiva** para desktop e mobile

### 🔧 **Componentes**
- **Sidebar de navegação** com ícones intuitivos
- **Cards de métricas** com indicadores visuais
- **Tabelas interativas** com ações contextuais
- **Modais elegantes** para formulários
- **Status badges** coloridos
- **Botões com hover effects**

## 📱 **Acesso ao Painel**

### 🌐 **URL de Acesso**
```
https://nova-versao-liga-do-bem-admin.onrender.com
```

### 🔐 **Autenticação**
- Sistema de login seguro
- Controle de acesso por perfil
- Sessões protegidas
- Logs de auditoria

## 🛠️ **Tecnologias Utilizadas**

- **HTML5** semântico e acessível
- **CSS3** moderno com variáveis customizadas
- **JavaScript ES6+** para interatividade
- **Font Inter** para tipografia profissional
- **Gradientes CSS** para efeitos visuais
- **Flexbox/Grid** para layouts responsivos

## 📊 **Métricas Disponíveis**

### 📈 **Dashboard Principal**
- **Empresas Parceiras:** Total e crescimento mensal
- **Membros Ativos:** Usuários cadastrados e engajamento
- **Descontos Utilizados:** Uso das promoções
- **QR Codes Escaneados:** Interações com o app

### 📋 **Relatórios Detalhados**
- Performance por empresa
- Análise de membros por região
- Uso de descontos por categoria
- Tendências temporais

## 🔄 **Integração com Backend**

### 🔗 **APIs Utilizadas**
- **GET /admin/companies** - Listar empresas
- **POST /admin/companies** - Cadastrar empresa
- **PUT /admin/companies/:id** - Atualizar empresa
- **GET /admin/members** - Listar membros
- **POST /admin/members** - Cadastrar membro
- **GET /admin/stats** - Estatísticas gerais

### 📡 **Comunicação**
- **REST API** com JSON
- **Autenticação JWT** para segurança
- **Validação de dados** no frontend e backend
- **Feedback visual** para todas as operações

## 🚀 **Próximas Funcionalidades**

### ⏳ **Em Desenvolvimento**
- **Configuração de Descontos:** Gestão avançada de promoções
- **Relatórios e Analytics:** Dashboards detalhados
- **Configurações Gerais:** Parâmetros da plataforma
- **Sistema de Notificações:** Push notifications
- **Exportação de Dados:** Relatórios em PDF/Excel

### 🎯 **Funcionalidades Planejadas**
- **Mapa interativo** com localização das empresas
- **Sistema de aprovação** em workflow
- **Histórico de alterações** com auditoria
- **Templates de email** personalizáveis
- **Integração com redes sociais**

## 📝 **Como Usar**

### 1. **Acessar o Painel**
- Abra a URL do painel administrativo
- Faça login com suas credenciais
- Navegue pelas seções usando a sidebar

### 2. **Cadastrar Empresa**
- Clique em "Empresas Parceiras"
- Clique em "Cadastrar Empresa"
- Preencha todos os campos obrigatórios
- **Importante:** Configure latitude/longitude para GPS
- Defina horários de funcionamento
- Salve e aguarde aprovação

### 3. **Gerenciar Membros**
- Acesse a seção "Membros"
- Cadastre novos usuários
- Edite informações existentes
- Gerencie pontos e benefícios

### 4. **Configurar Localização**
- No cadastro da empresa, insira:
  - **Endereço completo**
  - **Latitude** (ex: -22.8859)
  - **Longitude** (ex: -48.4439)
  - **Horários de funcionamento**

## 🔧 **Configuração de Deploy**

### 📁 **Estrutura de Arquivos**
```
admin/
├── index.html          # Painel principal
├── README.md           # Documentação
└── assets/             # Recursos (futuro)
    ├── css/
    ├── js/
    └── images/
```

### 🚀 **Deploy no Render**
- **Tipo:** Static Site
- **Build Command:** (vazio)
- **Publish Directory:** `admin`
- **Root Directory:** (vazio)

---

## 📞 **Suporte**

Para dúvidas ou sugestões sobre o painel administrativo:
- **Email:** contato@ligadobembotucatu.org.br
- **Telefone:** (14) 99999-9999

---

**🎯 Status:** ✅ **Funcionalidades principais implementadas**  
**🔄 Próximo:** Configuração de descontos e relatórios avançados
