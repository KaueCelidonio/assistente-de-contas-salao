# Assistente de Contas do Salão (Telegram + Google Planilhas)

Bot do Telegram que registra contas e gastos de um salão de beleza, **separando Salão e Pessoal**.
O dono manda uma foto da conta ou um texto curto ("luz 412 salão"). O bot lê, classifica, pede
confirmação, grava numa planilha do Google, avisa vencimentos e manda resumos.

**Custo zero:** Telegram Bot API + Google Apps Script + Google Planilhas + Google Drive (OCR).
Não precisa de servidor.

---

## Arquivos

| Arquivo | O que faz |
|---|---|
| `src/Main.gs` | Recebe o webhook (`doPost`), entende mensagens, botões e comandos |
| `src/Telegram.gs` | Envia mensagens e botões, baixa fotos |
| `src/Parser.gs` | Interpreta texto livre, classifica categoria, decide Salão/Pessoal, faz o OCR |
| `src/Sheets.gs` | Lê e grava na planilha, contas fixas, manutenções, Log |
| `src/Alertas.gs` | Alerta diário, resumos, aviso de gasto acima da média |
| `src/Setup.gs` | `setup()`, Painel, `setWebhook()`, `deleteWebhook()`, `testarOCR()`, `testarParser()` |
| `src/Util.gs` | Constantes e funções de data e dinheiro |
| `src/Testes.gs` | `testarTodos()`: testes automáticos do parser |
| `src/appsscript.json` | Manifesto: fuso horário, Drive API, Web App |
| `MANUAL_DO_DONO.md` | Guia de 1 página para o dono do salão |
| `CASOS_DE_TESTE.md` | Casos de teste com o resultado esperado |

---

## Passo a passo da instalação (cerca de 20 minutos)

### 1. Criar o bot no Telegram
1. No Telegram, abra uma conversa com **@BotFather**.
2. Mande `/newbot`.
3. Escolha um nome (ex.: `Contas do Salão Bela`).
4. Escolha um usuário terminado em `bot` (ex.: `contas_salao_bela_bot`).
5. O BotFather responde com um **token** parecido com `7123456789:AAH...`. **Guarde o token e não compartilhe com ninguém.**

### 2. Criar a planilha
1. Acesse <https://sheets.new> com a conta Google que vai "ser dona" do sistema.
2. Dê um nome, por exemplo **Contas do Salão**.

### 3. Colar o código
1. Na planilha, abra **Extensões → Apps Script**.
2. Apague o conteúdo do arquivo `Código.gs` e renomeie esse arquivo para `Main` (clique nos três pontinhos ao lado do nome → Renomear).
3. Cole nele o conteúdo de `src/Main.gs`.
4. Para cada um dos outros arquivos (`Util`, `Telegram`, `Sheets`, `Parser`, `Alertas`, `Setup`, `Testes`):
   clique no **+** ao lado de "Arquivos" → **Script** → digite o nome **sem** `.gs` → cole o conteúdo do arquivo correspondente.
5. **Manifesto:** clique em ⚙️ **Configurações do projeto** e marque *"Mostrar arquivo de manifesto 'appsscript.json' no editor"*. Volte ao editor, abra `appsscript.json` e substitua tudo pelo conteúdo de `src/appsscript.json`.
6. Clique em 💾 **Salvar**.

> A ordem dos arquivos não importa: no Apps Script, todos enxergam as funções uns dos outros.

### 4. Ativar o Serviço Avançado do Drive (usado no OCR)
Se você colou o `appsscript.json` do passo 3.5, isso **já está feito**. Para conferir:
no editor, em **Serviços** (barra da esquerda), deve aparecer **Drive**. Se não aparecer:
**Serviços → +** → escolha **Drive API** → versão **v3** → identificador **Drive** → **Adicionar**.

### 5. Guardar o token nas Propriedades do script
1. ⚙️ **Configurações do projeto** → role até **Propriedades do script** → **Adicionar propriedade**.
2. Propriedade: `TELEGRAM_TOKEN`. Valor: o token do BotFather.
3. **Salvar propriedades do script**.

O token fica **só** aqui, nunca no código. O `setup()` cria sozinho `WEBHOOK_KEY` (o segredo do webhook), `SPREADSHEET_ID` e `PASTA_DRIVE_ID`.

### 6. Rodar o `setup()`
1. No editor, abra o arquivo `Setup`, escolha a função **`setup`** na barra de cima e clique em **▶ Executar**.
2. O Google pede autorização: **Revisar permissões** → escolha sua conta → *"O Google não verificou este app"* → **Avançado** → **Acessar (nome do projeto)** → **Permitir**.
   (É o seu próprio script. O aviso aparece porque ele não foi publicado na loja do Google.)
3. Ao terminar, a planilha passa a ter as abas **Lançamentos, Categorias, ContasFixas, Manutenções, Painel, Config, Log**. O Drive ganha a pasta **"Assistente de Contas - Fotos"**, e o gatilho diário das 8h é criado.

### 7. Publicar como Web App
1. **Implantar → Nova implantação**.
2. Clique na engrenagem ao lado de "Selecione o tipo" → **App da Web**.
3. **Executar como:** *Eu*. **Quem pode acessar:** *Qualquer pessoa*.
   (O Telegram precisa acessar sem login. A proteção é o segredo `?key=` e a lista de chats autorizados.)
4. **Implantar**, autorize se pedir, e **copie a URL do app da Web** (termina em `/exec`).
5. Volte em ⚙️ **Configurações do projeto → Propriedades do script** e adicione `WEB_APP_URL` com essa URL.

### 8. Registrar o webhook
1. No editor, escolha a função **`setWebhook`** e clique em **▶ Executar**.
2. Em **Registro de execução** deve aparecer `"ok":true`. O menu de comandos do bot também é cadastrado.

### 9. Liberar o seu Telegram
1. No Telegram, abra o seu bot e mande `/start`.
2. Ele responde: *"Seu chat_id é 123456789"*.
3. Na planilha, aba **Config**, linha `chat_ids_autorizados`, coluna **valor**: cole esse número.
   Para liberar mais de uma pessoa (ex.: dono e sócia), separe por vírgula: `123456789, 987654321`.
4. Mande `/start` de novo: agora aparece a ajuda. **Pronto!**

> Depois que houver pelo menos um chat cadastrado, o bot **ignora em silêncio** qualquer outra pessoa.

### 10. Testar
- No editor: rode **`testarTodos`**. O registro deve mostrar `31 de 31 testes passaram.`
- No editor: rode **`rodarTesteParser`** (ou altere o texto dentro dela).
- No Telegram: mande `luz 230 salão` → toque em ✅ **Confirmar** → veja a linha nova em **Lançamentos**.
- No Telegram: mande a foto de uma conta de luz.
- OCR de um arquivo do Drive: copie o ID do arquivo (o trecho da URL entre `/d/` e `/view`), cole dentro de `rodarTesteOCR()` e execute.
- Veja também `CASOS_DE_TESTE.md`.

---

## Configurações (aba **Config**)

| parâmetro | padrão | para que serve |
|---|---|---|
| `chat_ids_autorizados` | — | Quem pode usar o bot |
| `dias_alerta_vencimento` | `3,1,0` | Avisos 3 dias antes, 1 dia antes e no dia |
| `dias_proximos_vencimentos` | `15` | Janela do comando `/vencimentos` |
| `dias_alerta_manutencao` | `3` | Antecedência do aviso de manutenção |
| `percentual_anomalia` | `25` | Avisa gasto X% acima da média de 3 meses |
| `deduzir_origem_pela_categoria` | `sim` | `sim`: "mercado" já vira Pessoal e "refrigerante" já vira Salão. `não`: sempre pergunta |
| `usar_gemini` | `não` | Fallback de leitura de foto com Gemini (veja abaixo) |
| `hora_alerta` | `8` | Hora do alerta diário (rode `setup()` de novo depois de mudar) |
| `pasta_drive_id` | automático | Pasta das fotos |

**Categorias:** edite a aba **Categorias**. Coluna `tipo` = Salão, Pessoal ou Ambos. As `palavras-chave` vêm separadas por vírgula e **sem acento**. As mudanças valem na hora. Rode `atualizarPainel()` (ou espere o alerta do dia seguinte) para o Painel mostrar uma categoria nova.

**Contas fixas:** em **ContasFixas**, preencha por exemplo `Aluguel do salão | Aluguel | Salão | 10 | 2000`. Todo mês o bot cria essa conta como *a pagar* e avisa antes de vencer. Se depois chegar a foto ou o texto da mesma conta, o bot **atualiza** a conta fixa (valor real, foto) em vez de duplicar.

**Manutenções:** em **Manutenções**, informe o equipamento e a periodicidade em dias e preencha a `última_data`. A `próxima_data` é calculada sozinha. No Telegram: `/manutencao feito filtro`.

---

## Gemini (opcional, desligado por padrão)
Só use se o OCR do Drive estiver falhando muito. **Atenção:** a foto da conta passa a ser enviada ao Google Gemini.
1. Crie uma chave gratuita em <https://aistudio.google.com/apikey>.
2. Propriedades do script: `GEMINI_API_KEY` = a chave. Opcional: `GEMINI_MODEL` (padrão `gemini-2.5-flash`).
3. Aba Config: `usar_gemini` = `sim`.

O Gemini é chamado **apenas** quando o OCR não encontra o valor.

---

## Como contornamos as limitações do Apps Script como webhook

| Limitação | Solução no código |
|---|---|
| `doPost` não lê headers, então não dá para usar o `secret_token` do Telegram | Segredo na URL (`?key=WEBHOOK_KEY`, gerado pelo setup) + lista de `chat_ids_autorizados` |
| Não dá para responder ao Telegram antes de terminar o processamento; o Web App também responde com um redirecionamento (302), que o Telegram pode tratar como erro e **reenviar** | O `update_id` é marcado como processado **logo no início**, sob `LockService`, em CacheService + Propriedades. Reenvios são ignorados. O webhook usa `max_connections=1`. Nas fotos, o bot já manda "Recebi, lendo..." |
| Não guarda estado entre mensagens | Rascunhos e "esperando valor" ficam no CacheService (6 h). Os botões carregam só um id curto (o limite é de 64 bytes) |
| Gravações simultâneas | Toda gravação passa por `comLock_()` (LockService). Um toque duplo em "Confirmar" salva só uma vez |
| A URL muda a cada nova implantação | Atualize sempre por **Gerenciar implantações** (veja abaixo) |
| Erros não podem derrubar o bot | `try/catch` em todo o fluxo. Os erros vão para a aba **Log**, e o `doPost` sempre responde "ok" |

> Em `infoWebhook()` pode aparecer `last_error_message: "Wrong response from the webhook: 302 Moved Temporarily"`.
> Isso é comum em bots feitos com Apps Script. Se as mensagens estão sendo respondidas, está tudo certo, e eventuais reenvios são descartados pela checagem de `update_id`.

---

## Atualizar o código sem mudar a URL
Depois de editar e salvar: **Implantar → Gerenciar implantações** → ✏️ (editar) → **Versão: Nova versão** → **Implantar**.
A URL continua a mesma e não precisa rodar `setWebhook()` de novo.
(Se você criar uma *Nova implantação*, a URL muda: atualize `WEB_APP_URL` e rode `setWebhook()`.)

## Problemas comuns
- **O bot não responde:** rode `infoWebhook()` e veja a aba **Log**. Confira se a URL termina em `/exec`, se o acesso está como *Qualquer pessoa* e se você publicou uma nova versão depois de mexer no código.
- **"Serviço avançado Drive não está ativado"**: refaça o passo 4.
- **Foto lida errada:** toque em ✏️ **Corrigir valor**. Fotos retas, com boa luz e mostrando o "Total a pagar" funcionam melhor. Mandar a legenda junto com a foto (ex.: `luz salão`) ajuda.
- **Desligar o bot:** rode `deleteWebhook()`.

## Segurança e privacidade
- Token, segredo do webhook e chave do Gemini ficam em **Propriedades do script**, fora do código.
- Só os chats da aba Config são atendidos. Os demais são registrados no Log e ignorados.
- Os dados ficam na conta Google do dono (planilha + Drive). Nada é enviado a terceiros além do Telegram e, **somente se ativado**, do Gemini.
- Não compartilhe a planilha nem o projeto do Apps Script com quem não deve ver as finanças.

## Cotas gratuitas (conta Google pessoal, valores aproximados)
UrlFetch: 20 mil chamadas/dia · gatilhos: 90 min/dia · tempo por execução: 6 min.
O uso de um salão fica muito abaixo desses limites.
