/**
 * Alertas.gs — alertas automáticos (gatilho diário), resumos e aviso de gasto acima da média.
 */

/**
 * Roda todo dia às 8h (gatilho criado pelo setup()).
 * 1) cria as contas fixas do mês  2) avisa vencimentos (3 dias, 1 dia, hoje)
 * 3) avisa contas vencidas  4) avisa manutenções  5) dia 1º: resumo do mês anterior
 */
function alertasDiarios() {
  try {
    var cfg = lerConfig_();
    if (!cfg.chats.length) return;
    gerarContasFixas_();
    invalidarLancs_();
    var h = hoje();

    // --- Vencendo (3 dias, 1 dia, hoje) e vencidas ---
    var vencendo = [], vencidas = [];
    pendentes_().forEach(function (l) {
      if (!l.vencimento) return;
      var dias = diasEntre(h, l.vencimento);
      if (dias < 0) vencidas.push(l);
      else if (cfg.diasAlerta.indexOf(dias) >= 0) vencendo.push(l);
    });
    vencendo.sort(porVencimento_);
    vencidas.sort(porVencimento_);

    vencendo.forEach(function (l) {
      var dias = diasEntre(h, l.vencimento);
      var quando = dias === 0 ? '⏰ <b>VENCE HOJE</b>' : dias === 1 ? '⏳ Vence <b>amanhã</b>' : '📅 Vence em <b>' + dias + ' dias</b>';
      enviarParaTodos_(quando + ' (' + fmtData(l.vencimento) + ')\n' + linhaConta_(l),
        [[botao('✅ Já paguei', 'pg|' + l.id)]]);
    });

    if (vencidas.length) {
      var texto = '🔴 <b>Contas vencidas e não pagas</b>\n\n' + vencidas.map(function (l) {
        return '• ' + linhaConta_(l) + '\n   venceu ' + fmtData(l.vencimento) + ' (' + (-diasEntre(h, l.vencimento)) + ' dia(s))';
      }).join('\n');
      enviarParaTodos_(texto, tecladoPaguei_(vencidas));
    }

    // --- Manutenções ---
    lerManutencoes_().forEach(function (m) {
      if (!m.proxima) return;
      var dias = diasEntre(h, m.proxima);
      if (dias > cfg.diasManut) return;
      var quando = dias < 0 ? 'está <b>atrasada ' + (-dias) + ' dia(s)</b>' : dias === 0 ? 'é <b>hoje</b>' : 'vence em <b>' + dias + ' dia(s)</b>';
      enviarParaTodos_('🔧 Manutenção: <b>' + esc(m.equipamento) + '</b> ' + quando + ' (' + fmtData(m.proxima) + ')',
        [[botao('✅ Feito hoje', 'mf|' + m.linha)]]);
    });

    // --- Dia 1º: resumo do mês que acabou ---
    if (h.getDate() === 1) {
      var ref = mesAnterior(mesRef(h), 1);
      enviarParaTodos_(montarResumo_(ref, true, true));
    }

    atualizarPainel();
    limparLog_();
  } catch (err) {
    registrarErro_('alertasDiarios', err);
  }
}

var _alertasEnviados = 0;

function enviarParaTodos_(texto, teclado) {
  _alertasEnviados++;
  lerConfig_().chats.forEach(function (c) { enviar(c, texto, teclado); });
}

/** Menu "Testar alertas agora": roda o alerta diário na hora e diz quantos avisos saíram. */
function testarAlertasAgora() {
  var ui = SpreadsheetApp.getUi();
  _alertasEnviados = 0;
  alertasDiarios();
  if (_alertasEnviados) {
    ui.alert('Alertas enviados: ' + _alertasEnviados, 'Confira o Telegram. 🔔', ui.ButtonSet.OK);
  } else {
    ui.alert('Nenhuma conta para avisar agora',
      'Os avisos saem para contas a pagar que vencem hoje, amanhã ou em 3 dias, para contas vencidas e para manutenções.\n\n' +
      'Para testar: no Telegram mande "luz 350 salão" → ⏳ Ainda vou pagar → Amanhã → ✅ Confirmar.\n' +
      'Depois clique de novo em "Testar alertas agora".', ui.ButtonSet.OK);
  }
}

function porVencimento_(a, b) {
  return new Date(a.vencimento || a.dataGasto) - new Date(b.vencimento || b.dataGasto);
}

function linhaConta_(l) {
  return emojiOrigem(l.origem) + ' nº ' + l.id + ' · ' + esc(l.descricao || l.categoria) + ' · <b>' + fmtValor(l.valor) + '</b>';
}

/** Um botão "Paguei nº X" por conta (até 20 para não poluir). */
function tecladoPaguei_(lista) {
  return lista.slice(0, 20).map(function (l) {
    return [botao('✅ Paguei nº ' + l.id + ' (' + fmtValor(l.valor) + ')', 'pg|' + l.id)];
  });
}

/** /vencimentos (próximos N dias + vencidas) ou /pendentes (todas). */
function enviarListaContas_(chatId, modo) {
  var cfg = lerConfig_();
  var h = hoje();
  var lista = pendentes_().filter(function (l) {
    if (modo === 'pendentes') return true;
    return l.vencimento && diasEntre(h, l.vencimento) <= cfg.diasProximos;
  }).sort(porVencimento_);

  var titulo = modo === 'pendentes' ? '⏳ <b>Contas a pagar</b>' : '📅 <b>Vencimentos (próximos ' + cfg.diasProximos + ' dias)</b>';
  if (!lista.length) {
    return enviar(chatId, titulo + '\n\nNada pendente. 🎉');
  }
  var totais = {};
  totais[ORIGEM.SALAO] = 0; totais[ORIGEM.PESSOAL] = 0;
  var linhas = lista.map(function (l) {
    totais[l.origem] = (totais[l.origem] || 0) + l.valor;
    var marca = '';
    if (l.vencimento) {
      var dias = diasEntre(h, l.vencimento);
      marca = dias < 0 ? ' 🔴 venceu ' + fmtData(l.vencimento) : dias === 0 ? ' 🟠 vence HOJE' : ' · vence ' + fmtData(l.vencimento);
    }
    return '• ' + linhaConta_(l) + marca;
  });
  var rodape = '\n\n🏪 Salão: ' + fmtValor(totais[ORIGEM.SALAO]) + '\n🏠 Pessoal: ' + fmtValor(totais[ORIGEM.PESSOAL]) +
    '\n💵 Total: <b>' + fmtValor(totais[ORIGEM.SALAO] + totais[ORIGEM.PESSOAL]) + '</b>';
  enviar(chatId, titulo + '\n\n' + linhas.join('\n') + rodape, tecladoPaguei_(lista));
}

/**
 * Texto de resumo de um mês (ref = AAAAMM).
 * detalhado = inclui maiores gastos; mensal = cabeçalho do resumo automático do dia 1º.
 */
function montarResumo_(ref, detalhado, mensal) {
  var lancs = listarLancamentos_();
  var refAnt = mesAnterior(ref, 1);
  var doMes = lancs.filter(function (l) { return l.mesRef === ref; });

  var soma = function (ref2, origem) {
    return lancs.reduce(function (s, l) {
      return s + ((l.mesRef === ref2 && (!origem || l.origem === origem)) ? l.valor : 0);
    }, 0);
  };
  var media3 = function (origem) {
    return (soma(mesAnterior(ref, 1), origem) + soma(mesAnterior(ref, 2), origem) + soma(mesAnterior(ref, 3), origem)) / 3;
  };

  var s = soma(ref, ORIGEM.SALAO), p = soma(ref, ORIGEM.PESSOAL), t = s + p;
  var sA = soma(refAnt, ORIGEM.SALAO), pA = soma(refAnt, ORIGEM.PESSOAL), tA = sA + pA;

  var linhas = [];
  linhas.push(mensal ? '🗓️ <b>Fechamento de ' + nomeMes(ref) + '</b>' : '📊 <b>Resumo de ' + nomeMes(ref) + '</b>');
  linhas.push('');
  linhas.push('🏪 Salão: <b>' + fmtValor(s) + '</b>  (' + fmtVariacao(s, sA) + ' vs mês anterior)');
  linhas.push('🏠 Pessoal: <b>' + fmtValor(p) + '</b>  (' + fmtVariacao(p, pA) + ')');
  linhas.push('💵 Total: <b>' + fmtValor(t) + '</b>  (' + fmtVariacao(t, tA) + ')');
  if (detalhado) {
    linhas.push('📈 Média dos 3 meses anteriores: Salão ' + fmtValor(media3(ORIGEM.SALAO)) +
      ' · Pessoal ' + fmtValor(media3(ORIGEM.PESSOAL)));
  }

  if (!doMes.length) {
    linhas.push('', 'Nenhum lançamento neste mês.');
    return linhas.join('\n');
  }

  // Por categoria, separado por origem
  [ORIGEM.SALAO, ORIGEM.PESSOAL].forEach(function (origem) {
    var porCat = {};
    doMes.forEach(function (l) { if (l.origem === origem) porCat[l.categoria] = (porCat[l.categoria] || 0) + l.valor; });
    var cats = Object.keys(porCat).sort(function (a, b) { return porCat[b] - porCat[a]; });
    if (!cats.length) return;
    linhas.push('', emojiOrigem(origem) + ' <b>' + origem + ' por categoria</b>');
    cats.forEach(function (c) { linhas.push('• ' + esc(c) + ': ' + fmtValor(porCat[c])); });
  });

  if (detalhado) {
    var maiores = doMes.slice().sort(function (a, b) { return b.valor - a.valor; }).slice(0, 5);
    linhas.push('', '🔝 <b>Maiores gastos</b>');
    maiores.forEach(function (l) { linhas.push('• ' + linhaConta_(l)); });
  }

  var abertas = doMes.filter(function (l) { return l.status !== 'pago'; });
  if (abertas.length) {
    var totalAberto = abertas.reduce(function (x, l) { return x + l.valor; }, 0);
    linhas.push('', (mensal ? '⚠️ <b>Ficaram sem pagar</b>' : '⏳ <b>Ainda a pagar</b>') +
      ': ' + abertas.length + ' conta(s), ' + fmtValor(totalAberto));
    if (detalhado) abertas.forEach(function (l) { linhas.push('• ' + linhaConta_(l)); });
  } else {
    linhas.push('', '✅ Todas as contas do mês estão pagas.');
  }
  return linhas.join('\n');
}

/**
 * Depois de salvar: compara o total da categoria+origem neste mês com a média
 * dos 3 meses anteriores (só meses com gasto). Devolve o texto do alerta ou null.
 */
function verificarAnomalia_(lanc) {
  invalidarLancs_();
  var cfg = lerConfig_();
  var ref = lanc.mesRef;
  var atual = somaMes_(ref, lanc.categoria, lanc.origem);
  var historico = [1, 2, 3].map(function (n) { return somaMes_(mesAnterior(ref, n), lanc.categoria, lanc.origem).total; })
    .filter(function (v) { return v > 0; });
  if (!historico.length) return null;
  var media = historico.reduce(function (a, b) { return a + b; }, 0) / historico.length;
  var p = Math.round((atual.total / media - 1) * 100);
  if (p <= cfg.pctAnomalia) return null;

  var dono = lanc.origem === ORIGEM.SALAO ? 'do salão' : 'pessoal';
  var meses = historico.length === 3 ? 'dos últimos 3 meses' : 'dos últimos meses';
  if (atual.qtd <= 1) {
    return '⚠️ A conta de <b>' + esc(lanc.categoria) + '</b> ' + dono + ' veio <b>' + p + '% acima</b> da média ' + meses +
      ' (' + fmtValor(lanc.valor) + ' contra ' + fmtValor(media) + ').';
  }
  return '⚠️ Os gastos com <b>' + esc(lanc.categoria) + '</b> ' + dono + ' neste mês já somam ' + fmtValor(atual.total) +
    ', <b>' + p + '% acima</b> da média ' + meses + ' (' + fmtValor(media) + ').';
}
