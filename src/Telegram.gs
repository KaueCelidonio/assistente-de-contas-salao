/**
 * Telegram.gs — comunicação com a API do Telegram (mensagens, botões, arquivos).
 * O token fica na Script Property TELEGRAM_TOKEN, nunca no código.
 */

/** Chama um método da Bot API. Nunca lança erro: registra no Log e devolve a resposta. */
function tg_(metodo, payload) {
  var token = prop_('TELEGRAM_TOKEN');
  if (!token) throw new Error('TELEGRAM_TOKEN não configurado nas Propriedades do script.');
  var resp = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/' + metodo, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true
  });
  var json;
  try { json = JSON.parse(resp.getContentText()); } catch (e) { json = { ok: false }; }
  if (!json.ok) {
    var descricao = String(json.description || resp.getContentText()).slice(0, 400);
    // "message is not modified" acontece ao editar com o mesmo texto: não é erro de verdade
    if (descricao.indexOf('message is not modified') < 0) {
      registrarLog_('telegram', metodo + ': ' + descricao);
    }
  }
  return json;
}

/** Botão inline. callback_data tem limite de 64 bytes, por isso usamos ids curtos. */
function botao(texto, dados) {
  return { text: texto, callback_data: dados };
}

function limitarTexto_(texto) {
  texto = String(texto || '');
  return texto.length > 4000 ? texto.slice(0, 3990) + '\n…' : texto;
}

/** Envia mensagem (HTML). teclado = array de linhas de botões, opcional. */
function enviar(chatId, texto, teclado) {
  var payload = {
    chat_id: chatId,
    text: limitarTexto_(texto),
    parse_mode: 'HTML',
    disable_web_page_preview: true
  };
  if (teclado && teclado.length) payload.reply_markup = { inline_keyboard: teclado };
  return tg_('sendMessage', payload);
}

/** Edita uma mensagem já enviada (ex.: para tirar os botões após confirmar). */
function editar(chatId, messageId, texto, teclado) {
  var payload = {
    chat_id: chatId,
    message_id: messageId,
    text: limitarTexto_(texto),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: teclado || [] }
  };
  return tg_('editMessageText', payload);
}

/** Tira o "reloginho" do botão. texto aparece como aviso rápido no celular. */
function responderCallback(callbackId, texto) {
  return tg_('answerCallbackQuery', { callback_query_id: callbackId, text: texto || '' });
}

/** Mostra "digitando..." enquanto o bot processa uma foto. */
function acaoDigitando(chatId) {
  tg_('sendChatAction', { chat_id: chatId, action: 'typing' });
}

/** Baixa um arquivo enviado ao bot e devolve um Blob. */
function baixarArquivoTelegram(fileId) {
  var info = tg_('getFile', { file_id: fileId });
  if (!info.ok) throw new Error('Não foi possível obter o arquivo do Telegram.');
  var url = 'https://api.telegram.org/file/bot' + prop_('TELEGRAM_TOKEN') + '/' + info.result.file_path;
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) throw new Error('Falha ao baixar arquivo (' + resp.getResponseCode() + ').');
  return resp.getBlob();
}
