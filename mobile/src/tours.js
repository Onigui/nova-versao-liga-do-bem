/**
 * Textos das dicas de primeira vez. Curtos de propósito: uma frase por dica, no máximo 3 por tela.
 * Para mostrar uma dica de novo a todos depois de mudar a tela, troque o "@1" por "@2".
 */
export const TOURS = {
  home: {
    id: 'home@1',
    steps: [
      {id: 'carteirinha', title: 'Sua carteirinha', text: 'Toque em "Mostrar QR" no caixa do parceiro para ganhar o desconto.'},
      {id: 'convite', title: 'Seja membro', text: 'Veja os planos e comece a economizar nos parceiros da Liga.'},
      {id: 'atalhos', title: 'Atalhos', text: 'Os serviços que você mais usa. Em "Ver tudo" estão todos os outros.'},
      {id: 'avisos', title: 'Seus avisos', text: 'Respostas de orçamento, lembretes de vacina e novidades chegam aqui.'},
    ],
  },
  card: {
    id: 'card@1',
    steps: [
      {id: 'qr', title: 'QR da carteirinha', text: 'Mostre no caixa. Ele muda sozinho a cada poucos minutos, então print não vale.'},
      {id: 'codigo', title: 'Código de 6 números', text: 'Se a câmera do parceiro não ler o QR, ele digita este código.'},
    ],
  },
  partners: {
    id: 'partners@1',
    steps: [
      {id: 'busca', title: 'Busque parceiros', text: 'Pelo nome, serviço ou bairro.'},
      {id: 'comparar', title: 'Compare preços', text: 'Veja quanto cada parceiro cobra pelo mesmo produto ou serviço.'},
      {id: 'perto', title: 'Perto de você', text: 'Mostra primeiro os parceiros mais próximos.'},
    ],
  },
  quote: {
    id: 'quote@1',
    steps: [
      {id: 'lista', title: 'Monte sua lista', text: 'Adicione produtos ou serviços. Cada loja manda o preço sem ver as outras.'},
      {id: 'receita', title: 'Tem receita?', text: 'Tire uma foto: a loja confere o remédio e a dose certa.'},
    ],
  },
  lostfound: {
    id: 'lostfound@1',
    steps: [
      {id: 'publicar', title: 'Perdeu ou achou um animal?', text: 'Publique com foto e local. Se já houver um aviso do mesmo animal, você só adiciona o avistamento.'},
      {id: 'alertas', title: 'Alertas por perto', text: 'Ative para saber quando um animal for perdido ou encontrado perto de você.'},
      {id: 'meus', title: 'Seus avisos', text: 'Acompanhe, renove ou encerre o que você publicou.'},
    ],
  },
  pets: {
    id: 'pets@1',
    steps: [
      {id: 'adicionar', title: 'Cadastre seu pet', text: 'Assim você guarda as vacinas e o histórico de saúde num lugar só.'},
      {id: 'carteira', title: 'Carteira de vacinação', text: 'Toque no pet para ver as vacinas e quando vence a próxima dose.'},
    ],
  },
  partnerValidate: {
    id: 'p.validate@1',
    steps: [
      {id: 'escanear', title: 'Validar a carteirinha', text: 'Escaneie o QR do membro no caixa para aplicar o desconto.'},
      {id: 'orcamentos', title: 'Pedidos de orçamento', text: 'Membros pedem preço aqui. Responder rápido ajuda a fechar a venda.'},
      {id: 'codigo', title: 'A câmera não leu?', text: 'Digite o código de 6 números que aparece no app do membro.'},
    ],
  },
  partnerPush: {
    id: 'p.push@1',
    steps: [{id: 'titulo', title: 'Notifique os membros', text: 'Escreva uma promoção curta. A Liga confere e envia no horário que você escolher.'}],
  },
};
