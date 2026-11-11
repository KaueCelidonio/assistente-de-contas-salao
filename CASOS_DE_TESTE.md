# Casos de teste

Os casos **A** e **B** estão automatizados em `src/Testes.gs`. Rode `testarTodos()`: o resultado esperado é `31 de 31 testes passaram.`
(As datas consideram "hoje" = 10/11/2026.)
Os casos **C** a **F** são testes manuais, feitos no Telegram.

"Perguntar" = o bot mostra os botões **🏪 Salão / 🏠 Pessoal** antes de liberar o ✅ Confirmar.

## A. Texto livre

| # | Mensagem | Valor | Categoria | Origem | Vencimento / outros |
|---|---|---|---|---|---|
| A1 | `luz 320,50 venc 15/12 salão` | 320,50 | Energia | Salão | 15/12/2026, a pagar |
| A2 | `manutenção secador 150` | 150,00 | Manutenção | Salão (deduzido) | já pago |
| A3 | `mercado 230 casa` | 230,00 | Mercado | Pessoal | já pago |
| A4 | `compra refrigerante 89,90` | 89,90 | Insumos | Salão (deduzido) | |
| A5 | `luz 412 salão` | 412,00 | Energia | Salão | |
| A6 | `luz 230 casa` | 230,00 | Energia | Pessoal | |
| A7 | `aluguel 2000 salão` | 2.000,00 | Aluguel | Salão | |
| A8 | `aluguel 1500 casa` | 1.500,00 | Moradia | Pessoal | |
| A9 | `aluguel 2000` | 2.000,00 | (Aluguel ou Moradia) | **Perguntar** (empate) | |
| A10 | `internet 99,90` | 99,90 | Internet/Telefone | **Perguntar** (Ambos) | |
| A11 | `água 1.234,56 venc 05/01` | 1.234,56 | Água | **Perguntar** | 05/01/**2027** (próximo ano) |
| A12 | `gasolina R$ 150 pago` | 150,00 | Transporte | Pessoal | status pago |
| A13 | `shampoo 2 frascos 89.90` | 89,90 (não 2) | Insumos | Salão | |
| A14 | `conta de luz da casa 180 vence dia 20` | 180,00 | Energia | Pessoal | 20/11/2026, descrição "Conta de luz" |
| A15 | `farmácia 45,7` | 45,70 | Saúde | Pessoal | |
| A16 | `das mei 75,90 venc 20/11` | 75,90 | Impostos/Taxas | Salão | 20/11/2026 |
| A17 | `filtro ar condicionado 80 loja` | 80,00 | Manutenção | Salão | |
| A18 | `padaria 12` | 12,00 | Mercado | Pessoal | |
| A19 | `presente aniversário 100` | 100,00 | (Outros, após escolher) | **Perguntar** | |
| A20 | `luz` | **pede o valor** | Energia | | |
| A21 | `detergente e desinfetante 35,00 a pagar` | 35,00 | Limpeza | Salão | status pendente |
| A22 | `agua mineral 20` | 20,00 | Insumos (não Água) | Salão | |
| A23 | `conserto geladeira 300 casa` | 300,00 | Outros pessoais | Pessoal | |
| A24 | `aluguel 2.500 venc 10/12 salão` | 2.500,00 | Aluguel | Salão | 10/12/2026 |
| A25 | `esmaltes 64,50 em 08/11` | 64,50 | Insumos | Salão | data do gasto 08/11/2026 |
| A26 | `telefone celular 59,99 minha` | 59,99 | Internet/Telefone | Pessoal | |
| A27 | `qualquer coisa` | — | — | — | responde "Não entendi" com exemplos |

## B. Texto de OCR (simulado)

| # | Tipo de documento | Esperado |
|---|---|---|
| B1 | Conta de luz Enel ("Vencimento" e a data na linha seguinte, "Total a pagar R$ 312,45") | 312,45 · venc 15/12/2026 · empresa ENEL · Energia |
| B2 | Boleto de aluguel ("Valor do documento 2.000,00"; "vencimento" aparece antes, sem data, em "Pagável até o vencimento") | 2.000,00 · venc 10/12/2026 · Aluguel · perguntar origem |
| B3 | Cupom fiscal de supermercado ("Subtotal 34,35" / "TOTAL R$ 34,35"; data de emissão sem rótulo) | 34,35 · **sem** vencimento · Mercado · já pago |
| B4 | Conta Sabesp ("Data de vencimento: 20/11/2026", "Valor a pagar R$ 98,10") | 98,10 · 20/11/2026 · Água |
| B5 | Foto ilegível | valor nulo → bot pede para digitar |

## C. Fotos reais (manual, no Telegram)

| # | Foto | Esperado |
|---|---|---|
| C1 | Conta de luz nítida, sem legenda | Lê valor e vencimento, categoria Energia, **pergunta** Salão/Pessoal |
| C2 | Mesma conta com legenda `salão` | Já vem como Salão, sem perguntar |
| C3 | Conta com legenda `390` | O valor da legenda (390) substitui o do OCR |
| C4 | Foto torta ou escura | Se não achar o valor: "Não consegui ler o valor… digite" → digitar `152,30` → mostra o rascunho |
| C5 | Cupom de compra de produtos (shampoo, tinta) | Insumos, Salão, já pago |
| C6 | Boleto em **PDF** enviado como arquivo | Lido igual à foto |
| C7 | Arquivo .docx ou áudio | "Esse tipo de arquivo eu não leio" |
| C8 | Foto → ❌ Cancelar | Nada gravado. A foto vai para a lixeira do Drive |
| C9 | Foto → ✅ Confirmar | Linha com `entrada = foto` e `link_foto_drive` preenchido |

## D. Botões e fluxo

| # | Ação | Esperado |
|---|---|---|
| D1 | ✏️ Corrigir valor → digitar `245,10` | Rascunho mostra R$ 245,10 |
| D2 | 🏷️ Trocar categoria | Mostra só as categorias compatíveis com a origem → escolher → atualiza |
| D3 | 🔄 Trocar Salão/Pessoal num "Mercado" | Vira Salão e a categoria passa para "Outros do salão" (Mercado é só Pessoal) |
| D4 | Tocar ✅ Confirmar duas vezes rápido | Só **uma** linha gravada. O 2º toque responde "Já estava salvo" |
| D5 | Tocar um botão de um rascunho com mais de 6 h | "Esse lançamento expirou" |
| D6 | `luz 300 salão` com histórico de 200, 220, 210 nos 3 meses anteriores | ⚠️ "A conta de Energia do salão veio 43% acima da média…" |
| D7 | Conta fixa "Internet do salão" pendente no mês + mandar `internet 129,90 salão` | Atualiza a conta fixa (sem duplicar), que continua *a pagar* |

## E. Comandos

| # | Comando | Esperado |
|---|---|---|
| E1 | `/start`, `/ajuda` | Ajuda com exemplos e comandos |
| E2 | `/resumo` | Totais Salão / Pessoal / Total + variação vs mês anterior + por categoria |
| E3 | `/mes 10/2026` | Resumo detalhado de outubro (média 3 meses, maiores gastos) |
| E4 | `/mes outubro` | "Use assim: /mes 10/2026" |
| E5 | `/vencimentos` | Pendentes com vencimento até 15 dias (e vencidas), com botões "Paguei nº" |
| E6 | `/pendentes` → tocar "Paguei nº 7" | Conta 7 vira paga. Só o botão dela some |
| E7 | `/pago 12` / `/pago 999` | Marca como paga / "Não achei a conta nº 999" |
| E8 | `/desfazer` | Apaga o último lançamento e mostra qual foi. O número **não** é reaproveitado |
| E9 | `/manutencao feito filtro` | última_data = hoje; próxima = hoje + periodicidade |
| E10 | `/categorias` | Lista separada em Salão, Pessoal e Ambos |

## F. Segurança, robustez e alertas

| # | Situação | Esperado |
|---|---|---|
| F1 | POST sem `?key=` ou com chave errada | Ignorado (nenhuma resposta) |
| F2 | Chat não autorizado, lista vazia | Bot informa o chat_id |
| F3 | Chat não autorizado, lista preenchida | Ignorado em silêncio, registrado no Log |
| F4 | Mesmo `update_id` enviado 2 vezes | Processado uma vez só |
| F5 | Erro interno (ex.: aba apagada) | "Deu um erro aqui…" + linha `erro` no Log, sem derrubar o bot |
| F6 | `alertasDiarios()` com uma conta vencendo em 3 dias | "📅 Vence em 3 dias" + botão ✅ Já paguei |
| F7 | `alertasDiarios()` com uma conta vencida há 2 dias | "🔴 Contas vencidas e não pagas" com botões |
| F8 | Manutenção com próxima_data amanhã | "🔧 Manutenção: … vence em 1 dia(s)" + ✅ Feito hoje |
| F9 | Dia 1º do mês | "🗓️ Fechamento de <mês>" com Salão, Pessoal, total, variação, maiores gastos e contas sem pagar |
| F10 | Conta fixa com dia 10 cadastrada no dia 20 | Não cria a do mês atual (já passou). Cria a do mês seguinte quando entrar na janela de 15 dias |
