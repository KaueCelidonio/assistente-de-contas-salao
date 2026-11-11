/**
 * Setup.gs — configuração inicial e funções utilitárias.
 *
 * Ordem de uso (detalhes no README):
 *   1) setup()        cria abas, categorias, pasta do Drive, painel e o gatilho diário
 *   2) publicar o Web App e colar a URL na propriedade WEB_APP_URL
 *   3) setWebhook()   liga o Telegram ao script
 */

/* ===================== Instalação guiada (menu da planilha) ===================== */

/** Cria o menu "🤖 Assistente de Contas" quando a planilha é aberta. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🤖 Assistente de Contas')
    .addItem('Instalar / reinstalar', 'instalar')
    .addItem('Liberar nova pessoa', 'liberarPessoa')
    .addItem('Testar alertas agora', 'testarAlertasAgora')
    .addItem('Atualizar painel', 'atualizarPainel')
    .addItem('Ver status do bot', 'mostrarStatus')
    .addToUi();
}

/**
 * Instalação em um clique: pede o token, roda setup(), descobre o chat_id
 * de quem mandou /start para o bot e registra o webhook.
 */
function instalar() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();

  // 1) Token (fica só nas Propriedades do script)
  var temToken = !!prop_('TELEGRAM_TOKEN');
  var instalacaoNova = !temToken; // cópia nova da planilha: as Propriedades não vão junto na cópia
  var r = ui.prompt('Token do bot',
    (temToken ? 'Já existe um token salvo. Deixe em branco para mantê-lo.\n\n' : '') +
    'Cole o token que o @BotFather enviou (ex.: 7123456789:AAH...):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var token = r.getResponseText().trim();
  if (token) {
    if (!/^\d+:[\w-]{30,}$/.test(token)) return ui.alert('Esse token não parece certo. Copie de novo a mensagem do @BotFather.');
    props.setProperty('TELEGRAM_TOKEN', token);
  }
  if (!prop_('TELEGRAM_TOKEN')) return ui.alert('Sem token não dá para continuar.');
  var me = tg_('getMe', {});
  if (!me.ok) return ui.alert('O Telegram recusou o token. Confira no @BotFather (/token).');
  var bot = '@' + me.result.username;

  // 2) Abas, pasta, painel, gatilho
  setup();

  // 2b) Cópia de uma planilha de teste: oferece começar do zero
  if (instalacaoNova) {
    _cacheExec = {};
    var shL = aba_(ABA.LANC), shLog = aba_(ABA.LOG);
    var qtd = Math.max(shL.getLastRow() - 1, 0);
    var chatsAntigos = lerConfig_().chats.length;
    if (qtd || chatsAntigos) {
      var resp = ui.alert('Começar do zero?',
        'Esta planilha veio com dados de teste: ' + qtd + ' lançamento(s) e ' + chatsAntigos + ' pessoa(s) liberada(s).\n\n' +
        'Apagar tudo isso e começar limpo? (Categorias, contas fixas e manutenções são mantidas.)', ui.ButtonSet.YES_NO);
      if (resp === ui.Button.YES) {
        if (qtd) shL.deleteRows(2, qtd);
        if (shLog.getLastRow() > 1) shLog.deleteRows(2, shLog.getLastRow() - 1);
        salvarConfig_('chat_ids_autorizados', '');
        props.deleteProperty('ULTIMO_ID');
        _cacheExec = {};
      }
    }
  }

  // 3) URL do Web App
  // A URL gravada no código só vale para o projeto original (numa cópia da planilha, pergunta)
  var urlDoCodigo = (typeof URL_WEB_APP_INSTALACAO !== 'undefined' && typeof SCRIPT_ID_INSTALACAO !== 'undefined' &&
    SCRIPT_ID_INSTALACAO === ScriptApp.getScriptId()) ? URL_WEB_APP_INSTALACAO : '';
  var url = prop_('WEB_APP_URL') || urlDoCodigo;
  if (!url) {
    var ru = ui.prompt('URL do Web App', 'Cole a URL do App da Web (termina em /exec):', ui.ButtonSet.OK_CANCEL);
    if (ru.getSelectedButton() !== ui.Button.OK) return;
    url = ru.getResponseText().trim();
  }
  props.setProperty('WEB_APP_URL', url);

  // 4) chat_id: lê quem mandou /start (getUpdates só funciona sem webhook)
  _cacheExec = {};
  if (!lerConfig_().chats.length) {
    tg_('deleteWebhook', { drop_pending_updates: false });
    ui.alert('Falta só liberar o seu Telegram',
      '1. Abra o Telegram e procure ' + bot + '\n2. Toque em INICIAR (ou mande /start)\n3. Volte aqui e clique OK', ui.ButtonSet.OK);
    var up = tg_('getUpdates', { timeout: 0 });
    var achados = {};
    (up.result || []).forEach(function (u) {
      var m = u.message || (u.callback_query && u.callback_query.message);
      if (m && m.chat && m.chat.type === 'private') achados[m.chat.id] = [m.chat.first_name, m.chat.last_name].filter(String).join(' ');
    });
    var ids = Object.keys(achados);
    if (!ids.length) {
      ui.alert('Não vi nenhuma mensagem para ' + bot + '. Mande /start para ele e rode "Instalar" de novo.');
      return;
    }
    var nomes = ids.map(function (id) { return achados[id] + ' (' + id + ')'; }).join('\n');
    if (ui.alert('Liberar estas pessoas?', nomes, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    salvarConfig_('chat_ids_autorizados', ids.join(', '));
  }

  // 5) Webhook + mensagem de boas-vindas
  setWebhook();
  _cacheExec = {};
  lerConfig_().chats.forEach(function (c) {
    enviar(c, '✅ <b>Instalado!</b> Pode mandar suas contas por aqui.\n\n' + textoAjuda_());
  });
  ui.alert('Pronto! 🎉', 'O bot ' + bot + ' está funcionando.\nVeja a mensagem de boas-vindas no Telegram e mande, por exemplo: luz 230 salão', ui.ButtonSet.OK);
}

/**
 * Libera outra pessoa (ex.: o dono do salão): ela manda /start para o bot,
 * o bot registra o chat_id no Log, e aqui você confirma.
 */
function liberarPessoa() {
  var ui = SpreadsheetApp.getUi();
  var me = tg_('getMe', {});
  var bot = me.ok ? '@' + me.result.username : 'o bot';
  var cfg = lerConfig_();
  var log = aba_(ABA.LOG).getDataRange().getValues().slice(-300).reverse();
  var ids = [];
  log.forEach(function (l) {
    var m = String(l[2]).match(/chat_id (-?\d+)/);
    if (l[1] === 'nao_autorizado' && m && ids.indexOf(m[1]) < 0 && cfg.chats.indexOf(m[1]) < 0) ids.push(m[1]);
  });
  if (!ids.length) {
    return ui.alert('Ninguém novo', 'Peça para a pessoa abrir ' + bot + ' no Telegram e tocar em INICIAR (ou mandar /start).\n' +
      'Depois clique de novo em "Liberar nova pessoa".', ui.ButtonSet.OK);
  }
  var liberados = [];
  ids.slice(0, 5).forEach(function (id) {
    var info = tg_('getChat', { chat_id: id });
    var nome = info.ok ? [info.result.first_name, info.result.last_name].filter(String).join(' ') : '';
    if (ui.alert('Liberar esta pessoa?', (nome || 'Sem nome') + ' (chat_id ' + id + ')', ui.ButtonSet.YES_NO) === ui.Button.YES) {
      liberados.push(id);
    }
  });
  if (!liberados.length) return;
  salvarConfig_('chat_ids_autorizados', cfg.chats.concat(liberados).join(', '));
  liberados.forEach(function (id) { enviar(id, '✅ <b>Acesso liberado!</b>\n\n' + textoAjuda_()); });
  ui.alert('Pronto! Liberado(s): ' + liberados.length + '. A pessoa já recebeu as instruções no Telegram.');
}

/** Mostra se o webhook está registrado e o último erro informado pelo Telegram. */
function mostrarStatus() {
  var r = tg_('getWebhookInfo', {}).result || {};
  var erros = [];
  try {
    erros = aba_(ABA.LOG).getDataRange().getValues().filter(function (l) { return l[1] === 'erro' || l[1] === 'telegram'; })
      .slice(-3).map(function (l) { return '• ' + fmtData(l[0]) + ' ' + String(l[2]).split('\n')[0].slice(0, 150); });
  } catch (e) { /* sem Log ainda */ }
  SpreadsheetApp.getUi().alert('Status do bot',
    'Webhook: ' + (r.url ? 'registrado ✅' : 'NÃO registrado ❌ (rode Instalar)') +
    '\nMensagens na fila: ' + (r.pending_update_count || 0) +
    '\nÚltimo erro do Telegram: ' + (r.last_error_message || 'nenhum') +
    '\n\nErros recentes do bot:\n' + (erros.length ? erros.join('\n') : 'nenhum'),
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var id = prop_('SPREADSHEET_ID');
    ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('Assistente de Contas');
  }
  var props = PropertiesService.getScriptProperties();
  props.setProperty('SPREADSHEET_ID', ss.getId());
  _cacheExec = {};
  ss.setSpreadsheetTimeZone(TZ);

  // --- Abas e cabeçalhos ---
  criarAba_(ss, ABA.LANC, CABECALHO_LANC);
  criarAba_(ss, ABA.CAT, ['categoria', 'tipo', 'palavras-chave']);
  criarAba_(ss, ABA.FIXAS, ['nome', 'categoria', 'origem_conta', 'dia_vencimento', 'valor_médio']);
  criarAba_(ss, ABA.MANUT, ['equipamento', 'periodicidade_dias', 'última_data', 'próxima_data']);
  criarAba_(ss, ABA.PAINEL, null);
  criarAba_(ss, ABA.CONFIG, ['parâmetro', 'valor', 'descrição']);
  criarAba_(ss, ABA.LOG, ['data', 'tipo', 'detalhe']);

  var lanc = ss.getSheetByName(ABA.LANC);
  lanc.getRange('B:D').setNumberFormat('dd/MM/yyyy');
  lanc.getRange('B:B').setNumberFormat('dd/MM/yyyy HH:mm');
  lanc.getRange('E:E').setNumberFormat('"R$" #,##0.00');
  lanc.getRange('K:K').setNumberFormat('dd/MM/yyyy');
  lanc.getRange('M1').setNote('Mês de referência (AAAAMM), preenchido pelo bot. Usado pelo Painel.');
  validacaoLista_(lanc.getRange('G2:G'), [ORIGEM.SALAO, ORIGEM.PESSOAL]);
  validacaoLista_(lanc.getRange('J2:J'), ['pendente', 'pago']);

  // --- Categorias padrão (só se a aba estiver vazia) ---
  var cat = ss.getSheetByName(ABA.CAT);
  if (cat.getLastRow() < 2) {
    cat.getRange(2, 1, CATEGORIAS_PADRAO.length, 3).setValues(CATEGORIAS_PADRAO);
  }
  validacaoLista_(cat.getRange('B2:B'), [ORIGEM.SALAO, ORIGEM.PESSOAL, 'Ambos']);
  cat.setColumnWidth(3, 600);

  // --- Contas fixas: só formatação e dica (sem exemplos, para não gerar contas falsas) ---
  var fixas = ss.getSheetByName(ABA.FIXAS);
  fixas.getRange('A1').setNote('Ex.: Aluguel do salão | Aluguel | Salão | 10 | 2000\n' +
    'O bot cria a conta como pendente todo mês e avisa antes de vencer.');
  fixas.getRange('E:E').setNumberFormat('"R$" #,##0.00');
  validacaoLista_(fixas.getRange('C2:C'), [ORIGEM.SALAO, ORIGEM.PESSOAL]);
  var nomesCat = cat.getRange(2, 1, Math.max(cat.getLastRow() - 1, 1), 1).getValues().map(function (l) { return l[0]; }).filter(String);
  validacaoLista_(fixas.getRange('B2:B'), nomesCat);

  // --- Manutenções: exemplos sem data (não geram alerta até alguém preencher a última_data) ---
  var manut = ss.getSheetByName(ABA.MANUT);
  if (manut.getLastRow() < 2) {
    manut.getRange(2, 1, 3, 2).setValues([['Filtro do ar-condicionado', 30], ['Revisão dos secadores', 90], ['Afiar tesouras', 60]]);
  }
  for (var r = 2; r <= Math.max(manut.getLastRow(), 2); r++) {
    if (!manut.getRange(r, 4).getFormula()) manut.getRange(r, 4).setFormula('=IF(C' + r + '="","",C' + r + '+B' + r + ')');
  }
  manut.getRange('C:D').setNumberFormat('dd/MM/yyyy');
  manut.getRange('A1').setNote('Preencha a última_data. A próxima_data é calculada sozinha.\nNo Telegram: /manutencao feito filtro');

  // --- Config (mantém valores já preenchidos) ---
  var conf = ss.getSheetByName(ABA.CONFIG);
  var existentes = conf.getDataRange().getValues().map(function (l) { return String(l[0]).trim(); });
  CONFIG_PADRAO.forEach(function (l) {
    if (existentes.indexOf(l[0]) < 0) conf.appendRow(l);
  });
  conf.getRange('B:B').setNumberFormat('@'); // texto puro (chat_ids grandes não viram notação científica)
  conf.setColumnWidth(1, 230).setColumnWidth(2, 220).setColumnWidth(3, 520);

  // --- Segredo do webhook (gerado uma vez) ---
  if (!prop_('WEBHOOK_KEY')) props.setProperty('WEBHOOK_KEY', Utilities.getUuid().replace(/-/g, ''));

  // --- Pasta do Drive para as fotos ---
  _cacheExec = {};
  var cfg = lerConfig_();
  var pastaId = cfg.pasta_drive_id || prop_('PASTA_DRIVE_ID');
  var pastaOk = false;
  if (pastaId) { try { DriveApp.getFolderById(pastaId).getName(); pastaOk = true; } catch (e) { pastaOk = false; } }
  if (!pastaOk) {
    pastaId = DriveApp.createFolder('Assistente de Contas - Fotos').getId();
    salvarConfig_('pasta_drive_id', pastaId);
  }
  props.setProperty('PASTA_DRIVE_ID', pastaId);

  // --- Painel ---
  _cacheExec = {};
  atualizarPainel();

  // --- Gatilho diário ---
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'alertasDiarios') ScriptApp.deleteTrigger(t);
  });
  var hora = Number(lerConfig_().hora_alerta) || 8;
  ScriptApp.newTrigger('alertasDiarios').timeBased().everyDays(1).atHour(hora).inTimezone(TZ).create();

  // Remove a aba vazia padrão ("Página1"/"Sheet1"), se existir
  ['Página1', 'Sheet1', 'Planilha1'].forEach(function (n) {
    var s = ss.getSheetByName(n);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });

  console.log('✅ Setup concluído.\nPlanilha: ' + ss.getUrl() + '\nPasta das fotos: https://drive.google.com/drive/folders/' + pastaId +
    '\nPróximo passo: publicar o Web App, colar a URL em WEB_APP_URL e rodar setWebhook().');
}

function criarAba_(ss, nome, cabecalho) {
  var sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
  if (cabecalho && sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]).setFontWeight('bold').setBackground('#f1e4f3');
    sh.setFrozenRows(1);
  }
  return sh;
}

function validacaoLista_(range, valores) {
  if (!valores.length) return;
  range.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(valores, true).setAllowInvalid(true).build());
}

/**
 * (Re)constrói a aba Painel: fórmulas nativas + 2 gráficos.
 * É chamada pelo setup() e todo dia pelo alerta (para incluir categorias novas).
 */
function atualizarPainel() {
  var ss = planilha_();
  var sh = ss.getSheetByName(ABA.PAINEL) || ss.insertSheet(ABA.PAINEL);
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  sh.clear();

  var L = "'" + ABA.LANC + "'!";
  var soma = function (origemCel, refCel, catCel) {
    var f = 'SUMIFS(' + L + '$E:$E,' + L + '$M:$M,' + refCel;
    if (origemCel) f += ',' + L + '$G:$G,' + origemCel;
    if (catCel) f += ',' + L + '$F:$F,' + catCel;
    return f + ')';
  };

  sh.getRange('A1').setValue('📊 Painel de contas').setFontSize(16).setFontWeight('bold');
  sh.getRange('A2').setValue('Mês (AAAAMM):');
  sh.getRange('B2:E2').setFormulas([[
    '=YEAR(TODAY())*100+MONTH(TODAY())',
    '=YEAR(EDATE(TODAY(),-1))*100+MONTH(EDATE(TODAY(),-1))',
    '=YEAR(EDATE(TODAY(),-2))*100+MONTH(EDATE(TODAY(),-2))',
    '=YEAR(EDATE(TODAY(),-3))*100+MONTH(EDATE(TODAY(),-3))'
  ]]);
  sh.getRange('B1:E1').setValues([['atual', 'anterior', '2 meses atrás', '3 meses atrás']]).setFontColor('#888888');
  sh.getRange('B2:E2').setFontColor('#888888');

  // --- Bloco 1: Salão x Pessoal ---
  sh.getRange('A4:F4').setValues([['Resumo', 'Mês atual', 'Mês anterior', 'Média 3 meses', 'Variação vs anterior', 'Variação vs média']]);
  [['Salão', 5], ['Pessoal', 6]].forEach(function (x) {
    var r = x[1];
    sh.getRange(r, 1).setValue(x[0]);
    sh.getRange(r, 2, 1, 5).setFormulas([[
      '=' + soma('$A' + r, 'B$2'),
      '=' + soma('$A' + r, 'C$2'),
      '=(' + soma('$A' + r, '$C$2') + '+' + soma('$A' + r, '$D$2') + '+' + soma('$A' + r, '$E$2') + ')/3',
      '=IF(C' + r + '=0,"—",B' + r + '/C' + r + '-1)',
      '=IF(D' + r + '=0,"—",B' + r + '/D' + r + '-1)'
    ]]);
  });
  sh.getRange('A7').setValue('Total geral');
  sh.getRange('B7:F7').setFormulas([['=B5+B6', '=C5+C6', '=D5+D6',
    '=IF(C7=0,"—",B7/C7-1)', '=IF(D7=0,"—",B7/D7-1)']]);
  sh.getRange('A8').setValue('A pagar (mês atual)');
  sh.getRange('B8').setFormula('=SUMIFS(' + L + '$E:$E,' + L + '$M:$M,B$2,' + L + '$J:$J,"pendente")');

  // --- Bloco 2: por categoria ---
  var cats = lerCategorias_();
  var ini = 11;
  sh.getRange(ini - 1, 1, 1, 8).setValues([['Categoria', 'Tipo', 'Salão (mês)', 'Pessoal (mês)', 'Total mês', 'Mês anterior', 'Média 3 meses', 'Variação vs média']]);
  var formulas = cats.map(function (c, i) {
    var r = ini + i;
    return [
      '=' + soma('"' + ORIGEM.SALAO + '"', '$B$2', '$A' + r),
      '=' + soma('"' + ORIGEM.PESSOAL + '"', '$B$2', '$A' + r),
      '=C' + r + '+D' + r,
      '=' + soma(null, '$C$2', '$A' + r),
      '=(' + soma(null, '$C$2', '$A' + r) + '+' + soma(null, '$D$2', '$A' + r) + '+' + soma(null, '$E$2', '$A' + r) + ')/3',
      '=IF(G' + r + '=0,"—",E' + r + '/G' + r + '-1)'
    ];
  });
  if (cats.length) {
    sh.getRange(ini, 1, cats.length, 2).setValues(cats.map(function (c) { return [c.nome, c.tipo]; }));
    sh.getRange(ini, 3, cats.length, 6).setFormulas(formulas);
  }
  var fim = ini + cats.length - 1;

  // --- Formatação ---
  [sh.getRange('A4:F4'), sh.getRange(ini - 1, 1, 1, 8)].forEach(function (r) {
    r.setFontWeight('bold').setBackground('#f1e4f3');
  });
  sh.getRange('A7:F7').setFontWeight('bold');
  sh.getRange('B5:D8').setNumberFormat('"R$" #,##0.00');
  sh.getRange('E5:F7').setNumberFormat('+0%;-0%;0%');
  sh.getRange(ini, 3, Math.max(cats.length, 1), 5).setNumberFormat('"R$" #,##0.00');
  sh.getRange(ini, 8, Math.max(cats.length, 1), 1).setNumberFormat('+0%;-0%;0%');
  sh.setColumnWidth(1, 170);
  for (var c = 2; c <= 8; c++) sh.setColumnWidth(c, 120);

  // Destaca em vermelho categorias acima do limite de anomalia
  var lim = (lerConfig_().pctAnomalia || 25) / 100;
  var regra = SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(lim)
    .setFontColor('#c62828').setBold(true).setRanges([sh.getRange(ini, 8, Math.max(cats.length, 1), 1), sh.getRange('F5:F7')]).build();
  sh.setConditionalFormatRules([regra]);

  // --- Gráficos ---
  sh.insertChart(sh.newChart().setChartType(Charts.ChartType.COLUMN)
    .addRange(sh.getRange('A4:D6'))
    .setOption('title', 'Salão x Pessoal: atual, anterior e média')
    .setOption('legend', { position: 'bottom' })
    .setPosition(1, 10, 0, 0).setOption('width', 520).setOption('height', 300).build());

  if (cats.length) {
    sh.insertChart(sh.newChart().setChartType(Charts.ChartType.PIE)
      .addRange(sh.getRange(ini, 1, cats.length, 1))
      .addRange(sh.getRange(ini, 5, cats.length, 1))
      .setOption('title', 'Gastos do mês por categoria')
      .setOption('pieHole', 0.4)
      .setPosition(17, 10, 0, 0).setOption('width', 520).setOption('height', 320).build());
  }
  sh.setFrozenRows(0);
  return fim;
}

/* ===================== Webhook ===================== */

function urlWebApp_() {
  var url = prop_('WEB_APP_URL') || ScriptApp.getService().getUrl();
  if (!url) throw new Error('Publique o Web App e cole a URL (terminada em /exec) na propriedade WEB_APP_URL.');
  if (/\/dev$/.test(url)) throw new Error('Use a URL que termina em /exec, não /dev.');
  return url;
}

/** Liga o Telegram ao script. Rode de novo sempre que a URL do Web App mudar. */
function setWebhook() {
  var url = urlWebApp_() + '?key=' + encodeURIComponent(prop_('WEBHOOK_KEY'));
  var r = tg_('setWebhook', {
    url: url,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
    max_connections: 1 // um update por vez: menos concorrência na planilha
  });
  console.log('setWebhook: ' + JSON.stringify(r));
  tg_('setMyCommands', { commands: [
    { command: 'resumo', description: 'Gastos do mês (Salão e Pessoal)' },
    { command: 'vencimentos', description: 'O que vence nos próximos dias' },
    { command: 'pendentes', description: 'Tudo que falta pagar' },
    { command: 'mes', description: 'Resumo de outro mês: /mes 10/2026' },
    { command: 'pago', description: 'Marcar conta como paga: /pago 12' },
    { command: 'desfazer', description: 'Apagar o último lançamento' },
    { command: 'manutencao', description: 'Manutenções dos equipamentos' },
    { command: 'categorias', description: 'Ver categorias' },
    { command: 'ajuda', description: 'Como usar' }
  ] });
  infoWebhook();
}

function deleteWebhook() {
  console.log('deleteWebhook: ' + JSON.stringify(tg_('deleteWebhook', { drop_pending_updates: false })));
}

/** Mostra o estado do webhook. "last_error_message" com 302 é normal no Apps Script (veja README). */
function infoWebhook() {
  var r = tg_('getWebhookInfo', {});
  if (r.result && r.result.url) r.result.url = r.result.url.replace(/key=[^&]+/, 'key=***');
  console.log('getWebhookInfo: ' + JSON.stringify(r, null, 2));
}

/* ===================== Testes manuais ===================== */

/** Testa o OCR num arquivo que já está no Drive (imagem ou PDF). */
function testarOCR(fileId) {
  if (!fileId) throw new Error('Informe o ID do arquivo do Drive. Use rodarTesteOCR() e cole o ID lá.');
  var blob = DriveApp.getFileById(fileId).getBlob();
  var texto = ocrBlob_(blob, prop_('PASTA_DRIVE_ID'));
  var dados = extrairDadosOcr(texto);
  var cls = resolverCategoriaEOrigem(texto, null, lerCategorias_(), true);
  console.log('--- Texto lido (início) ---\n' + texto.slice(0, 1500));
  console.log('--- Extraído ---\nValor: ' + (dados.valor ? fmtValor(dados.valor) : 'NÃO ACHOU') +
    '\nVencimento: ' + fmtData(dados.vencimento) + '\nEmpresa: ' + dados.empresa +
    '\nCategoria: ' + cls.categoria + '\nOrigem: ' + (cls.origem || 'perguntar'));
  return dados;
}

/** Testa a interpretação de um texto, como se tivesse sido mandado no Telegram. */
function testarParser(texto) {
  texto = texto || 'luz 320,50 venc 15/12 salão';
  var r = interpretarTexto(texto, lerCategorias_(), true);
  console.log('"' + texto + '"\nValor: ' + (r.valor ? fmtValor(r.valor) : '—') + '\nCategoria: ' + r.categoria +
    '\nOrigem: ' + (r.origem || 'perguntar') + '\nVencimento: ' + fmtData(r.vencimento) +
    '\nData: ' + fmtData(r.dataGasto) + '\nDescrição: ' + r.descricao + '\nStatus: ' + (r.status || 'automático'));
  return r;
}

// Atalhos para rodar pelo botão "Executar" do editor (que não aceita parâmetros)
function rodarTesteOCR() { testarOCR('COLE_AQUI_O_ID_DO_ARQUIVO'); }
function rodarTesteParser() { testarParser('manutenção secador 150'); }
