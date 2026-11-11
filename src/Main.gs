/**
 * Main.gs — ponto de entrada do webhook (doPost) e roteamento de mensagens, comandos e botões.
 *
 * Como funciona um lançamento:
 *   mensagem/foto -> "rascunho" guardado no CacheService (6h) -> botões de conferência
 *   -> só grava na planilha quando o usuário toca em ✅ Confirmar.
 */

var VALIDADE_RASCUNHO = 21600; // 6 horas (máximo do CacheService)

/* ===================== Webhook ===================== */

function doPost(e) {
  try {
    // 1) Segredo na URL: o Apps Script não lê headers, então o Telegram chama .../exec?key=SEGREDO
    var chave = prop_('WEBHOOK_KEY');
    if (!chave || !e || !e.parameter || e.parameter.key !== chave) return resposta_();
    if (!e.postData || !e.postData.contents) return resposta_();

    var update = JSON.parse(e.postData.contents);

    // 2) Idempotência: marca o update_id ANTES do trabalho pesado (OCR).
    //    Se o Telegram reenviar enquanto processamos, o reenvio é ignorado.
    if (jaProcessado_(update.update_id)) return resposta_();

    processarUpdate_(update);
  } catch (err) {
    registrarErro_('doPost', err);
  }
  return resposta_(); // sempre 200 "ok", para o Telegram não reenviar
}

/** Abrir a URL do Web App no navegador mostra só isto (útil para testar a publicação). */
function doGet() {
  return ContentService.createTextOutput('Assistente de contas no ar.');
}

function resposta_() {
  // HtmlService responde 200 direto. O ContentService responde com redirecionamento (302),
  // que o Telegram trata como falha: ele reenvia e segura as mensagens seguintes na fila.
  return HtmlService.createHtmlOutput('ok');
}

function jaProcessado_(updateId) {
  if (updateId == null) return false;
  return comLock_(function () {
    var cache = CacheService.getScriptCache();
    var k = 'upd_' + updateId;
    if (cache.get(k)) return true;
    // Segunda barreira (o cache pode ser apagado pelo Google antes das 6h)
    var props = PropertiesService.getScriptProperties();
    var lista = JSON.parse(props.getProperty('ULTIMOS_UPDATES') || '[]');
    if (lista.indexOf(updateId) >= 0) return true;
    cache.put(k, '1', VALIDADE_RASCUNHO);
    lista.push(updateId);
    if (lista.length > 200) lista = lista.slice(-200);
    props.setProperty('ULTIMOS_UPDATES', JSON.stringify(lista));
    registrarLog_('update', updateId);
    return false;
  });
}

function processarUpdate_(u) {
  var chatId = u.callback_query ? u.callback_query.message.chat.id : (u.message ? u.message.chat.id : null);
  if (chatId == null) return;
  if (!autorizado_(chatId)) return;
  try {
    if (u.callback_query) tratarCallback_(u.callback_query);
    else tratarMensagem_(u.message);
  } catch (err) {
    registrarErro_('processarUpdate', err);
    if (u.callback_query) responderCallback(u.callback_query.id, 'Erro, tente de novo');
    enviar(chatId, '😕 Deu um erro aqui. Tente de novo em instantes. Se continuar, avise quem configurou o bot.');
  }
}

/** Só responde a chats cadastrados na aba Config. */
function autorizado_(chatId) {
  var cfg = lerConfig_();
  if (cfg.chats.indexOf(String(chatId)) >= 0) return true;
  registrarLog_('nao_autorizado', 'chat_id ' + chatId);
  // Enquanto ninguém foi cadastrado, o bot informa o chat_id para facilitar a configuração
  if (!cfg.chats.length) {
    enviar(chatId, '🔒 Bot ainda não liberado.\nSeu chat_id é <code>' + chatId + '</code>.\n' +
      'Coloque esse número na aba <b>Config</b>, linha <b>chat_ids_autorizados</b>.');
  }
  return false;
}

/* ===================== Mensagens ===================== */

function tratarMensagem_(msg) {
  var chatId = msg.chat.id;

  if (msg.photo && msg.photo.length) {
    var maior = msg.photo[msg.photo.length - 1]; // o Telegram manda vários tamanhos; o último é o maior
    return tratarFoto_(chatId, maior.file_id, 'image/jpeg', msg.caption);
  }
  if (msg.document) {
    var mime = msg.document.mime_type || '';
    if (/^image\//.test(mime) || mime === 'application/pdf') {
      return tratarFoto_(chatId, msg.document.file_id, mime, msg.caption);
    }
    return enviar(chatId, 'Esse tipo de arquivo eu não leio. Mande uma <b>foto</b> ou um <b>PDF</b> da conta.');
  }
  if (!msg.text) {
    return enviar(chatId, 'Mande uma <b>foto</b> da conta ou um texto como <i>luz 230 salão</i>.');
  }

  var texto = msg.text.trim();
  if (texto.charAt(0) === '/') return tratarComando_(chatId, texto);

  // Estava esperando o usuário digitar um valor ou uma data?
  var estado = lerEstado_(chatId);
  if (estado && estado.acao === 'valor') {
    var v = parseValorBR(texto.replace(/\s/g, ''));
    if (v != null) {
      limparEstado_(chatId);
      var d = lerRascunho_(estado.d);
      if (!d) return enviar(chatId, '⌛ Esse lançamento expirou. Mande de novo, por favor.');
      d.valor = v;
      return mostrarRascunhoNovo_(d);
    }
    limparEstado_(chatId); // não era um valor: trata como lançamento novo
  }
  if (estado && estado.acao === 'venc') {
    var dv = lerRascunho_(estado.d);
    var data = interpretarDataDigitada_(texto);
    if (dv && data) {
      limparEstado_(chatId);
      dv.vencimento = data.getTime();
      dv.status = 'pendente';
      dv.situacaoDefinida = true;
      dv.statusExplicito = true;
      return mostrarRascunhoNovo_(dv);
    }
    if (dv && /^[\d\s\/.\-]+$/.test(texto)) {
      return enviar(chatId, '📅 Não entendi a data. Digite assim: <b>15/12</b> ou só o dia: <b>15</b>');
    }
    limparEstado_(chatId); // não era uma data: trata como lançamento novo
  }
  tratarTexto_(chatId, texto);
}

function tratarTexto_(chatId, texto) {
  var cfg = lerConfig_();
  var r = interpretarTexto(texto, lerCategorias_(), cfg.deduzir);
  if (!r.valor && !r.categoria) {
    return enviar(chatId, '🤔 Não entendi. Exemplos:\n<i>luz 230 salão</i>\n<i>mercado 150 casa</i>\n' +
      '<i>aluguel 2000 venc 10/12 salão</i>\n\nOu mande uma foto da conta. /ajuda mostra tudo.');
  }
  var d = novoRascunho_(chatId, r, 'texto', texto);
  if (!d.valor) return pedirValor_(d, '💰 Qual o valor de <b>' + esc(d.descricao || d.categoria) + '</b>? Digite só o número (ex.: 152,30).');
  mostrarRascunho_(d);
}

function tratarFoto_(chatId, fileId, mime, legenda) {
  enviar(chatId, '📷 Recebi! Lendo a conta, só um instante...');
  acaoDigitando(chatId);
  var cfg = lerConfig_();
  var cats = lerCategorias_();

  // 1) Salva a foto no Drive
  var blob = baixarArquivoTelegram(fileId);
  var ext = mime === 'application/pdf' ? '.pdf' : '.jpg';
  blob.setContentType(mime).setName('conta_' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd_HHmmss') + ext);
  var pastaId = cfg.pasta_drive_id || prop_('PASTA_DRIVE_ID');
  var arquivo = (pastaId ? DriveApp.getFolderById(pastaId) : DriveApp.getRootFolder()).createFile(blob);

  // 2) OCR
  var textoOcr = '';
  try {
    textoOcr = ocrBlob_(blob, pastaId);
  } catch (err) {
    registrarErro_('OCR', err);
  }
  var dados = extrairDadosOcr(textoOcr);

  // 2b) Gemini opcional, só se o OCR não achou o valor
  if (!dados.valor && cfg.gemini) {
    try {
      var g = geminiExtrair_(blob);
      if (g) {
        dados.valor = g.valor || dados.valor;
        dados.vencimento = dados.vencimento || g.vencimento;
        dados.empresa = dados.empresa || g.empresa;
      }
    } catch (err2) { registrarErro_('Gemini', err2); }
  }

  // 3) A legenda da foto ("luz salão", "390") tem prioridade sobre o OCR
  var leg = legenda ? interpretarTexto(legenda, cats, false) : {};
  var textoClass = (legenda || '') + '\n' + (dados.empresa || '') + '\n' + textoOcr;
  var cls = resolverCategoriaEOrigem(textoClass, leg.origem || null, cats, cfg.deduzir);
  // Só usa a categoria da legenda se ela citar uma palavra-chave (ex.: "luz salão")
  var catLegenda = leg.descricao ? classificar(leg.descricao, leg.origem || null, cats, false) : null;
  var r = {
    valor: leg.valor || dados.valor,
    vencimento: leg.vencimento || dados.vencimento,
    dataGasto: leg.dataGasto || null,
    origem: cls.origem,
    categoria: catLegenda ? catLegenda.categoria : cls.categoria,
    descricao: dados.empresa || (legenda && leg.descricao) || '',
    status: leg.status || null
  };
  if (legenda && leg.descricao && dados.empresa) r.descricao = leg.descricao + ' — ' + dados.empresa;

  var d = novoRascunho_(chatId, r, 'foto', textoClass);
  d.fotoId = arquivo.getId();
  d.linkFoto = arquivo.getUrl();
  salvarRascunho_(d);

  if (!d.valor) {
    return pedirValor_(d, '🔎 Não consegui ler o <b>valor</b> nessa foto.\nDigite só o valor (ex.: 152,30).');
  }
  mostrarRascunho_(d);
}

/* ===================== Rascunhos (antes de confirmar) ===================== */

function novoRascunho_(chatId, r, entrada, textoClass) {
  var cats = lerCategorias_();
  var d = {
    id: idCurto_(),
    chat: chatId,
    valor: r.valor || null,
    vencimento: r.vencimento ? soData(r.vencimento).getTime() : null,
    dataGasto: soData(r.dataGasto || new Date()).getTime(),
    categoria: r.categoria || (r.origem ? outrosDe(r.origem, cats) : null),
    catManual: false,
    origem: r.origem || null,
    descricao: r.descricao || '',
    entrada: entrada,
    // Com vencimento = conta a pagar (pendente). Sem vencimento = gasto já feito (pago).
    status: r.status || (r.vencimento ? 'pendente' : 'pago'),
    statusExplicito: !!r.status, // o usuário escreveu "pago"/"pendente"?
    // Sem vencimento e sem "pago"/"pendente": o bot pergunta se já foi pago
    situacaoDefinida: !!(r.status || r.vencimento),
    textoClass: String(textoClass || '').slice(0, 5000),
    fotoId: null, linkFoto: '', msgId: null
  };
  salvarRascunho_(d);
  return d;
}

function salvarRascunho_(d) {
  CacheService.getScriptCache().put('d_' + d.id, JSON.stringify(d), VALIDADE_RASCUNHO);
}

function lerRascunho_(id) {
  var s = CacheService.getScriptCache().get('d_' + id);
  return s ? JSON.parse(s) : null;
}

function apagarRascunho_(id) {
  CacheService.getScriptCache().remove('d_' + id);
}

function salvarEstado_(chatId, obj) {
  CacheService.getScriptCache().put('st_' + chatId, JSON.stringify(obj), 3600);
}
function lerEstado_(chatId) {
  var s = CacheService.getScriptCache().get('st_' + chatId);
  return s ? JSON.parse(s) : null;
}
function limparEstado_(chatId) {
  CacheService.getScriptCache().remove('st_' + chatId);
}

function pedirValor_(d, texto) {
  salvarEstado_(d.chat, { acao: 'valor', d: d.id });
  enviar(d.chat, texto, [[botao('❌ Cancelar', 'can|' + d.id)]]);
}

function textoRascunho_(d) {
  var linhas = [
    '📝 <b>Confira antes de salvar</b>',
    '',
    '💰 Valor: <b>' + (d.valor ? fmtValor(d.valor) : '—') + '</b>',
    '🏷️ Categoria: ' + esc(d.categoria || 'a definir'),
    emojiOrigem(d.origem) + ' Conta do: <b>' + esc(d.origem || 'não definido') + '</b>'
  ];
  if (d.vencimento) linhas.push('📅 Vencimento: ' + fmtData(d.vencimento));
  else linhas.push('📅 Data: ' + fmtData(d.dataGasto));
  if (d.descricao) linhas.push('🗒️ ' + esc(d.descricao));
  if (d.situacaoDefinida !== false) {
    linhas.push('📌 Situação: ' + (d.status === 'pago' ? '✅ já pago' : '⏳ a pagar'));
  }
  if (!d.origem) {
    linhas.push('', '👉 <b>Essa conta é do Salão ou Pessoal?</b>');
  } else if (d.situacaoDefinida === false) {
    linhas.push('', '👉 <b>Essa conta já foi paga?</b>');
  }
  return linhas.join('\n');
}

/** Ordem das perguntas: 1) Salão ou Pessoal  2) já foi paga?  3) conferência final. */
function tecladoRascunho_(d) {
  if (!d.origem) {
    return [
      [botao('🏪 Salão', 'ori|' + d.id + '|S'), botao('🏠 Pessoal', 'ori|' + d.id + '|P')],
      [botao('❌ Cancelar', 'can|' + d.id)]
    ];
  }
  if (d.situacaoDefinida === false) {
    return [
      [botao('✅ Já paguei', 'sp|' + d.id + '|P'), botao('⏳ Ainda vou pagar', 'sp|' + d.id + '|A')],
      [botao('❌ Cancelar', 'can|' + d.id)]
    ];
  }
  return [
    [botao('✅ Confirmar', 'ok|' + d.id), botao('✏️ Corrigir valor', 'val|' + d.id)],
    [botao('🏷️ Trocar categoria', 'cat|' + d.id), botao('🔄 Trocar Salão/Pessoal', 'tro|' + d.id)],
    [botao('📌 Pago / a pagar / vencimento', 'sit|' + d.id)],
    [botao('❌ Cancelar', 'can|' + d.id)]
  ];
}

/** Pergunta o vencimento (botões rápidos ou digitar a data). */
function perguntarVencimento_(d, messageId) {
  salvarEstado_(d.chat, { acao: 'venc', d: d.id });
  salvarRascunho_(d);
  var texto = textoRascunho_(d) + '\n\n📅 <b>Quando vence?</b>\nToque numa opção ou digite a data (ex.: <b>15/12</b> ou só <b>15</b>).';
  var teclado = [
    [botao('Hoje', 'sv|' + d.id + '|0'), botao('Amanhã', 'sv|' + d.id + '|1'), botao('Em 7 dias', 'sv|' + d.id + '|7')],
    [botao('Sem vencimento', 'sv|' + d.id + '|N')],
    [botao('❌ Cancelar', 'can|' + d.id)]
  ];
  if (messageId) editar(d.chat, messageId, texto, teclado);
  else enviar(d.chat, texto, teclado);
}

/** "15/12", "15/12/2026", "15" (só o dia), "hoje", "amanhã" -> Date, ou null. */
function interpretarDataDigitada_(texto) {
  var t = normalizar(texto).trim();
  if (t === 'hoje') return hoje();
  if (t === 'amanha') return addDias(hoje(), 1);
  var m = t.match(/^(\d{1,2})(?:[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?)?$/);
  if (!m) return null;
  return m[2] ? montarData_(m[1], m[2], m[3], true) : proximoDia_(m[1]);
}

/** Depois de o usuário digitar algo: tira os botões da mensagem antiga e manda o rascunho embaixo. */
function mostrarRascunhoNovo_(d) {
  if (d.msgId) editar(d.chat, d.msgId, '📝 <i>Atualizado na mensagem abaixo ⬇️</i>', []);
  d.msgId = null;
  mostrarRascunho_(d);
}

/** Mostra o rascunho: edita a mensagem existente (botões) ou envia uma nova. */
function mostrarRascunho_(d, messageId) {
  if (messageId) {
    editar(d.chat, messageId, textoRascunho_(d), tecladoRascunho_(d));
    d.msgId = messageId;
  } else {
    var r = enviar(d.chat, textoRascunho_(d), tecladoRascunho_(d));
    if (r && r.ok) d.msgId = r.result.message_id;
  }
  salvarRascunho_(d);
}

/** Troca a origem e, se fizer sentido, reclassifica a categoria. */
function aplicarOrigem_(d, origem) {
  var cats = lerCategorias_();
  d.origem = origem;
  var incompativel = d.categoria && !tipoAceita_(tipoDaCategoria(d.categoria, cats), origem);
  if (!d.categoria || !d.catManual || incompativel) {
    var r = resolverCategoriaEOrigem(d.textoClass, origem, cats, false);
    d.categoria = r.categoria;
    d.catManual = false;
  }
}

/* ===================== Botões ===================== */

function tratarCallback_(cq) {
  var partes = String(cq.data || '').split('|');
  var acao = partes[0];
  var chatId = cq.message.chat.id;
  var msgId = cq.message.message_id;

  // Botões que não dependem de rascunho
  if (acao === 'pg') return botaoPaguei_(cq, partes[1]);
  if (acao === 'mf') return botaoManutencaoFeita_(cq, Number(partes[1]));

  var d = lerRascunho_(partes[1]);
  if (!d) {
    responderCallback(cq.id, 'Esse lançamento expirou ou já foi salvo.');
    return editar(chatId, msgId, esc(cq.message.text || '⌛ Expirado.'), []);
  }
  var cats = lerCategorias_();

  switch (acao) {
    case 'ori': // escolheu Salão ou Pessoal
      aplicarOrigem_(d, partes[2] === 'S' ? ORIGEM.SALAO : ORIGEM.PESSOAL);
      responderCallback(cq.id, d.origem);
      return mostrarRascunho_(d, msgId);

    case 'tro': // inverte Salão <-> Pessoal
      aplicarOrigem_(d, d.origem === ORIGEM.SALAO ? ORIGEM.PESSOAL : ORIGEM.SALAO);
      responderCallback(cq.id, 'Agora: ' + d.origem);
      return mostrarRascunho_(d, msgId);

    case 'val': // corrigir valor
      responderCallback(cq.id);
      salvarEstado_(chatId, { acao: 'valor', d: d.id });
      return enviar(chatId, '✏️ Digite o valor certo (ex.: 152,30):');

    case 'cat': { // lista de categorias
      responderCallback(cq.id);
      var linhas = [], linha = [];
      cats.forEach(function (c, i) {
        if (d.origem && !tipoAceita_(c.tipo, d.origem)) return;
        linha.push(botao(c.nome, 'sc|' + d.id + '|' + i));
        if (linha.length === 2) { linhas.push(linha); linha = []; }
      });
      if (linha.length) linhas.push(linha);
      linhas.push([botao('↩️ Voltar', 'back|' + d.id)]);
      return editar(chatId, msgId, textoRascunho_(d) + '\n\n🏷️ <b>Escolha a categoria:</b>', linhas);
    }

    case 'sc': { // escolheu uma categoria
      var c = cats[Number(partes[2])];
      if (c) {
        d.categoria = c.nome;
        d.catManual = true;
        if (!d.origem && c.tipo !== 'Ambos') d.origem = c.tipo;
      }
      responderCallback(cq.id, c ? c.nome : '');
      return mostrarRascunho_(d, msgId);
    }

    case 'back':
      responderCallback(cq.id);
      return mostrarRascunho_(d, msgId);

    case 'sp': // "Já paguei" ou "Ainda vou pagar"
      responderCallback(cq.id);
      d.statusExplicito = true;
      if (partes[2] === 'P') {
        d.status = 'pago';
        d.situacaoDefinida = true;
        return mostrarRascunho_(d, msgId);
      }
      d.status = 'pendente';
      d.situacaoDefinida = true;
      d.msgId = msgId;
      return perguntarVencimento_(d, msgId);

    case 'sv': { // vencimento rápido: hoje / amanhã / 7 dias / sem vencimento
      responderCallback(cq.id);
      limparEstado_(chatId);
      d.vencimento = partes[2] === 'N' ? null : addDias(hoje(), Number(partes[2])).getTime();
      d.status = 'pendente';
      d.situacaoDefinida = true;
      return mostrarRascunho_(d, msgId);
    }

    case 'sit': // refazer a pergunta "já foi paga?"
      responderCallback(cq.id);
      d.situacaoDefinida = false;
      d.vencimento = null;
      return mostrarRascunho_(d, msgId);

    case 'can':
      apagarRascunho_(d.id);
      limparEstado_(chatId);
      if (d.fotoId) { try { DriveApp.getFileById(d.fotoId).setTrashed(true); } catch (e) { /* ignora */ } }
      responderCallback(cq.id, 'Cancelado');
      return editar(chatId, msgId, '❌ Cancelado. Nada foi salvo.', []);

    case 'ok':
      return confirmarRascunho_(cq, d);
  }
  responderCallback(cq.id);
}

function confirmarRascunho_(cq, d) {
  var chatId = cq.message.chat.id, msgId = cq.message.message_id;
  if (!d.valor) {
    responderCallback(cq.id, 'Falta o valor');
    return pedirValor_(d, '💰 Falta o valor. Digite só o número (ex.: 152,30):');
  }
  if (!d.origem || d.situacaoDefinida === false) {
    responderCallback(cq.id, 'Responda a pergunta acima');
    return mostrarRascunho_(d, msgId);
  }

  var res = comLock_(function () {
    if (!lerRascunho_(d.id)) return null; // toque duplo: já foi salvo
    apagarRascunho_(d.id);
    var venc = d.vencimento ? new Date(d.vencimento) : null;
    var ref = mesRef(venc || new Date(d.dataGasto));
    var lanc = {
      dataGasto: new Date(d.dataGasto), vencimento: venc, valor: d.valor,
      categoria: d.categoria || outrosDe(d.origem, lerCategorias_()), origem: d.origem,
      descricao: d.descricao || d.categoria, entrada: d.entrada, status: d.status,
      dataPagamento: d.status === 'pago' ? hoje() : null, linkFoto: d.linkFoto, mesRef: ref
    };
    // Se já existe a conta fixa pendente deste mês (ex.: aluguel), atualiza em vez de duplicar
    var fixa = acharFixaPendente_(lanc.categoria, lanc.origem, ref, d.textoClass + ' ' + d.descricao);
    if (fixa) {
      fixa.valor = lanc.valor;
      fixa.vencimento = venc || fixa.vencimento;
      fixa.mesRef = mesRef(fixa.vencimento || fixa.dataGasto);
      fixa.entrada = d.entrada;
      // Conta fixa continua "a pagar", a não ser que o usuário tenha dito "pago"
      if (d.statusExplicito) {
        fixa.status = lanc.status;
        fixa.dataPagamento = lanc.dataPagamento;
      }
      fixa.linkFoto = d.linkFoto || fixa.linkFoto;
      atualizarLancamento_(fixa);
      return { lanc: fixa, mesclado: true };
    }
    lanc.id = gravarLancamento_(lanc);
    return { lanc: lanc, mesclado: false };
  });

  if (!res) return responderCallback(cq.id, 'Já estava salvo 👍');
  responderCallback(cq.id, 'Salvo!');
  limparEstado_(chatId);

  var l = res.lanc;
  var texto = '✅ <b>Salvo!</b> (nº ' + l.id + ')\n' +
    emojiOrigem(l.origem) + ' ' + esc(l.origem) + ' · ' + esc(l.categoria) + ' · <b>' + fmtValor(l.valor) + '</b>\n' +
    (l.vencimento ? '📅 Vence ' + fmtData(l.vencimento) + ' · ' : '') + (l.status === 'pago' ? 'já pago' : 'a pagar');
  if (res.mesclado) texto += '\n🔁 Atualizei a conta fixa "' + esc(l.descricao) + '" deste mês.';
  var teclado = l.status !== 'pago' ? [[botao('✅ Já paguei', 'pg|' + l.id)]] : [];
  editar(chatId, msgId, texto, teclado);

  // Aviso imediato se a conta salva já venceu ou vence nos próximos dias
  if (l.status !== 'pago' && l.vencimento) {
    var dias = diasEntre(hoje(), l.vencimento);
    if (dias < 0) enviar(chatId, '🔴 <b>Atenção:</b> essa conta já <b>venceu</b> há ' + (-dias) + ' dia(s) (' + fmtData(l.vencimento) + '). Pague o quanto antes!');
    else if (dias === 0) enviar(chatId, '⏰ <b>Atenção:</b> essa conta <b>vence HOJE</b>!');
    else if (dias <= 3) enviar(chatId, '⏳ Essa conta vence em <b>' + dias + ' dia(s)</b> (' + fmtData(l.vencimento) + '). Vou te lembrar de novo.');
  }

  var alerta = verificarAnomalia_(l);
  if (alerta) enviar(chatId, alerta);
}

function botaoPaguei_(cq, id) {
  var l = marcarPago_(id);
  if (!l) {
    responderCallback(cq.id, 'Conta não encontrada');
    return;
  }
  responderCallback(cq.id, l.jaEstavaPago ? 'Já estava paga' : 'Marcado como pago!');
  var texto = (cq.message.text ? esc(cq.message.text) + '\n\n' : '') +
    '✅ <b>Paga</b>: nº ' + l.id + ' · ' + esc(l.descricao) + ' · ' + fmtValor(l.valor);
  // Tira só o botão desta conta, mantendo os outros (listas com vários "Paguei")
  var teclado = ((cq.message.reply_markup || {}).inline_keyboard || []).map(function (linha) {
    return linha.filter(function (b) { return b.callback_data !== 'pg|' + id; });
  }).filter(function (linha) { return linha.length; });
  editar(cq.message.chat.id, cq.message.message_id, texto, teclado);
}

function botaoManutencaoFeita_(cq, linha) {
  var m = registrarManutencaoFeita_(linha);
  if (!m) return responderCallback(cq.id, 'Não encontrei');
  responderCallback(cq.id, 'Registrado!');
  editar(cq.message.chat.id, cq.message.message_id,
    '🔧 <b>' + esc(m.equipamento) + '</b>: feito hoje. Próxima: ' + fmtData(m.proxima), []);
}

/* ===================== Comandos ===================== */

function tratarComando_(chatId, texto) {
  var partes = texto.split(/\s+/);
  var cmd = normalizar(partes[0].split('@')[0]); // "/pago@MeuBot" -> "/pago"
  var args = partes.slice(1);
  limparEstado_(chatId);

  switch (cmd) {
    case '/start':
    case '/ajuda':
    case '/help':
      return enviar(chatId, textoAjuda_());

    case '/resumo':
      return enviar(chatId, montarResumo_(mesRef(hoje()), false));

    case '/mes': {
      var m = (args[0] || '').match(/^(\d{1,2})[\/\-](\d{2}|\d{4})$/);
      if (!m) return enviar(chatId, 'Use assim: <code>/mes 10/2026</code>');
      var ano = Number(m[2]) < 100 ? 2000 + Number(m[2]) : Number(m[2]);
      return enviar(chatId, montarResumo_(ano * 100 + Number(m[1]), true));
    }

    case '/vencimentos':
      gerarContasFixas_();
      return enviarListaContas_(chatId, 'vencimentos');

    case '/pendentes':
      gerarContasFixas_();
      return enviarListaContas_(chatId, 'pendentes');

    case '/pago': {
      var id = Number(args[0]);
      if (!id) return enviar(chatId, 'Use assim: <code>/pago 12</code> (o número aparece em /pendentes).');
      var l = marcarPago_(id);
      if (!l) return enviar(chatId, 'Não achei a conta nº ' + id + '.');
      return enviar(chatId, (l.jaEstavaPago ? 'ℹ️ Já estava paga: ' : '✅ Marcada como paga: ') +
        'nº ' + l.id + ' · ' + esc(l.descricao) + ' · ' + fmtValor(l.valor));
    }

    case '/desfazer': {
      var u = excluirUltimoLancamento_();
      if (!u) return enviar(chatId, 'Não há lançamentos para desfazer.');
      return enviar(chatId, '↩️ Apaguei o último lançamento: nº ' + u.id + ' · ' + esc(u.descricao) + ' · ' +
        fmtValor(u.valor) + ' (' + esc(u.origem) + ')');
    }

    case '/manutencao':
    case '/manutencoes':
      return comandoManutencao_(chatId, args);

    case '/categorias':
      return enviar(chatId, textoCategorias_());

    case '/id':
      return enviar(chatId, 'Seu chat_id: <code>' + chatId + '</code>');
  }
  enviar(chatId, 'Comando desconhecido. Veja /ajuda.');
}

function textoAjuda_() {
  return [
    '👋 <b>Assistente de Contas</b>',
    '',
    '📷 <b>Mande a foto</b> da conta, boleto ou nota.',
    '✍️ Ou <b>escreva</b>: <i>luz 230 salão</i> · <i>mercado 150 casa</i> · <i>aluguel 2000 venc 10/12 salão</i>',
    '',
    '🏪 <b>salão</b> ou <b>loja</b> = conta do Salão',
    '🏠 <b>casa</b> ou <b>pessoal</b> = conta Pessoal',
    'Se você não disser, eu pergunto.',
    '',
    '<b>Comandos</b>',
    '/resumo — gastos do mês',
    '/mes 10/2026 — gastos de outro mês',
    '/vencimentos — o que vence nos próximos dias',
    '/pendentes — tudo que falta pagar',
    '/pago 12 — marca a conta nº 12 como paga',
    '/desfazer — apaga o último lançamento',
    '/manutencao — manutenções; /manutencao feito secador',
    '/categorias — lista de categorias'
  ].join('\n');
}

function textoCategorias_() {
  var cats = lerCategorias_();
  var bloco = function (tipo, titulo) {
    var nomes = cats.filter(function (c) { return c.tipo === tipo; }).map(function (c) { return '• ' + esc(c.nome); });
    return nomes.length ? titulo + '\n' + nomes.join('\n') : '';
  };
  return ['🏷️ <b>Categorias</b>', '', bloco(ORIGEM.SALAO, '🏪 <b>Salão</b>'), '',
    bloco(ORIGEM.PESSOAL, '🏠 <b>Pessoal</b>'), '', bloco('Ambos', '🔁 <b>Salão e Pessoal</b>'),
    '', '<i>Para mudar, edite a aba Categorias da planilha.</i>'].join('\n');
}

function comandoManutencao_(chatId, args) {
  var lista = lerManutencoes_();
  if (normalizar(args[0]) === 'feito') {
    var nome = normalizar(args.slice(1).join(' '));
    if (!nome) return enviar(chatId, 'Use assim: <code>/manutencao feito secador</code>');
    var achada = lista.filter(function (m) { return normalizar(m.equipamento).indexOf(nome) >= 0; })[0];
    if (!achada) return enviar(chatId, 'Não achei "' + esc(nome) + '" na aba Manutenções.');
    var m = registrarManutencaoFeita_(achada.linha);
    return enviar(chatId, '🔧 <b>' + esc(m.equipamento) + '</b>: feito hoje. Próxima: ' + fmtData(m.proxima));
  }
  if (!lista.length) return enviar(chatId, 'Nenhuma manutenção cadastrada. Adicione na aba Manutenções.');
  var h = hoje();
  var linhas = lista.map(function (m) {
    if (!m.proxima) return '• ' + esc(m.equipamento) + ': sem data (use /manutencao feito ' + esc(m.equipamento) + ')';
    var dias = diasEntre(h, m.proxima);
    var quando = dias < 0 ? '🔴 atrasada ' + (-dias) + ' dia(s)' : dias === 0 ? '🟠 hoje' : 'em ' + dias + ' dia(s)';
    return '• ' + esc(m.equipamento) + ': ' + fmtData(m.proxima) + ' (' + quando + ')';
  });
  enviar(chatId, '🔧 <b>Manutenções</b>\n' + linhas.join('\n'));
}
