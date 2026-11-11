/**
 * Sheets.gs — leitura e gravação na planilha (o "banco de dados").
 */

var _cacheExec = {}; // cache só durante esta execução (evita ler a mesma aba várias vezes)
var _temLock = false;

function planilha_() {
  if (_cacheExec.ss) return _cacheExec.ss;
  var id = prop_('SPREADSHEET_ID');
  _cacheExec.ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!_cacheExec.ss) throw new Error('Planilha não encontrada. Rode setup() primeiro.');
  return _cacheExec.ss;
}

function aba_(nome) {
  var sh = planilha_().getSheetByName(nome);
  if (!sh) throw new Error('Aba "' + nome + '" não existe. Rode setup().');
  return sh;
}

/** Executa fn com trava global, para nunca gravar duas coisas ao mesmo tempo. */
function comLock_(fn) {
  if (_temLock) return fn();
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  _temLock = true;
  try {
    return fn();
  } finally {
    _temLock = false;
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

/* ===================== Config ===================== */

var CONFIG_PADRAO = [
  ['chat_ids_autorizados', '', 'IDs do Telegram que podem usar o bot, separados por vírgula'],
  ['dias_alerta_vencimento', '3,1,0', 'Avisar quantos dias antes do vencimento (0 = no dia)'],
  ['dias_proximos_vencimentos', 15, 'Quantos dias o comando /vencimentos mostra'],
  ['dias_alerta_manutencao', 3, 'Avisar manutenções com quantos dias de antecedência'],
  ['percentual_anomalia', 25, 'Avisar quando um gasto ficar X% acima da média de 3 meses'],
  ['deduzir_origem_pela_categoria', 'sim', 'sim = Mercado já vira Pessoal, Insumos já vira Salão; não = sempre perguntar'],
  ['usar_gemini', 'não', 'sim = usa o Gemini quando o OCR não achar o valor (precisa de GEMINI_API_KEY)'],
  ['hora_alerta', 8, 'Hora do alerta diário (rode setup() de novo após mudar)'],
  ['pasta_drive_id', '', 'Preenchido pelo setup(): pasta onde as fotos ficam']
];

function lerConfig_() {
  if (_cacheExec.config) return _cacheExec.config;
  var cfg = {};
  CONFIG_PADRAO.forEach(function (l) { cfg[l[0]] = l[1]; });
  var dados = aba_(ABA.CONFIG).getDataRange().getValues();
  for (var i = 1; i < dados.length; i++) {
    if (dados[i][0]) cfg[String(dados[i][0]).trim()] = dados[i][1];
  }
  cfg.chats = String(cfg.chat_ids_autorizados || '').split(/[,;\s]+/).filter(String);
  cfg.diasAlerta = String(cfg.dias_alerta_vencimento).split(/[,;\s]+/)
    .filter(String).map(Number).filter(function (n) { return !isNaN(n); });
  cfg.diasProximos = Number(cfg.dias_proximos_vencimentos) || 15;
  cfg.diasManut = Number(cfg.dias_alerta_manutencao) || 3;
  cfg.pctAnomalia = Number(cfg.percentual_anomalia) || 25;
  cfg.deduzir = normalizar(cfg.deduzir_origem_pela_categoria) !== 'nao';
  cfg.gemini = normalizar(cfg.usar_gemini) === 'sim';
  _cacheExec.config = cfg;
  return cfg;
}

function salvarConfig_(chave, valor) {
  var sh = aba_(ABA.CONFIG);
  var dados = sh.getDataRange().getValues();
  for (var i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).trim() === chave) {
      sh.getRange(i + 1, 2).setValue(valor);
      delete _cacheExec.config;
      return;
    }
  }
  sh.appendRow([chave, valor, '']);
  delete _cacheExec.config;
}

/* ===================== Categorias ===================== */

/** Lista de categorias: [{nome, tipo, palavras:[...]}]. Usa o padrão se a aba estiver vazia. */
function lerCategorias_() {
  if (_cacheExec.categorias) return _cacheExec.categorias;
  var linhas = [];
  try {
    linhas = aba_(ABA.CAT).getDataRange().getValues().slice(1).filter(function (l) { return l[0]; });
  } catch (e) { linhas = []; }
  if (!linhas.length) linhas = CATEGORIAS_PADRAO;
  _cacheExec.categorias = montarCategorias(linhas);
  return _cacheExec.categorias;
}

/* ===================== Lançamentos ===================== */

function linhaParaLanc_(l, numLinha) {
  return {
    linha: numLinha,
    id: Number(l[COL.ID]),
    dataRegistro: l[COL.DATA_REGISTRO],
    dataGasto: l[COL.DATA_GASTO] || null,
    vencimento: l[COL.VENCIMENTO] || null,
    valor: Number(l[COL.VALOR]) || 0,
    categoria: String(l[COL.CATEGORIA] || ''),
    origem: String(l[COL.ORIGEM] || ''),
    descricao: String(l[COL.DESCRICAO] || ''),
    entrada: String(l[COL.ENTRADA] || ''),
    status: String(l[COL.STATUS] || ''),
    dataPagamento: l[COL.DATA_PAGAMENTO] || null,
    linkFoto: String(l[COL.LINK_FOTO] || ''),
    mesRef: Number(l[COL.MES_REF]) || 0
  };
}

/** Todos os lançamentos da planilha (lidos uma vez por execução). */
function listarLancamentos_() {
  if (_cacheExec.lancs) return _cacheExec.lancs;
  var dados = aba_(ABA.LANC).getDataRange().getValues();
  var lista = [];
  for (var i = 1; i < dados.length; i++) {
    if (dados[i][COL.ID] === '' || dados[i][COL.ID] == null) continue;
    var l = linhaParaLanc_(dados[i], i + 1);
    // Corrige mes_referencia se alguém digitou direto na planilha e deixou em branco
    if (!l.mesRef) {
      var base = l.vencimento || l.dataGasto || l.dataRegistro;
      if (base) l.mesRef = mesRef(base);
    }
    lista.push(l);
  }
  _cacheExec.lancs = lista;
  return lista;
}

function invalidarLancs_() { delete _cacheExec.lancs; }

function buscarLancamento_(id) {
  id = Number(id);
  return listarLancamentos_().filter(function (l) { return l.id === id; })[0] || null;
}

function lancParaLinha_(o) {
  var l = new Array(CABECALHO_LANC.length);
  l[COL.ID] = o.id;
  l[COL.DATA_REGISTRO] = o.dataRegistro || new Date();
  l[COL.DATA_GASTO] = o.dataGasto ? soData(o.dataGasto) : '';
  l[COL.VENCIMENTO] = o.vencimento ? soData(o.vencimento) : '';
  l[COL.VALOR] = Number(o.valor) || 0;
  l[COL.CATEGORIA] = o.categoria || '';
  l[COL.ORIGEM] = o.origem || '';
  l[COL.DESCRICAO] = o.descricao || '';
  l[COL.ENTRADA] = o.entrada || '';
  l[COL.STATUS] = o.status || 'pendente';
  l[COL.DATA_PAGAMENTO] = o.dataPagamento ? soData(o.dataPagamento) : '';
  l[COL.LINK_FOTO] = o.linkFoto || '';
  l[COL.MES_REF] = o.mesRef || mesRef(o.vencimento || o.dataGasto || new Date());
  return l;
}

/** Grava um novo lançamento e devolve o id gerado. */
function gravarLancamento_(o) {
  return comLock_(function () {
    invalidarLancs_();
    // Nunca reaproveita um número, mesmo após /desfazer (botões antigos continuam seguros)
    var props = PropertiesService.getScriptProperties();
    var maior = Number(props.getProperty('ULTIMO_ID')) || 0;
    listarLancamentos_().forEach(function (l) { if (l.id > maior) maior = l.id; });
    o.id = maior + 1;
    props.setProperty('ULTIMO_ID', String(o.id));
    o.dataRegistro = new Date();
    aba_(ABA.LANC).appendRow(lancParaLinha_(o));
    invalidarLancs_();
    return o.id;
  });
}

/** Regrava um lançamento existente (o objeto precisa ter .linha). */
function atualizarLancamento_(o) {
  return comLock_(function () {
    aba_(ABA.LANC).getRange(o.linha, 1, 1, CABECALHO_LANC.length).setValues([lancParaLinha_(o)]);
    invalidarLancs_();
  });
}

/** Marca como pago. Devolve o lançamento, ou null se não existir. */
function marcarPago_(id) {
  return comLock_(function () {
    invalidarLancs_();
    var l = buscarLancamento_(id);
    if (!l) return null;
    if (l.status !== 'pago') {
      l.status = 'pago';
      l.dataPagamento = hoje();
      atualizarLancamento_(l);
      l.jaEstavaPago = false;
    } else {
      l.jaEstavaPago = true;
    }
    return l;
  });
}

/** Apaga o lançamento com o maior id (o último registrado). */
function excluirUltimoLancamento_() {
  return comLock_(function () {
    invalidarLancs_();
    var lista = listarLancamentos_();
    if (!lista.length) return null;
    var ultimo = lista.reduce(function (a, b) { return b.id > a.id ? b : a; });
    aba_(ABA.LANC).deleteRow(ultimo.linha);
    invalidarLancs_();
    return ultimo;
  });
}

function pendentes_() {
  return listarLancamentos_().filter(function (l) { return l.status !== 'pago'; });
}

/** Soma por categoria+origem num mês. */
function somaMes_(ref, categoria, origem) {
  var total = 0, qtd = 0;
  listarLancamentos_().forEach(function (l) {
    if (l.mesRef === ref && (!categoria || l.categoria === categoria) && (!origem || l.origem === origem)) {
      total += l.valor; qtd++;
    }
  });
  return { total: total, qtd: qtd };
}

/* ===================== Contas fixas ===================== */

function lerContasFixas_() {
  var dados = aba_(ABA.FIXAS).getDataRange().getValues().slice(1);
  return dados.filter(function (l) { return l[0] && l[3]; }).map(function (l) {
    return {
      nome: String(l[0]).trim(),
      categoria: String(l[1] || '').trim(),
      origem: String(l[2] || '').trim(),
      dia: Number(l[3]),
      valor: Number(l[4]) || 0
    };
  });
}

/**
 * Cria, como "pendente", o lançamento das contas fixas do mês atual
 * (e do próximo, se o vencimento já estiver na janela de alertas).
 * Não cria de novo se já existir lançamento dessa conta no mês.
 */
function gerarContasFixas_() {
  var fixas = lerContasFixas_();
  if (!fixas.length) return 0;
  var cfg = lerConfig_();
  var h = hoje();
  var refs = [mesRef(h)];
  var refFutura = mesRef(addDias(h, cfg.diasProximos));
  if (refs.indexOf(refFutura) < 0) refs.push(refFutura);

  // Quantas fixas existem por categoria+origem (para saber se dá para casar só pela categoria)
  var contagem = {};
  fixas.forEach(function (f) { var k = f.categoria + '|' + f.origem; contagem[k] = (contagem[k] || 0) + 1; });

  var criadas = 0;
  comLock_(function () {
    invalidarLancs_();
    var lancs = listarLancamentos_();
    fixas.forEach(function (f) {
      if (!f.dia || f.dia < 1 || f.dia > 31) return;
      refs.forEach(function (ref) {
        var ano = Math.floor(ref / 100), mes = ref % 100;
        var venc = new Date(ano, mes - 1, Math.min(f.dia, ultimoDiaDoMes(ano, mes)));
        if (venc < h) return; // não cria conta que já venceu (evita alerta falso no 1º mês)
        var existe = lancs.some(function (l) {
          if (l.mesRef !== ref) return false;
          if (normalizar(l.descricao) === normalizar(f.nome)) return true;
          return contagem[f.categoria + '|' + f.origem] === 1 &&
            l.categoria === f.categoria && l.origem === f.origem;
        });
        if (existe) return;
        gravarLancamento_({
          dataGasto: venc, vencimento: venc, valor: f.valor, categoria: f.categoria,
          origem: f.origem, descricao: f.nome, entrada: 'fixa', status: 'pendente', mesRef: ref
        });
        lancs = listarLancamentos_();
        criadas++;
      });
    });
  });
  return criadas;
}

/** Procura lançamento de conta fixa pendente que corresponda a um novo registro. */
function acharFixaPendente_(categoria, origem, ref, texto) {
  var candidatos = listarLancamentos_().filter(function (l) {
    return l.entrada === 'fixa' && l.status !== 'pago' && l.mesRef === ref &&
      l.categoria === categoria && l.origem === origem;
  });
  if (!candidatos.length) return null;
  var t = normalizar(texto);
  var porNome = candidatos.filter(function (l) { return t.indexOf(normalizar(l.descricao)) >= 0; })[0];
  return porNome || candidatos[0];
}

/* ===================== Manutenções ===================== */

function lerManutencoes_() {
  var dados = aba_(ABA.MANUT).getDataRange().getValues();
  var lista = [];
  for (var i = 1; i < dados.length; i++) {
    if (!dados[i][0]) continue;
    lista.push({
      linha: i + 1,
      equipamento: String(dados[i][0]),
      periodicidade: Number(dados[i][1]) || 0,
      ultima: dados[i][2] || null,
      proxima: dados[i][3] || null
    });
  }
  return lista;
}

/** Registra que a manutenção foi feita hoje e recalcula a próxima data. */
function registrarManutencaoFeita_(linha) {
  return comLock_(function () {
    var sh = aba_(ABA.MANUT);
    sh.getRange(linha, 3).setValue(hoje());
    sh.getRange(linha, 4).setFormula('=IF(C' + linha + '="","",C' + linha + '+B' + linha + ')');
    SpreadsheetApp.flush();
    return lerManutencoes_().filter(function (m) { return m.linha === linha; })[0];
  });
}

/* ===================== Log ===================== */

function registrarLog_(tipo, detalhe) {
  try {
    aba_(ABA.LOG).appendRow([new Date(), tipo, String(detalhe).slice(0, 2000)]);
  } catch (e) {
    console.error('Falha ao gravar Log: ' + e + ' | ' + tipo + ': ' + detalhe);
  }
}

function registrarErro_(onde, err) {
  var msg = (err && err.stack) ? err.stack : String(err);
  console.error(onde + ': ' + msg);
  registrarLog_('erro', onde + ': ' + msg);
}

/** Mantém o Log com no máximo ~2000 linhas. */
function limparLog_() {
  var sh = aba_(ABA.LOG);
  var total = sh.getLastRow();
  if (total > 3000) sh.deleteRows(2, total - 2001);
}
