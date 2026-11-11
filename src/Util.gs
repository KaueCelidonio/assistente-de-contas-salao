/**
 * Util.gs — constantes e funções auxiliares usadas por todos os arquivos.
 */

var TZ = 'America/Sao_Paulo';

// Nomes das abas da planilha
var ABA = {
  LANC: 'Lançamentos',
  CAT: 'Categorias',
  FIXAS: 'ContasFixas',
  MANUT: 'Manutenções',
  PAINEL: 'Painel',
  CONFIG: 'Config',
  LOG: 'Log'
};

var ORIGEM = { SALAO: 'Salão', PESSOAL: 'Pessoal' };

// Colunas da aba Lançamentos (índice começando em 0)
var COL = {
  ID: 0, DATA_REGISTRO: 1, DATA_GASTO: 2, VENCIMENTO: 3, VALOR: 4, CATEGORIA: 5,
  ORIGEM: 6, DESCRICAO: 7, ENTRADA: 8, STATUS: 9, DATA_PAGAMENTO: 10, LINK_FOTO: 11, MES_REF: 12
};

var CABECALHO_LANC = ['id', 'data_registro', 'data_gasto', 'vencimento', 'valor', 'categoria',
  'origem_conta', 'descrição', 'entrada', 'status', 'data_pagamento', 'link_foto_drive', 'mes_referencia'];

var NOMES_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Lê uma Script Property (segredos: token, chave do webhook etc.). */
function prop_(nome) {
  return PropertiesService.getScriptProperties().getProperty(nome);
}

/** Minúsculas e sem acentos: "Salão" -> "salao". */
function normalizar(txt) {
  return String(txt == null ? '' : txt).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Data sem horário (meia-noite). */
function soData(d) {
  var x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function hoje() { return soData(new Date()); }

function addDias(d, n) {
  var x = soData(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Quantos dias de "a" até "b" (positivo se b é depois de a). */
function diasEntre(a, b) {
  return Math.round((soData(b).getTime() - soData(a).getTime()) / 86400000);
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }

function fmtData(d) {
  if (!d) return '—';
  d = new Date(d);
  if (isNaN(d.getTime())) return '—';
  return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
}

/** 1234.5 -> "R$ 1.234,50" */
function fmtValor(v) {
  var n = Number(v) || 0;
  var neg = n < 0;
  var partes = Math.abs(n).toFixed(2).split('.');
  var inteiro = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-' : '') + 'R$ ' + inteiro + ',' + partes[1];
}

/** Mês de referência numérico: novembro/2026 -> 202611. */
function mesRef(d) {
  d = new Date(d);
  return d.getFullYear() * 100 + (d.getMonth() + 1);
}

/** Volta n meses a partir de um mês de referência (202601 - 1 = 202512). */
function mesAnterior(ref, n) {
  var ano = Math.floor(ref / 100);
  var mes = (ref % 100) - (n == null ? 1 : n);
  while (mes <= 0) { mes += 12; ano--; }
  while (mes > 12) { mes -= 12; ano++; }
  return ano * 100 + mes;
}

function nomeMes(ref) {
  return NOMES_MESES[(ref % 100) - 1] + '/' + Math.floor(ref / 100);
}

/** Último dia do mês (ex.: fevereiro -> 28 ou 29). */
function ultimoDiaDoMes(ano, mes) {
  return new Date(ano, mes, 0).getDate();
}

/** Escapa texto para parse_mode HTML do Telegram. */
function esc(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Variação percentual formatada: "+12%" / "-5%" / "—". */
function fmtVariacao(atual, anterior) {
  if (!anterior) return '—';
  var p = Math.round((atual / anterior - 1) * 100);
  return (p > 0 ? '+' : '') + p + '%';
}

function emojiOrigem(origem) {
  if (origem === ORIGEM.SALAO) return '🏪';
  if (origem === ORIGEM.PESSOAL) return '🏠';
  return '❓';
}

function capitalizar(t) {
  t = String(t || '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function idCurto_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 10);
}
