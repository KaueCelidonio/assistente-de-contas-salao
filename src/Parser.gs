/**
 * Parser.gs — entende texto livre ("luz 320,50 venc 15/12 salão"),
 * classifica a categoria, descobre Salão/Pessoal e lê fotos via OCR.
 */

/* ===================== Categorias padrão ===================== */

// [categoria, tipo (Salão / Pessoal / Ambos), palavras-chave separadas por vírgula]
// Escreva as palavras sem acento: a comparação ignora acentos.
var CATEGORIAS_PADRAO = [
  ['Energia', 'Ambos', 'luz, energia, eletrica, kwh, enel, cemig, copel, light, celesc, coelba, energisa, equatorial, cpfl, neoenergia, elektro, celpe, cosern, edp, rge, amazonas energia'],
  ['Água', 'Ambos', 'agua, esgoto, saneamento, sabesp, cedae, copasa, sanepar, embasa, compesa, caesb, corsan, casan, saneago, cagece, aguas'],
  ['Internet/Telefone', 'Ambos', 'internet, telefone, celular, fibra, banda larga, wifi, vivo, claro, tim, oi, nio, sky, recarga'],
  ['Aluguel', 'Salão', 'aluguel, locacao, sala comercial, ponto comercial'],
  ['Insumos', 'Salão', 'produto, produtos, shampoo, xampu, condicionador, tinta, coloracao, esmalte, esmaltes, acetona, alicate, lamina, laminas, luva, luvas, descartavel, descartaveis, refrigerante, refrigerantes, refri, agua mineral, cafe, acucar, biscoito, creme, mascara capilar, progressiva, oxidante, descolorante, cera, algodao, toalha, toalhas, escova'],
  ['Manutenção', 'Salão', 'manutencao, conserto, reparo, secador, chapinha, prancha, ar condicionado, ar-condicionado, filtro, cadeira, lavatorio, tecnico, maquina'],
  ['Limpeza', 'Salão', 'limpeza, detergente, desinfetante, alcool, agua sanitaria, sabao, papel toalha, papel higienico, vassoura, faxina, diarista'],
  ['Impostos/Taxas', 'Salão', 'imposto, impostos, mei, das mei, guia das, simples nacional, taxa, taxas, alvara, iss, maquininha, contador, contabilidade, inss'],
  ['Outros do salão', 'Salão', ''],
  ['Moradia', 'Pessoal', 'aluguel, condominio, iptu, gas, botijao'],
  ['Mercado', 'Pessoal', 'mercado, supermercado, feira, acougue, padaria, hortifruti, sacolao, atacadao, assai'],
  ['Transporte', 'Pessoal', 'gasolina, combustivel, etanol, uber, taxi, onibus, metro, estacionamento, ipva, oficina, pneu, passagem'],
  ['Saúde', 'Pessoal', 'farmacia, remedio, remedios, medico, consulta, exame, dentista, plano de saude, hospital, drogaria'],
  ['Lazer', 'Pessoal', 'cinema, restaurante, lanche, pizza, bar, show, viagem, netflix, spotify, streaming, ifood'],
  ['Outros pessoais', 'Pessoal', '']
];

/** Converte linhas [nome, tipo, "palavras"] no formato usado pelo classificador. */
function montarCategorias(linhas) {
  return linhas.map(function (l) {
    return {
      nome: String(l[0]).trim(),
      tipo: normalizarTipo_(l[1]),
      palavras: String(l[2] || '').split(',').map(function (p) { return normalizar(p).trim(); }).filter(String)
    };
  });
}

function normalizarTipo_(t) {
  var n = normalizar(t);
  if (n.indexOf('salao') >= 0) return ORIGEM.SALAO;
  if (n.indexOf('pessoal') >= 0) return ORIGEM.PESSOAL;
  return 'Ambos';
}

function tipoAceita_(tipo, origem) {
  return tipo === 'Ambos' || tipo === origem;
}

function escRegex_(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/**
 * Pontua cada categoria pelas palavras-chave encontradas (palavra inteira, sem acento).
 * Palavras mais longas valem mais ("agua mineral" vence "agua").
 * origem: se informada, só considera categorias compatíveis.
 * soExclusivas: ignora categorias "Ambos".
 */
function classificar(texto, origem, cats, soExclusivas) {
  var t = ' ' + normalizar(texto).replace(/[^a-z0-9\-]+/g, ' ') + ' ';
  var melhor = null;
  cats.forEach(function (c) {
    if (origem && !tipoAceita_(c.tipo, origem)) return;
    if (soExclusivas && c.tipo === 'Ambos') return;
    var pontos = 0;
    c.palavras.forEach(function (p) {
      var re = new RegExp(' ' + escRegex_(p.replace(/[^a-z0-9\-]+/g, ' ').trim()) + '(?= )', 'g');
      var achados = t.match(re);
      if (achados) pontos += achados.length * p.length;
    });
    if (pontos > 0 && (!melhor || pontos > melhor.pontos)) {
      melhor = { categoria: c.nome, tipo: c.tipo, pontos: pontos };
    }
  });
  return melhor;
}

/** Nome da categoria "Outros" de uma origem. */
function outrosDe(origem, cats) {
  var c = cats.filter(function (c) { return c.tipo === origem && normalizar(c.nome).indexOf('outros') === 0; })[0];
  return c ? c.nome : (origem === ORIGEM.SALAO ? 'Outros do salão' : 'Outros pessoais');
}

function tipoDaCategoria(nome, cats) {
  var c = cats.filter(function (c) { return c.nome === nome; })[0];
  return c ? c.tipo : 'Ambos';
}

/**
 * Decide categoria e origem.
 * - Se a origem foi informada, escolhe a melhor categoria compatível.
 * - Se não foi, e a categoria só existe para um lado (ex.: Mercado = Pessoal),
 *   deduz a origem (quando "deduzir" estiver ligado e não houver empate).
 * - Categoria "Ambos" (luz, água, internet) sem origem => origem fica null (o bot pergunta).
 */
function resolverCategoriaEOrigem(texto, origemInformada, cats, deduzir) {
  var origem = origemInformada || null;
  var melhor = classificar(texto, origem, cats, false);
  if (!origem && melhor && deduzir && melhor.tipo !== 'Ambos') {
    var outroLado = melhor.tipo === ORIGEM.SALAO ? ORIGEM.PESSOAL : ORIGEM.SALAO;
    var rival = classificar(texto, outroLado, cats, true);
    if (!rival || rival.pontos < melhor.pontos) origem = melhor.tipo;
  }
  var categoria = melhor ? melhor.categoria : (origem ? outrosDe(origem, cats) : null);
  return { categoria: categoria, origem: origem };
}

/* ===================== Valores e datas ===================== */

/** "1.234,56" / "320,50" / "89.90" / "2000" / "R$150" -> número. null se não for valor. */
function parseValorBR(s) {
  s = String(s == null ? '' : s).toLowerCase().replace(/^r\$/, '').replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(s)) return null;
  var v = null;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) v = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) v = parseFloat(s.replace(/,/g, ''));
  else if (/^\d+(,\d{1,2})?$/.test(s)) v = parseFloat(s.replace(',', '.'));
  else if (/^\d+(\.\d{1,2})?$/.test(s)) v = parseFloat(s);
  return (v != null && v > 0) ? Math.round(v * 100) / 100 : null;
}

/**
 * Monta uma data a partir de dia/mês/ano (ano opcional).
 * Sem ano: para vencimento, usa a próxima ocorrência; para gasto, o ano atual.
 */
function montarData_(dia, mes, ano, ehVencimento, base) {
  dia = Number(dia); mes = Number(mes);
  if (!(dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12)) return null;
  base = soData(base || new Date());
  var a;
  if (ano) {
    a = Number(ano);
    if (a < 100) a += 2000;
  } else {
    a = base.getFullYear();
    var tentativa = new Date(a, mes - 1, dia);
    if (ehVencimento && diasEntre(base, tentativa) < -30) a++;      // "venc 05/01" em dezembro = ano que vem
    if (!ehVencimento && diasEntre(base, tentativa) > 31) a--;      // gasto "20/12" digitado em janeiro = ano passado
  }
  var d = new Date(a, mes - 1, dia);
  return d.getDate() === dia ? d : null; // rejeita 31/02 etc.
}

/** "venc dia 15" -> próxima vez que for dia 15. */
function proximoDia_(dia, base) {
  base = soData(base || new Date());
  dia = Number(dia);
  if (!(dia >= 1 && dia <= 31)) return null;
  for (var i = 0; i < 3; i++) {
    var p = new Date(base.getFullYear(), base.getMonth() + i, 1); // 1º dia do mês candidato
    var d = new Date(p.getFullYear(), p.getMonth(), Math.min(dia, ultimoDiaDoMes(p.getFullYear(), p.getMonth() + 1)));
    if (diasEntre(base, d) >= 0) return d;
  }
  return null;
}

/* ===================== Texto livre ===================== */

var PALAVRAS_VENC = ['venc', 'vence', 'vencimento', 'vencto', 'vcto', 'vto', 'vencendo', 'ate'];
var PALAVRAS_PESSOAL = ['casa', 'pessoal', 'minha', 'meu', 'minhas', 'meus', 'particular', 'residencia', 'lar'];
var PALAVRAS_SALAO = ['salao', 'loja', 'studio', 'estudio', 'negocio', 'trabalho', 'empresa'];
var PALAVRAS_PAGO = ['pago', 'paga', 'paguei', 'quitado', 'quitada', 'pagos', 'pagas'];
var PALAVRAS_PENDENTE = ['pendente', 'aberto', 'apagar'];

/**
 * Interpreta uma mensagem curta. Exemplo:
 *   "luz 320,50 venc 15/12 salão" ->
 *   {valor: 320.5, vencimento: Date(15/12), origem: 'Salão', categoria: 'Energia', descricao: 'Luz'}
 */
function interpretarTexto(texto, cats, deduzir, base) {
  if (deduzir == null) deduzir = true;
  var r = { valor: null, vencimento: null, dataGasto: null, origem: null, categoria: null,
    descricao: '', status: null };
  var bruto = String(texto || '').replace(/r\$\s*/gi, 'R$').trim();
  var tokens = bruto.split(/\s+/).filter(String);
  var norm = tokens.map(function (t) {
    return normalizar(t).replace(/^[^a-z0-9$]+/, '').replace(/[^a-z0-9]+$/, '');
  });
  var usado = tokens.map(function () { return false; });
  var candidatos = [];
  var esperandoVenc = false;

  for (var i = 0; i < tokens.length; i++) {
    var n = norm[i];
    if (!n) { usado[i] = true; continue; }

    // Palavra de vencimento ("venc", "vence", "até"): a próxima data é o vencimento
    if (PALAVRAS_VENC.indexOf(n) >= 0) {
      // "até" só conta como vencimento se vier depois de "pagar" ("pagar até 10/12")
      if (n !== 'ate' || (i > 0 && norm[i - 1] === 'pagar')) {
        usado[i] = true;
        if (n === 'ate') usado[i - 1] = true;
        esperandoVenc = true;
        continue;
      }
    }
    if (esperandoVenc && (n === 'dia' || n === 'em' || n === 'no')) { usado[i] = true; continue; }

    // Datas dd/mm ou dd/mm/aaaa
    var md = n.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2}|\d{4}))?$/);
    if (md && (n.indexOf('/') >= 0 || md[3])) {
      var d = montarData_(md[1], md[2], md[3], esperandoVenc, base);
      if (d) {
        usado[i] = true;
        if (esperandoVenc) r.vencimento = d; else if (!r.dataGasto) r.dataGasto = d;
        esperandoVenc = false;
        continue;
      }
    }
    // "venc 15" / "vence dia 15": só o dia
    if (esperandoVenc && /^\d{1,2}$/.test(n)) {
      var dd = proximoDia_(n, base);
      if (dd) { usado[i] = true; r.vencimento = dd; esperandoVenc = false; continue; }
    }
    esperandoVenc = false;

    // Salão / Pessoal
    if (PALAVRAS_PESSOAL.indexOf(n) >= 0) { if (!r.origem) r.origem = ORIGEM.PESSOAL; usado[i] = true; continue; }
    if (PALAVRAS_SALAO.indexOf(n) >= 0) { if (!r.origem) r.origem = ORIGEM.SALAO; usado[i] = true; continue; }
    // "do salão", "da casa", "pra casa": tira a preposição junto
    // (feito depois, ao montar a descrição)

    // Pago / pendente
    if (PALAVRAS_PAGO.indexOf(n) >= 0) { r.status = 'pago'; usado[i] = true; continue; }
    if (PALAVRAS_PENDENTE.indexOf(n) >= 0) {
      r.status = 'pendente'; usado[i] = true;
      if (n === 'aberto' && i > 0 && norm[i - 1] === 'em') usado[i - 1] = true; // "em aberto"
      continue;
    }
    if (n === 'pagar' && i > 0 && norm[i - 1] === 'a') { r.status = 'pendente'; usado[i] = usado[i - 1] = true; continue; }

    // Valores
    var v = parseValorBR(n);
    if (v != null) {
      candidatos.push({ i: i, v: v, rs: n.indexOf('$') >= 0 || (i > 0 && norm[i - 1] === 'r'),
        dec: /[.,]\d{1,2}$/.test(n) });
    }
  }

  // Escolhe o valor: com "R$" > com centavos > o maior número
  if (candidatos.length) {
    candidatos.sort(function (a, b) {
      if (a.rs !== b.rs) return a.rs ? -1 : 1;
      if (a.dec !== b.dec) return a.dec ? -1 : 1;
      return b.v - a.v;
    });
    r.valor = candidatos[0].v;
    usado[candidatos[0].i] = true;
    if (candidatos[0].i > 0 && norm[candidatos[0].i - 1] === 'r') usado[candidatos[0].i - 1] = true;
  }

  // Descrição = o que sobrou, sem preposições soltas no fim ("luz do" -> "luz")
  var resto = [];
  tokens.forEach(function (t, k) { if (!usado[k]) resto.push(t); });
  while (resto.length && /^(de|do|da|dos|das|pra|para|pro|no|na|em|o|a|e|-|,)$/i.test(normalizar(resto[resto.length - 1]))) resto.pop();
  r.descricao = capitalizar(resto.join(' ').replace(/[,;]+$/, ''));

  var res = resolverCategoriaEOrigem(r.descricao, r.origem, cats, deduzir);
  r.categoria = res.categoria;
  r.origem = res.origem;
  return r;
}

/* ===================== Texto vindo do OCR ===================== */

var ROTULOS_VALOR = ['total a pagar', 'valor a pagar', 'valor do documento', 'valor cobrado',
  'total da fatura', 'valor da fatura', 'valor total', 'total geral', 'valor a ser pago', 'total'];
var ROTULOS_VENC = ['data de vencimento', 'vencimento', 'vencto', 'vence em', 'pagavel ate', 'pagar ate', 'venc'];

var RE_DINHEIRO = /(?:r\$\s*)?(?<![\d.,])((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})(?![\d,])/g;
var RE_DATA = /(?<!\d)(\d{2})[\/.\-](\d{2})[\/.\-](\d{4}|\d{2})(?!\d)/g;

function dinheiroNaLinha_(linha) {
  var achados = [], m;
  RE_DINHEIRO.lastIndex = 0;
  while ((m = RE_DINHEIRO.exec(linha)) !== null) {
    achados.push({ v: parseValorBR(m[1]), rs: /r\$/.test(m[0]) });
  }
  return achados.filter(function (a) { return a.v; });
}

function datasNaLinha_(linha) {
  var achados = [], m;
  RE_DATA.lastIndex = 0;
  while ((m = RE_DATA.exec(linha)) !== null) {
    var d = montarData_(m[1], m[2], m[3], true);
    if (d) achados.push(d);
  }
  return achados;
}

/** Procura um rótulo e devolve o que "pegar" acharem na mesma linha (depois do rótulo) ou nas 3 seguintes. */
function procurarPorRotulo_(linhasNorm, rotulos, pegar) {
  for (var r = 0; r < rotulos.length; r++) {
    var re = new RegExp('(^|[^a-z])' + escRegex_(rotulos[r]) + '([^a-z]|$)');
    for (var i = 0; i < linhasNorm.length; i++) {
      var m = linhasNorm[i].match(re);
      if (!m) continue;
      var resto = linhasNorm[i].slice(m.index + m[0].length - 1);
      var achou = pegar(resto);
      for (var j = 1; !achou.length && j <= 3 && i + j < linhasNorm.length; j++) achou = pegar(linhasNorm[i + j]);
      if (achou.length) return achou[0];
    }
  }
  return null;
}

/**
 * Extrai valor, vencimento e empresa do texto lido de uma conta/boleto/nota.
 * Devolve {valor, vencimento, empresa} (campos podem vir null).
 */
function extrairDadosOcr(texto, base) {
  var linhas = String(texto || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(String);
  var norm = linhas.map(normalizar);
  var r = { valor: null, vencimento: null, empresa: null };

  var v = procurarPorRotulo_(norm, ROTULOS_VALOR, dinheiroNaLinha_);
  if (v) r.valor = v.v;
  if (!r.valor) {
    // Sem rótulo: maior valor precedido de "R$"
    var todos = [];
    norm.forEach(function (l) { todos = todos.concat(dinheiroNaLinha_(l).filter(function (a) { return a.rs; })); });
    if (todos.length) r.valor = Math.max.apply(null, todos.map(function (a) { return a.v; }));
  }

  // Só aceita vencimento com rótulo: cupons fiscais têm data de emissão, que não é vencimento
  r.vencimento = procurarPorRotulo_(norm, ROTULOS_VENC, datasNaLinha_);

  // Empresa: linha antes do CNPJ, senão a primeira linha com cara de nome
  var pareceNome = function (l) {
    var letras = (l.match(/[A-Za-zÀ-ú]/g) || []).length;
    return letras >= 4 && letras / l.length > 0.5;
  };
  for (var i = 0; i < norm.length; i++) {
    if (/cnpj/.test(norm[i])) {
      var antes = norm[i].split('cnpj')[0];
      if (pareceNome(antes.trim())) { r.empresa = linhas[i].slice(0, antes.trim().length); break; }
      if (i > 0 && pareceNome(linhas[i - 1])) { r.empresa = linhas[i - 1]; break; }
    }
  }
  if (!r.empresa) {
    for (var k = 0; k < Math.min(linhas.length, 6); k++) {
      if (pareceNome(linhas[k])) { r.empresa = linhas[k]; break; }
    }
  }
  if (r.empresa) r.empresa = r.empresa.replace(/[\s:\-–]+$/, '').slice(0, 40);
  return r;
}

/* ===================== OCR com o Drive ===================== */

/**
 * Converte a imagem/PDF em Google Docs com OCR em português, lê o texto e apaga o documento.
 * Funciona com o Serviço Avançado do Drive na versão v3 (padrão) ou v2.
 */
function ocrBlob_(blob, pastaId) {
  if (typeof Drive === 'undefined') {
    throw new Error('Serviço avançado "Drive" não está ativado. Veja o README, passo 4.');
  }
  var docId;
  if (Drive.Files.create) { // v3
    var meta3 = { name: 'ocr_temp_' + Date.now(), mimeType: 'application/vnd.google-apps.document' };
    if (pastaId) meta3.parents = [pastaId];
    docId = Drive.Files.create(meta3, blob, { ocrLanguage: 'pt' }).id;
  } else { // v2
    var meta2 = { title: 'ocr_temp_' + Date.now(), mimeType: blob.getContentType() };
    if (pastaId) meta2.parents = [{ id: pastaId }];
    docId = Drive.Files.insert(meta2, blob, { ocr: true, ocrLanguage: 'pt' }).id;
  }
  try {
    return DocumentApp.openById(docId).getBody().getText();
  } finally {
    try { DriveApp.getFileById(docId).setTrashed(true); } catch (e) { /* ignora */ }
  }
}

/* ===================== Gemini (opcional, desligado por padrão) ===================== */

/**
 * Só é chamado se Config "usar_gemini" = sim E existir GEMINI_API_KEY nas Propriedades,
 * e apenas quando o OCR não achou o valor. Devolve {valor, vencimento, empresa} ou null.
 */
function geminiExtrair_(blob) {
  var chave = prop_('GEMINI_API_KEY');
  if (!chave) return null;
  var modelo = prop_('GEMINI_MODEL') || 'gemini-2.5-flash';
  var pedido = 'Esta imagem é uma conta, boleto ou nota fiscal brasileira. Responda SOMENTE um JSON ' +
    '{"valor": número com ponto decimal ou null, "vencimento": "dd/mm/aaaa" ou null, "empresa": texto curto ou null}. ' +
    'valor = total a pagar.';
  var corpo = {
    contents: [{ parts: [
      { text: pedido },
      { inline_data: { mime_type: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) } }
    ] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' }
  };
  var resp = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + modelo + ':generateContent', {
    method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': chave },
    payload: JSON.stringify(corpo), muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200) {
    registrarLog_('gemini', 'HTTP ' + resp.getResponseCode() + ': ' + resp.getContentText().slice(0, 300));
    return null;
  }
  var texto = JSON.parse(resp.getContentText()).candidates[0].content.parts[0].text;
  var j = JSON.parse(texto.replace(/```json|```/g, '').trim());
  var venc = null;
  var m = String(j.vencimento || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) venc = montarData_(m[1], m[2], m[3], true);
  var valor = typeof j.valor === 'number' ? j.valor : parseValorBR(j.valor);
  return { valor: valor > 0 ? Math.round(valor * 100) / 100 : null, vencimento: venc, empresa: j.empresa || null };
}
