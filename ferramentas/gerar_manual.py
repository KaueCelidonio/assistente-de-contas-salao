from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table,
                                TableStyle, PageBreak, KeepTogether, NextPageTemplate)
import sys

SAIDA = sys.argv[1]
F = "C:/Windows/Fonts/"
pdfmetrics.registerFont(TTFont("Arial", F + "arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-B", F + "arialbd.ttf"))
pdfmetrics.registerFont(TTFont("Arial-I", F + "ariali.ttf"))
pdfmetrics.registerFont(TTFont("Arial-BI", F + "arialbi.ttf"))
from reportlab.pdfbase.pdfmetrics import registerFontFamily
registerFontFamily("Arial", normal="Arial", bold="Arial-B", italic="Arial-I", boldItalic="Arial-BI")

ROXO = colors.HexColor("#6B2D7B")
ROXO_CLARO = colors.HexColor("#F3E8F6")
CINZA = colors.HexColor("#555555")
VERDE = colors.HexColor("#E7F5EA")
AMARELO = colors.HexColor("#FFF6DD")
BORDA = colors.HexColor("#D9C6DE")

base = ParagraphStyle("base", fontName="Arial", fontSize=11, leading=15.5, textColor=colors.HexColor("#222222"))
corpo = ParagraphStyle("corpo", parent=base, spaceAfter=6)
h1 = ParagraphStyle("h1", parent=base, fontName="Arial-B", fontSize=17, leading=22, textColor=ROXO, spaceBefore=6, spaceAfter=8)
h2 = ParagraphStyle("h2", parent=base, fontName="Arial-B", fontSize=12.5, leading=17, textColor=ROXO, spaceBefore=8, spaceAfter=4)
cel = ParagraphStyle("cel", parent=base, fontSize=10, leading=13.5)
celb = ParagraphStyle("celb", parent=cel, fontName="Arial-B", textColor=colors.white)
nota = ParagraphStyle("nota", parent=base, fontSize=10.5, leading=14.5)
item = ParagraphStyle("item", parent=corpo, leftIndent=16, bulletIndent=4, spaceAfter=3)


def B(t):
    """Botão do Telegram, desenhado como texto destacado."""
    return f'<font name="Arial-B" color="#6B2D7B" backColor="#F3E8F6">&nbsp;{t}&nbsp;</font>'


def M(t):
    """Mensagem para digitar."""
    return f'<font name="Arial-B" color="#1F5FA8">{t}</font>'


def P(t, s=corpo):
    return Paragraph(t, s)


def lista(itens, numerada=False):
    out = []
    for i, t in enumerate(itens, 1):
        out.append(Paragraph(t, item, bulletText=(f"{i}." if numerada else "•")))
    return out


def tabela(linhas, larguras):
    dados = [[Paragraph(c, celb) for c in linhas[0]]] + [[Paragraph(c, cel) for c in l] for l in linhas[1:]]
    t = Table(dados, colWidths=larguras, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), ROXO),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAF6FB")]),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDA),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def caixa(texto, fundo=AMARELO, titulo=None):
    conteudo = (f'<font name="Arial-B">{titulo}</font><br/>' if titulo else "") + texto
    t = Table([[Paragraph(conteudo, nota)]], colWidths=[170 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), fundo), ("BOX", (0, 0), (-1, -1), 0.6, BORDA),
        ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


def tela(linhas):
    """Imitação simples de uma mensagem do bot."""
    t = Table([[Paragraph(l, nota)] for l in linhas], colWidths=[105 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white), ("BOX", (0, 0), (-1, -1), 0.8, ROXO),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, 0), 8), ("BOTTOMPADDING", (0, -1), (-1, -1), 8),
    ]))
    t.hAlign = "LEFT"
    return t


# ---------- Páginas ----------
def capa(c, doc):
    w, h = A4
    c.setFillColor(ROXO)
    c.rect(0, h - 120 * mm, w, 120 * mm, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Arial-B", 30)
    c.drawString(22 * mm, h - 62 * mm, "Assistente de Contas")
    c.setFont("Arial", 16)
    c.drawString(22 * mm, h - 74 * mm, "Manual de uso do robô no Telegram")
    c.setFont("Arial", 11.5)
    c.drawString(22 * mm, h - 100 * mm, "Fio a Fio Cabelo e Art")
    c.setFillColor(CINZA)
    c.setFont("Arial", 9)
    c.drawString(22 * mm, 15 * mm, "Versão 1 · novembro de 2026")


def rodape(c, doc):
    w, h = A4
    c.setStrokeColor(BORDA)
    c.line(20 * mm, 14 * mm, w - 20 * mm, 14 * mm)
    c.setFont("Arial", 8.5)
    c.setFillColor(CINZA)
    c.drawString(20 * mm, 9 * mm, "Assistente de Contas · Manual de uso")
    c.drawRightString(w - 20 * mm, 9 * mm, f"Página {doc.page}")


doc = BaseDocTemplate(SAIDA, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm,
                      bottomMargin=20 * mm, title="Assistente de Contas - Manual de uso",
                      author="Projeto de extensão", subject="Manual do robô de contas no Telegram")
fr = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="f")
fr_capa = Frame(doc.leftMargin, doc.bottomMargin + 10 * mm, doc.width, 140 * mm, id="fc")
doc.addPageTemplates([PageTemplate(id="capa", frames=[fr_capa], onPage=capa),
                      PageTemplate(id="normal", frames=[fr], onPage=rodape)])

s = []
# Capa: resumo
s.append(P("<font name='Arial-B' size='13' color='#6B2D7B'>Em uma frase</font>"))
s.append(P("Você manda a <b>foto</b> ou um <b>texto curto</b> da conta pelo Telegram. O robô anota, separa o que é do "
           "<b>Salão</b> e o que é <b>Pessoal</b>, lembra os vencimentos e mostra quanto você gastou. "
           "Você não precisa abrir planilha nenhuma."))
s.append(Spacer(1, 4))
s.append(caixa("Mande a conta assim que ela chegar → confira → toque em <b>Confirmar</b>. "
               "Quando pagar, toque em <b>Já paguei</b>. O resto o robô faz sozinho.",
               fundo=ROXO_CLARO, titulo="Resumo do dia a dia"))
s.append(Spacer(1, 8))
s.append(P("<font name='Arial-B' size='13' color='#6B2D7B'>Neste manual</font>"))
s += lista(["Começando a usar", "Mandar uma conta por foto", "Mandar uma conta por texto",
            "Salão ou Pessoal", "Conferir antes de salvar", "Pago ou a pagar",
            "Marcar uma conta como paga", "Os avisos do robô", "Comandos",
            "Contas fixas e manutenções", "Dúvidas comuns"], numerada=True)
s.append(NextPageTemplate("normal"))
s.append(PageBreak())

# 1
s.append(P("1. Começando a usar", h1))
s += lista([
    "Instale o <b>Telegram</b> no celular (Play Store ou App Store), se ainda não tiver.",
    "Abra o link do robô que você recebeu (ex.: <b>t.me/nome_do_bot</b>) ou procure o nome dele na lupa do Telegram.",
    f"Toque em {B('INICIAR')}. O robô responde com as instruções.",
    "Pronto: é só conversar com ele como se fosse um contato.",
], numerada=True)
s.append(Spacer(1, 4))
s.append(caixa("O robô só atende os celulares que foram liberados na instalação. Se outra pessoa (por exemplo, "
               "uma sócia) for usar, ela deve tocar em INICIAR e avisar quem configurou o sistema, que libera o acesso "
               "pela planilha em um minuto.", titulo="Quem pode usar?"))

# 2
s.append(P("2. Mandar uma conta por foto", h1))
s += lista([
    "Na conversa com o robô, toque no <b>clipe</b> (ou na câmera) e tire a foto da conta, do boleto ou da nota.",
    "O robô responde <i>\"Recebi! Lendo a conta...\"</i> e, em alguns segundos, mostra o que entendeu: valor, "
    "vencimento, empresa e categoria.",
    f"Confira e toque em {B('Confirmar')}.",
], numerada=True)
s.append(caixa("• Foto <b>reta</b>, com <b>boa luz</b>, mostrando o <b>valor total</b> e o <b>vencimento</b>.<br/>"
               "• Boleto em PDF também funciona: mande como arquivo.<br/>"
               "• Você pode escrever uma legenda junto com a foto, por exemplo <b>salão</b> ou <b>luz casa</b>. "
               "Isso ajuda o robô.<br/>"
               "• Se ele não conseguir ler o valor, ele pede: é só digitar, por exemplo <b>152,30</b>.",
               fundo=VERDE, titulo="Dicas para a foto sair bem lida"))

# 3
s.append(P("3. Mandar uma conta por texto", h1))
s.append(P("Escreva <b>o que é</b> e <b>o valor</b>. Pode usar vírgula ou ponto nos centavos. Exemplos:"))
s.append(tabela([
    ["Você escreve", "O robô entende"],
    [M("luz 230 salão"), "Conta de luz do Salão, R$ 230,00"],
    [M("mercado 150 casa"), "Mercado, Pessoal, R$ 150,00"],
    [M("aluguel 2000 venc 10/12 salão"), "Aluguel do Salão, vence em 10/12, a pagar"],
    [M("refrigerante 89,90"), "Insumos do Salão, R$ 89,90"],
    [M("manutenção secador 150"), "Manutenção do Salão, R$ 150,00"],
    [M("gasolina 120 pago"), "Transporte, Pessoal, já pago"],
    [M("internet 99,90 vence dia 15"), "Internet, vence no próximo dia 15"],
], [75 * mm, 95 * mm]))
s.append(Spacer(1, 6))
s.append(P("<b>Palavras que ajudam:</b> <b>venc</b> ou <b>vence</b> (antes da data), <b>pago</b> (se já pagou), "
           "<b>a pagar</b> (se ainda não pagou), <b>salão</b> ou <b>casa</b> (de quem é a conta)."))

# 4
s.append(P("4. Salão ou Pessoal", h1))
s.append(P("Esta é a parte mais importante: <b>não misturar</b> as contas do salão com as de casa."))
s.append(tabela([
    ["Se você escrever...", "A conta vai para"],
    ["<b>salão</b>, <b>loja</b>", "Salão"],
    ["<b>casa</b>, <b>pessoal</b>, <b>minha</b>, <b>meu</b>", "Pessoal"],
    ["nada", "O robô deduz quando é óbvio (mercado = Pessoal; produtos e refrigerante = Salão). "
             f"Quando não dá para saber (luz, água, internet, aluguel), ele pergunta: {B('Salão')} ou {B('Pessoal')}"],
], [65 * mm, 105 * mm]))
s.append(Spacer(1, 4))
s.append(P(f"Errou? Antes de confirmar, toque em {B('Trocar Salão/Pessoal')}."))

# 5
s.append(P("5. Conferir antes de salvar", h1))
s.append(P("Toda conta aparece numa mensagem de conferência. <b>Nada é salvo até você tocar em Confirmar.</b>"))
s.append(KeepTogether([tela([
    "<b>Confira antes de salvar</b>",
    "Valor: <b>R$ 320,50</b>",
    "Categoria: Energia",
    "Conta do: <b>Salão</b>",
    "Vencimento: 15/12/2026",
    "Situação: a pagar",
]), Spacer(1, 6)]))
s.append(tabela([
    ["Botão", "Para que serve"],
    [B("Confirmar"), "Salva a conta. O robô responde \"Salvo! (nº 12)\". Esse número identifica a conta."],
    [B("Corrigir valor"), "Digite o valor certo, por exemplo 152,30."],
    [B("Trocar categoria"), "Mostra a lista de categorias para escolher."],
    [B("Trocar Salão/Pessoal"), "Inverte de quem é a conta."],
    [B("Pago / a pagar / vencimento"), "Refaz a pergunta se a conta já foi paga e quando vence."],
    [B("Cancelar"), "Descarta. Nada é salvo."],
], [55 * mm, 115 * mm]))

# 6
s.append(P("6. Pago ou a pagar", h1))
s.append(P(f"Se você mandar só <b>luz 350 salão</b>, o robô pergunta <b>\"Essa conta já foi paga?\"</b>"))
s += lista([
    f"{B('Já paguei')}: a conta é registrada como paga.",
    f"{B('Ainda vou pagar')}: o robô pergunta <b>quando vence</b>. Toque em {B('Hoje')}, {B('Amanhã')}, "
    f"{B('Em 7 dias')} ou digite a data (ex.: <b>15/12</b> ou só <b>15</b>).",
])
s.append(P("Se você já escreveu a data (<b>venc 15/12</b>) ou a palavra <b>pago</b>, ele não pergunta. "
           "Contas <b>a pagar</b> entram nos avisos de vencimento."))

# 7
s.append(P("7. Marcar uma conta como paga", h1))
s.append(P("Você tem três jeitos:"))
s += lista([
    f"Nos avisos do robô, toque em {B('Já paguei')}.",
    f"Mande <b>/pendentes</b> e toque em {B('Paguei nº 12')} na conta certa.",
    "Escreva <b>/pago 12</b> (12 é o número que aparece em \"Salvo! (nº 12)\").",
], numerada=True)

# 8
s.append(P("8. Os avisos do robô", h1))
s.append(P("Os avisos chegam <b>todo dia às 8h</b>. Ao salvar uma conta que vence em poucos dias, o robô também já avisa na hora."))
s.append(tabela([
    ["Aviso", "O que significa", "O que fazer"],
    ["<b>Vence em 3 dias</b>", "Ainda dá tempo.", "Separe o dinheiro."],
    ["<b>Vence amanhã</b>", "Último dia antes do vencimento.", "Pague hoje ou amanhã."],
    ["<b>VENCE HOJE</b>", "Hoje é o dia.", f"Pague e toque em {B('Já paguei')}."],
    ["<b>Contas vencidas</b>", "Passou do dia e não foi marcada como paga.",
     "Pague (pode ter multa). Se já pagou, toque em Já paguei."],
    ["<b>Manutenção</b>", "Hora de cuidar de um equipamento (ex.: filtro do ar).", f"Depois de fazer, toque em {B('Feito hoje')}."],
    ["<b>Acima da média</b>", "A conta veio bem mais cara que nos últimos 3 meses.", "Confira se houve erro ou desperdício."],
    ["<b>Fechamento do mês</b> (dia 1º)", "Total do Salão, Pessoal e geral do mês que passou, maiores gastos e contas sem pagar.",
     "Compare com o mês anterior."],
], [42 * mm, 68 * mm, 60 * mm]))
s.append(Spacer(1, 4))
s.append(caixa("Deixe as notificações do Telegram <b>ligadas</b> no celular para os avisos aparecerem na tela.",
               titulo="Importante"))

# 9
s.append(P("9. Comandos", h1))
s.append(P("Toque no botão <b>Menu</b> (ou digite <b>/</b>) na conversa para ver a lista."))
s.append(tabela([
    ["Comando", "Para quê"],
    [M("/resumo"), "Quanto gastou no mês: Salão, Pessoal, total e por categoria."],
    [M("/mes 10/2026"), "Resumo detalhado de outro mês."],
    [M("/vencimentos"), "O que vence nos próximos 15 dias."],
    [M("/pendentes"), "Tudo que falta pagar, com botões para marcar como pago."],
    [M("/pago 12"), "Marca a conta nº 12 como paga."],
    [M("/desfazer"), "Apaga o último lançamento (se mandou algo errado)."],
    [M("/manutencao"), "Lista as manutenções. Para registrar: /manutencao feito filtro"],
    [M("/categorias"), "Mostra as categorias do Salão e as Pessoais."],
    [M("/ajuda"), "Mostra as instruções."],
], [45 * mm, 125 * mm]))

# 10
s.append(P("10. Contas fixas e manutenções", h1))
s.append(P("Isto é configurado <b>uma vez</b>, na planilha, por quem cuida do sistema."))
s.append(P("Contas fixas", h2))
s.append(P("Contas que se repetem todo mês (aluguel, internet...) ficam na aba <b>ContasFixas</b>. "
           "O robô cria a conta do mês sozinho como <b>a pagar</b> e avisa antes de vencer. Quando chegar a conta "
           "de verdade (foto ou texto), ele <b>atualiza</b> o valor, sem duplicar."))
s.append(tabela([
    ["nome", "categoria", "origem_conta", "dia_vencimento", "valor_médio"],
    ["Aluguel do salão", "Aluguel", "Salão", "10", "2000"],
    ["Internet do salão", "Internet/Telefone", "Salão", "15", "120"],
], [40 * mm, 38 * mm, 30 * mm, 32 * mm, 30 * mm]))
s.append(P("Manutenções", h2))
s.append(P("Na aba <b>Manutenções</b>, informe o equipamento, de quantos em quantos dias precisa de manutenção e a "
           "data da última. O robô avisa quando chegar a hora."))
s.append(P("Planilha e painel", h2))
s.append(P("Tudo fica guardado numa planilha do Google na conta do salão. A aba <b>Painel</b> mostra o total do mês, a "
           "comparação com o mês anterior e com a média dos últimos 3 meses, e gráficos. Não é preciso abrir a planilha "
           "no dia a dia."))

# 11
s.append(P("11. Dúvidas comuns", h1))
duvidas = [
    ("Mandei uma conta errada. E agora?", "Se ainda não confirmou, toque em Cancelar. Se já confirmou, mande <b>/desfazer</b>."),
    ("O robô leu o valor errado da foto.", "Antes de confirmar, toque em Corrigir valor e digite o valor certo."),
    ("O robô colocou na categoria errada.", "Toque em Trocar categoria e escolha a certa."),
    ("Paguei uma conta e esqueci de avisar.", "Mande <b>/pendentes</b> e toque em Paguei na conta."),
    ("O robô não respondeu.", "Espere um minuto e mande de novo. Se continuar, avise quem configurou o sistema."),
    ("Meus dados estão seguros?", "Ficam só na conta Google do salão. O robô responde apenas aos celulares liberados."),
]
for p, r in duvidas:
    s.append(KeepTogether([P(f"<b>{p}</b>", ParagraphStyle('q', parent=corpo, spaceAfter=1, textColor=ROXO)), P(r)]))


doc.build(s)
print("ok")
