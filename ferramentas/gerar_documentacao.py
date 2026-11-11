"""Gera docs/Documentacao_do_Projeto.pdf: repositório, código, testes, prints do robô e manual do dono.
Uso (na pasta do projeto): python ferramentas/gerar_documentacao.py
"""
import os, re, subprocess
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
                                PageBreak, Image, KeepTogether, NextPageTemplate, Preformatted)
from pypdf import PdfReader, PdfWriter

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(RAIZ, "docs")
PRINTS = os.path.join(DOCS, "prints")
TMP = os.path.join(DOCS, "_documentacao_sem_manual.pdf")
SAIDA = os.path.join(DOCS, "Documentacao_do_Projeto.pdf")
MANUAL = os.path.join(RAIZ, "Manual_de_Uso_Assistente_de_Contas.pdf")
REPO = "https://github.com/KaueCelidonio/assistente-de-contas-salao"

F = "C:/Windows/Fonts/"
for nome, arq in [("Arial", "arial.ttf"), ("Arial-B", "arialbd.ttf"), ("Arial-I", "ariali.ttf"),
                  ("Arial-BI", "arialbi.ttf"), ("Consolas", "consola.ttf")]:
    pdfmetrics.registerFont(TTFont(nome, F + arq))
registerFontFamily("Arial", normal="Arial", bold="Arial-B", italic="Arial-I", boldItalic="Arial-BI")

ROXO = colors.HexColor("#6B2D7B")
BORDA = colors.HexColor("#D9C6DE")
CINZA = colors.HexColor("#555555")
base = ParagraphStyle("b", fontName="Arial", fontSize=10.5, leading=14.5, textColor=colors.HexColor("#222222"))
corpo = ParagraphStyle("c", parent=base, spaceAfter=6)
h1 = ParagraphStyle("h1", parent=base, fontName="Arial-B", fontSize=17, leading=22, textColor=ROXO, spaceAfter=8)
h2 = ParagraphStyle("h2", parent=base, fontName="Arial-B", fontSize=12.5, leading=17, textColor=ROXO, spaceBefore=8, spaceAfter=4)
legenda = ParagraphStyle("l", parent=base, fontSize=9, leading=12, textColor=CINZA, spaceBefore=3, spaceAfter=10)
cel = ParagraphStyle("cel", parent=base, fontSize=8.8, leading=11.5)
celb = ParagraphStyle("celb", parent=cel, fontName="Arial-B", textColor=colors.white)
mono = ParagraphStyle("m", parent=base, fontName="Consolas", fontSize=9, leading=12)


def md(t):
    """Markdown simples (negrito, código) -> marcação do reportlab."""
    # A fonte do PDF não tem emojis (viram quadrados): remove
    t = re.sub(r"[\U0001F000-\U0001FFFF⌀-⏿☀-➿⬀-⯿️]", "", t)
    t = re.sub(r"\s{2,}", " ", t).strip()
    t = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"`(.+?)`", r'<font name="Consolas" color="#1F5FA8">\1</font>', t)
    return t


def tabela(linhas, larguras):
    dados = [[Paragraph(md(c), celb) for c in linhas[0]]] + [[Paragraph(md(c), cel) for c in l] for l in linhas[1:]]
    t = Table(dados, colWidths=larguras, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), ROXO),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAF6FB")]),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDA), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5)]))
    return t


def figura(arquivo, texto, max_alt=200 * mm, larg=170 * mm):
    from PIL import Image as PI
    w, h = PI.open(os.path.join(PRINTS, arquivo)).size
    escala = min(larg / w, max_alt / h)
    img = Image(os.path.join(PRINTS, arquivo), width=w * escala, height=h * escala)
    moldura = Table([[img]], colWidths=[w * escala + 2])
    moldura.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.6, BORDA), ("LEFTPADDING", (0, 0), (-1, -1), 1),
                                 ("RIGHTPADDING", (0, 0), (-1, -1), 1), ("TOPPADDING", (0, 0), (-1, -1), 1),
                                 ("BOTTOMPADDING", (0, 0), (-1, -1), 1)]))
    return KeepTogether([moldura, Paragraph(texto, legenda)])


def git(*args):
    return subprocess.run(["git", *args], cwd=RAIZ, capture_output=True, text=True, encoding="utf-8").stdout.strip()


# ---------- páginas ----------
def capa(c, doc):
    w, h = A4
    c.setFillColor(ROXO)
    c.rect(0, h - 110 * mm, w, 110 * mm, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Arial-B", 28)
    c.drawString(22 * mm, h - 58 * mm, "Assistente de Contas")
    c.setFont("Arial", 15)
    c.drawString(22 * mm, h - 70 * mm, "Documentação do projeto")
    c.setFont("Arial", 11)
    c.drawString(22 * mm, h - 92 * mm, "Repositório, código, testes, robô funcionando e manual do dono")


def rodape(c, doc):
    w, h = A4
    c.setStrokeColor(BORDA)
    c.line(20 * mm, 14 * mm, w - 20 * mm, 14 * mm)
    c.setFont("Arial", 8.5)
    c.setFillColor(CINZA)
    c.drawString(20 * mm, 9 * mm, "Assistente de Contas · Documentação do projeto")
    c.drawRightString(w - 20 * mm, 9 * mm, f"Página {doc.page}")


doc = BaseDocTemplate(TMP, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm,
                      bottomMargin=20 * mm, title="Assistente de Contas - Documentação do projeto")
doc.addPageTemplates([
    PageTemplate(id="capa", frames=[Frame(20 * mm, 25 * mm, 170 * mm, 150 * mm)], onPage=capa),
    PageTemplate(id="normal", frames=[Frame(20 * mm, 20 * mm, 170 * mm, 257 * mm)], onPage=rodape)])

s = []
data_ini = git("log", "--reverse", "--format=%ad", "--date=format:%d/%m/%Y", "-1")
s.append(Paragraph("<b>Repositório:</b> " + f'<link href="{REPO}" color="#1F5FA8">{REPO}</link>', corpo))
s.append(Paragraph("<b>Ferramentas:</b> Telegram Bot API, Google Apps Script, Google Sheets e Google Drive (OCR). Custo zero.", corpo))
s.append(Spacer(1, 6))
s.append(Paragraph("Conteúdo", h2))
for i, t in enumerate(["Repositório no GitHub (com datas)", "Código", "Testes automáticos e resultados",
                       "Lista de casos de teste", "Robô funcionando (testes reais)", "Manual do dono (anexo)"], 1):
    s.append(Paragraph(f"{i}. {t}", corpo))
s.append(NextPageTemplate("normal"))
s.append(PageBreak())

# 1. Repositório
s.append(Paragraph("1. Repositório no GitHub", h1))
s.append(Paragraph(f'O código está publicado em <link href="{REPO}" color="#1F5FA8">{REPO}</link> (público). '
                   "Cada commit registra data, hora e autor.", corpo))
log = git("log", "--reverse", "--format=%h|%ad|%an|%s", "--date=format:%d/%m/%Y %H:%M")
linhas = [["Commit", "Data e hora (Brasília)", "Autor", "Descrição"]]
for l in log.splitlines():
    h, d, a, m = l.split("|", 3)
    linhas.append([h, d, a, m])
s.append(tabela(linhas, [18 * mm, 32 * mm, 28 * mm, 92 * mm]))
s.append(Paragraph("O GitHub mostra as datas no fuso internacional (UTC), 3 horas à frente de Brasília. Por isso commits "
                   "feitos à noite aparecem lá com a data do dia seguinte.", legenda))
s.append(figura("repo.png", f"Print 1: página do repositório no GitHub ({REPO}).", max_alt=150 * mm))
s.append(figura("commits.png", "Print 2: histórico de commits com datas.", max_alt=95 * mm))

# 2. Código
s.append(PageBreak())
s.append(Paragraph("2. Código", h1))
s.append(Paragraph("O código roda no Google Apps Script e está dividido por responsabilidade. "
                   "Os segredos (token do bot, chave do webhook) ficam nas Propriedades do script, fora do código.", corpo))
desc = {"Main.gs": "Webhook (doPost), mensagens, botões e comandos", "Telegram.gs": "Envio de mensagens e botões, download de fotos",
        "Parser.gs": "Texto livre, OCR, categorias, Salão/Pessoal", "Sheets.gs": "Leitura e gravação na planilha",
        "Alertas.gs": "Alertas diários, resumos, gasto acima da média", "Setup.gs": "Setup, menu de instalação, painel, webhook",
        "Util.gs": "Datas, valores e constantes", "Testes.gs": "Testes automáticos do parser",
        "Instalacao.gs": "URL do Web App usada na instalação", "appsscript.json": "Manifesto (fuso, Drive API, Web App)"}
linhas = [["Arquivo", "Linhas", "Função"]]
total = 0
for arq in ["Main.gs", "Parser.gs", "Alertas.gs", "Sheets.gs", "Setup.gs", "Telegram.gs", "Util.gs", "Testes.gs",
            "Instalacao.gs", "appsscript.json"]:
    n = sum(1 for _ in open(os.path.join(RAIZ, "src", arq), encoding="utf-8"))
    total += n
    linhas.append([f"`src/{arq}`", str(n), desc[arq]])
linhas.append(["**Total**", f"**{total}**", ""])
s.append(tabela(linhas, [40 * mm, 18 * mm, 112 * mm]))
s.append(Spacer(1, 8))
s.append(figura("main.png", "Print 3: src/Main.gs no GitHub. O webhook valida a chave secreta e ignora mensagens repetidas "
                "(idempotência) antes de processar."))
s.append(figura("parser.png", "Print 4: src/Parser.gs. Categorias padrão com palavras-chave e tipo (Salão, Pessoal ou Ambos)."))
s.append(figura("alertas.png", "Print 5: src/Alertas.gs. Alerta diário: vencimentos, contas vencidas, manutenções e fechamento do mês."))

# 3. Testes
s.append(PageBreak())
s.append(Paragraph("3. Testes automáticos e resultados", h1))
s.append(Paragraph("Foram feitos dois tipos de teste automático, rodados no computador com Node.js:", corpo))
s.append(Paragraph("• <b>Parser</b> (<font name='Consolas'>src/Testes.gs</font>): 26 mensagens de texto e 5 textos de "
                   "contas lidas por OCR, comparando valor, categoria, Salão/Pessoal, vencimento e situação.", corpo))
s.append(Paragraph("• <b>Simulação do robô completo</b>: Google e Telegram simulados, cobrindo instalação, mensagens, botões, "
                   "comandos, alertas, segurança (chave errada, mensagem repetida) e o Log de erros.", corpo))
res = open(os.path.join(DOCS, "resultado_testes.txt"), encoding="utf-8").read().strip()
sim = open(os.path.join(DOCS, "resultado_sim.txt"), encoding="utf-8").read().strip()
sim = sim.replace("Chave errada ignorada: true", "Chamada com chave errada ignorada: OK") \
         .replace("Duplicado ignorado: true", "Mensagem repetida (mesmo update_id) ignorada: OK") \
         .replace("### alertas diários enviados: []", "Alerta diário sem contas na janela: nenhum aviso (correto)")
caixa = Table([[Preformatted(res + "\n\n" + sim, mono)]], colWidths=[170 * mm])
caixa.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F4F4F4")), ("BOX", (0, 0), (-1, -1), 0.6, BORDA),
                           ("LEFTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
s.append(caixa)
s.append(Paragraph("Saída dos testes. \"ERROS NO LOG: nenhum\" confirma que nenhum fluxo simulado gerou erro.", legenda))
s.append(Paragraph("Durante a simulação foram encontrados e corrigidos três problemas: a legenda de uma foto apagava a "
                   "categoria certa; uma conta fixa era marcada como paga sem o usuário dizer; e o número de um "
                   "lançamento apagado era reaproveitado.", corpo))

# 4. Casos de teste (lidos do CASOS_DE_TESTE.md)
s.append(PageBreak())
s.append(Paragraph("4. Lista de casos de teste", h1))
s.append(Paragraph("Casos com o resultado esperado. Os grupos A e B estão automatizados (31 de 31 passaram); "
                   "os grupos C a F são verificados manualmente no Telegram.", corpo))
texto = open(os.path.join(RAIZ, "CASOS_DE_TESTE.md"), encoding="utf-8").read()
for bloco in re.split(r"\n(?=## )", texto)[1:]:
    titulo = bloco.splitlines()[0][3:].strip()
    linhas = [l for l in bloco.splitlines() if l.startswith("|") and not re.match(r"^\|\s*-", l)]
    linhas = [[c.strip() for c in l.strip().strip("|").split("|")] for l in linhas]
    if not linhas:
        continue
    n = len(linhas[0])
    larg = {2: [55, 115], 6: [10, 50, 22, 32, 28, 28], 3: [12, 70, 88], 5: [12, 58, 25, 35, 40], 4: [12, 58, 45, 55]}.get(n, [170 / n] * n)
    s.append(Paragraph(md(titulo), h2))
    s.append(tabela(linhas, [x * mm for x in larg]))

# 5. Robô funcionando
s.append(PageBreak())
s.append(Paragraph("5. Robô funcionando (testes reais)", h1))
s.append(Paragraph("Prints dos testes feitos em 10/11/2026 com o robô publicado. Por privacidade, foram recortados para "
                   "mostrar apenas a conversa com o robô.", corpo))
s.append(figura("planilha_menu.png", "Print 6: planilha criada, com o menu \"Assistente de Contas\" usado na instalação.", max_alt=40 * mm))
s.append(figura("instalar_token.png", "Print 7: instalação guiada pedindo o token do bot (o token fica nas Propriedades do script, nunca no código).",
                max_alt=70 * mm, larg=110 * mm))
s.append(figura("bot_instalado.png", "Print 8: robô instalado (mensagem \"Instalado!\" com as instruções) e primeiros lançamentos.", max_alt=170 * mm))
s.append(figura("bot_contas.png", "Print 9: contas registradas por texto, com Salão/Pessoal, vencimento, situação (a pagar) "
                "e botão \"Já paguei\".", max_alt=170 * mm))

# 6. Manual
s.append(PageBreak())
s.append(Paragraph("6. Manual do dono", h1))
s.append(Paragraph("O manual de uso para o dono do salão está anexado nas próximas páginas. Também está no repositório como "
                   "<font name='Consolas'>Manual_de_Uso_Assistente_de_Contas.pdf</font> e, em versão de uma página, "
                   "<font name='Consolas'>MANUAL_DO_DONO.md</font>.", corpo))

doc.build(s)

# Junta a documentação com o manual em PDF
w = PdfWriter()
for arq in [TMP, MANUAL]:
    for p in PdfReader(arq).pages:
        w.add_page(p)
w.add_metadata({"/Title": "Assistente de Contas - Documentação do projeto"})
with open(SAIDA, "wb") as f:
    w.write(f)
os.remove(TMP)
print("ok", SAIDA, len(PdfReader(SAIDA).pages), "páginas")
