/**
 * Testes.gs — testes automáticos do parser (não mexem na planilha nem no Telegram).
 * Rode testarTodos() no editor e veja o resultado em "Registro de execução".
 * As datas esperadas consideram "hoje" = 10/11/2026 (data fixa só para o teste).
 */

var DATA_BASE_TESTE = new Date(2026, 10, 10); // 10/11/2026

// [texto, {campos esperados}] — origem null = o bot deve perguntar Salão/Pessoal
var CASOS_TEXTO = [
  ['luz 320,50 venc 15/12 salão', { valor: 320.5, categoria: 'Energia', origem: 'Salão', vencimento: '15/12/2026', descricao: 'Luz' }],
  ['manutenção secador 150', { valor: 150, categoria: 'Manutenção', origem: 'Salão', vencimento: null }],
  ['mercado 230 casa', { valor: 230, categoria: 'Mercado', origem: 'Pessoal' }],
  ['compra refrigerante 89,90', { valor: 89.9, categoria: 'Insumos', origem: 'Salão' }],
  ['luz 412 salão', { valor: 412, categoria: 'Energia', origem: 'Salão' }],
  ['luz 230 casa', { valor: 230, categoria: 'Energia', origem: 'Pessoal' }],
  ['aluguel 2000 salão', { valor: 2000, categoria: 'Aluguel', origem: 'Salão' }],
  ['aluguel 1500 casa', { valor: 1500, categoria: 'Moradia', origem: 'Pessoal' }],
  ['aluguel 2000', { valor: 2000, origem: null }],
  ['internet 99,90', { valor: 99.9, categoria: 'Internet/Telefone', origem: null }],
  ['água 1.234,56 venc 05/01', { valor: 1234.56, categoria: 'Água', origem: null, vencimento: '05/01/2027' }],
  ['gasolina R$ 150 pago', { valor: 150, categoria: 'Transporte', origem: 'Pessoal', status: 'pago' }],
  ['shampoo 2 frascos 89.90', { valor: 89.9, categoria: 'Insumos', origem: 'Salão' }],
  ['conta de luz da casa 180 vence dia 20', { valor: 180, categoria: 'Energia', origem: 'Pessoal', vencimento: '20/11/2026', descricao: 'Conta de luz' }],
  ['farmácia 45,7', { valor: 45.7, categoria: 'Saúde', origem: 'Pessoal' }],
  ['das mei 75,90 venc 20/11', { valor: 75.9, categoria: 'Impostos/Taxas', origem: 'Salão', vencimento: '20/11/2026' }],
  ['filtro ar condicionado 80 loja', { valor: 80, categoria: 'Manutenção', origem: 'Salão' }],
  ['padaria 12', { valor: 12, categoria: 'Mercado', origem: 'Pessoal' }],
  ['presente aniversário 100', { valor: 100, categoria: null, origem: null }],
  ['luz', { valor: null, categoria: 'Energia' }],
  ['detergente e desinfetante 35,00 a pagar', { valor: 35, categoria: 'Limpeza', origem: 'Salão', status: 'pendente' }],
  ['agua mineral 20', { valor: 20, categoria: 'Insumos', origem: 'Salão' }],
  ['conserto geladeira 300 casa', { valor: 300, categoria: 'Outros pessoais', origem: 'Pessoal' }],
  ['aluguel 2.500 venc 10/12 salão', { valor: 2500, categoria: 'Aluguel', origem: 'Salão', vencimento: '10/12/2026' }],
  ['esmaltes 64,50 em 08/11', { valor: 64.5, categoria: 'Insumos', origem: 'Salão', dataGasto: '08/11/2026' }],
  ['telefone celular 59,99 minha', { valor: 59.99, categoria: 'Internet/Telefone', origem: 'Pessoal' }]
];

// Textos parecidos com o que o OCR devolve
var CASOS_OCR = [
  ['ENEL DISTRIBUIÇÃO SÃO PAULO\nCNPJ 61.695.227/0001-93\nNOTA FISCAL / CONTA DE ENERGIA ELÉTRICA\n' +
    'Consumo kWh 245\nEmissão 01/11/2026\nVencimento\n15/12/2026\nTotal a pagar\nR$ 312,45',
    { valor: 312.45, vencimento: '15/12/2026', empresa: 'ENEL DISTRIBUIÇÃO SÃO PAULO', categoria: 'Energia' }],
  ['Banco Itaú\nLocal de pagamento: Pagável em qualquer banco até o vencimento\nVencimento 10/12/2026\n' +
    'Beneficiário: IMOBILIARIA BOA VISTA LTDA\nValor do documento 2.000,00\nAluguel referente a 12/2026',
    { valor: 2000, vencimento: '10/12/2026', categoria: 'Aluguel' }],
  ['SUPERMERCADO BOM PRECO LTDA\nCNPJ: 12.345.678/0001-90\n10/11/2026 14:32\nARROZ 5KG 25,90\nFEIJAO 1KG 8,45\n' +
    'Subtotal 34,35\nTOTAL R$ 34,35',
    { valor: 34.35, vencimento: null, empresa: 'SUPERMERCADO BOM PRECO LTDA', categoria: 'Mercado' }],
  ['SABESP - Cia de Saneamento Básico\nData de vencimento: 20/11/2026\nConsumo de água m3 12\nValor a pagar R$ 98,10',
    { valor: 98.1, vencimento: '20/11/2026', categoria: 'Água' }],
  ['Foto borrada sem números legíveis\nobrigado pela preferência',
    { valor: null, vencimento: null }]
];

/** Roda todos os casos. Devolve {ok, falhas}. */
function testarTodos() {
  var cats = montarCategorias(CATEGORIAS_PADRAO);
  var ok = 0, falhas = [];

  function comparar(nome, obtido, esperado) {
    var erros = [];
    Object.keys(esperado).forEach(function (k) {
      var o = obtido[k];
      if (o instanceof Date) o = fmtData(o);
      if (o === undefined) o = null;
      if (o !== esperado[k]) erros.push(k + ': esperado ' + JSON.stringify(esperado[k]) + ', veio ' + JSON.stringify(o));
    });
    if (erros.length) falhas.push('✗ ' + nome + ' → ' + erros.join('; '));
    else ok++;
  }

  CASOS_TEXTO.forEach(function (c) {
    comparar('"' + c[0] + '"', interpretarTexto(c[0], cats, true, DATA_BASE_TESTE), c[1]);
  });
  CASOS_OCR.forEach(function (c, i) {
    var dados = extrairDadosOcr(c[0], DATA_BASE_TESTE);
    var cls = resolverCategoriaEOrigem(c[0], null, cats, true);
    dados.categoria = cls.categoria;
    comparar('OCR #' + (i + 1), dados, c[1]);
  });

  var resumo = ok + ' de ' + (ok + falhas.length) + ' testes passaram.';
  console.log(resumo + (falhas.length ? '\n' + falhas.join('\n') : ''));
  return { ok: ok, falhas: falhas };
}
