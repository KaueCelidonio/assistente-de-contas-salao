# 📒 Manual do Assistente de Contas

Você cuida do salão, e o assistente anota as contas para você. Tudo pelo **Telegram**.
Você não precisa abrir planilha nenhuma.

---

## 1. Como mandar uma conta

**Jeito 1: foto 📷**
Tire uma foto da conta, do boleto ou da nota e mande para o bot.
Dica: foto reta, com luz, mostrando o **valor total** e o **vencimento**.

**Jeito 2: escrevendo ✍️**
Escreva **o que é + o valor**. Exemplos:

| Você escreve | O bot entende |
|---|---|
| `luz 230 salão` | Conta de luz do salão, R$ 230 |
| `mercado 150 casa` | Mercado de casa, R$ 150 |
| `aluguel 2000 venc 10/12 salão` | Aluguel do salão, vence dia 10/12 |
| `refrigerante 89,90` | Compra para o salão, R$ 89,90 |
| `manutenção secador 150` | Conserto do secador, R$ 150 |

Pode usar vírgula ou ponto: `89,90` ou `89.90`.

**Depois disso, o bot mostra um resumo com botões:**
✅ **Confirmar** (salva) · ✏️ **Corrigir valor** · 🏷️ **Trocar categoria** · 🔄 **Trocar Salão/Pessoal** · ❌ **Cancelar**

👉 **Nada é salvo até você tocar em ✅ Confirmar.**

---

## 2. Salão ou Pessoal? 🏪🏠

O mais importante é **não misturar** as contas do salão com as suas.

- Escreva **salão** ou **loja** → vai para o **Salão** 🏪
- Escreva **casa**, **pessoal** ou **minha** → vai para o **Pessoal** 🏠
- Se você não escrever, o bot **pergunta** com dois botões: **🏪 Salão** ou **🏠 Pessoal**.

Errou? Toque em **🔄 Trocar Salão/Pessoal** antes de confirmar.

---

## 3. Marcar uma conta como paga ✅

- Quando o bot avisar de uma conta, toque em **✅ Já paguei**.
- Ou mande `/pendentes` e toque em **Paguei nº ...**.
- Ou escreva `/pago 12` (12 é o número da conta, que aparece nas mensagens).

Se você mandar só `luz 350`, o bot pergunta **"Essa conta já foi paga?"**:
- **✅ Já paguei**: fica registrada como paga.
- **⏳ Ainda vou pagar**: ele pergunta **quando vence** (toque em Hoje, Amanhã ou Em 7 dias, ou digite a data, ex.: `15/12`) e avisa você antes do vencimento.

Se você já escrever o vencimento (`luz 350 venc 15/12`), ele não pergunta: já entende que é **a pagar**.

---

## 4. O que cada aviso quer dizer

| Aviso | Significado | O que fazer |
|---|---|---|
| 📅 **Vence em 3 dias** | Ainda dá tempo | Separe o dinheiro |
| ⏳ **Vence amanhã** | Último dia antes do vencimento | Pague hoje ou amanhã |
| ⏰ **VENCE HOJE** | Hoje é o dia | Pague e toque em ✅ Já paguei |
| 🔴 **Contas vencidas** | Passou do dia e não foi marcada como paga | Pague (pode ter multa) ou, se já pagou, toque em ✅ |
| 🔧 **Manutenção** | Está na hora de cuidar de um equipamento (ex.: filtro do ar) | Depois de fazer, toque em ✅ Feito hoje |
| ⚠️ **Acima da média** | Essa conta veio bem mais cara que nos últimos meses | Confira se não houve erro ou desperdício |
| 🗓️ **Fechamento do mês** (todo dia 1º) | Quanto gastou no Salão, em Casa e no total | Compare com o mês anterior |

Os avisos chegam **todo dia às 8h**.

---

## 5. Comandos úteis (é só tocar no menu **/** do Telegram)

| Comando | Para quê |
|---|---|
| `/resumo` | Quanto gastei este mês (Salão, Pessoal e total) |
| `/vencimentos` | O que vence nos próximos dias |
| `/pendentes` | Tudo que falta pagar |
| `/mes 10/2026` | Resumo de outro mês |
| `/desfazer` | Apaga o último lançamento (se mandou errado) |
| `/manutencao` | Lista as manutenções dos equipamentos |
| `/ajuda` | Mostra as instruções |

**Dúvida ou algo estranho?** Fale com quem configurou o bot.
