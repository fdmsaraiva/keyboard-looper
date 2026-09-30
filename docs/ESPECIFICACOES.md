# Piano Loop Station — Especificações

> Nome provisório: **Piano Loop Station** (nome de código do repositório: `keyboard-looper`).
> Estado: **rascunho para confirmação** — nenhum código escrito.
> Os números entre parênteses (ex.: *(Q7a)*) remetem para as perguntas da recolha de especificações.

---

## 1. Visão

Um **bloco de notas musical**: uma loop station, com o comportamento de um pedal de loop de guitarra, alimentada por um teclado de piano embutido na própria app. Serve para anotar ideias musicais rapidamente, em qualquer lado, sem internet.

### Princípios de design

1. **Bloco de notas, não estúdio.** Na dúvida, fica a opção mais simples. A app não pretende guardar a melhor versão possível de uma ideia *(Q11)*.
2. **O telemóvel manda.** Quando há conflito de design, prevalece a experiência no Pixel na horizontal *(Q2a)*.
3. **O teclado tem prioridade de espaço.** Todos os painéis podem ser colapsados *(Q12a)*.
4. **Interface sóbria.** Controlos finos (volume, grelha, etc.) abrem num segundo plano e não ficam expandidos *(Q12)*.
5. **Nunca prender os dados do utilizador.** As cópias de segurança são sempre grátis, e as ideias abrem sempre, com ou sem Pro *(Q23, Q5-Pro)*.

---

## 2. Plataforma e distribuição

| Tema | Decisão |
|---|---|
| Tipo de app | **PWA**: instalável a partir do browser, funciona totalmente offline e é responsive em telemóvel, tablet e computador *(Q1)* |
| Browsers suportados | Versões actuais de Chrome (Android e computador), Safari (macOS e iOS), Edge e Firefox |
| Dispositivo de referência | **Pixel 6 Pro e Pixel 8 Pro** (Chrome). Os limites de desempenho são medidos no 6 Pro *(Q2)* |
| Lançamento | Web e Android. O iOS fica para quando houver um iPhone para testar *(Q2b)* |
| Lojas de apps | Em aberto. O código fica preparado para ser empacotado para o Google Play (TWA) e para a App Store mais tarde *(Q1, Q3b)* |
| Servidores | Nenhum para o funcionamento da app. O alojamento é estático (ex.: GitHub Pages) |
| Línguas | **Inglês** no lançamento, com infraestrutura de traduções desde o início. Todos os textos ficam num ficheiro de traduções *(Q4)* |

---

## 3. Modelo comercial

### 3.1 Grátis + desbloqueio único "Pro" *(Q3, Q3d)*

Preço indicativo: pagamento único entre **5 € e 10 €**. O valor exacto fica para mais tarde.

| | Grátis | Pro |
|---|---|---|
| Camadas por ideia | **Até 5** | **Sem limite**, até ao limite de estabilidade (a medir; espera-se entre 32 e 64) |
| Mudar o andamento de uma ideia já gravada *(Q13a)* | — | ✔ |
| Estender loop (×2) *(Q7, §10)* | — | ✔ |
| Soundfonts próprias: carregar e usar até 3 por ideia *(Q5a, Q21)* | — | ✔ |
| Teclado MIDI físico *(Q19)* | — | ✔ |
| Exportação MIDI *(Q23)* | — | ✔ |
| Tudo o resto: metrónomo, quantização, soundfont embutida com bateria, dois teclados, teclado do computador, atalhos, ideias ilimitadas, exportação de áudio, cópias de segurança | ✔ | ✔ |

**Ideias com mais de 5 camadas numa versão grátis** (por exemplo, importadas ou restauradas de uma cópia feita com o Pro): a ideia abre e toca por inteiro, e as camadas podem ser silenciadas, ter o volume ajustado ou ser apagadas. **Não é possível gravar camadas novas** enquanto a ideia tiver 5 ou mais camadas visíveis. Uma mensagem explica que isso é uma função Pro.

Os limites contam **só as camadas visíveis**. As camadas à espera de redo não contam.

### 3.2 Canal de venda e verificação da compra *(Q3a, Q3b)*

- **O canal está em aberto:** Google Play (com o sistema de pagamentos da Google) ou uma plataforma independente (Gumroad, Lemon Squeezy, Polar…) com chave de licença. O levantamento compara as opções.
- O desbloqueio é um **módulo isolado** no código, com implementações trocáveis: Google Play, chave de licença, ou as duas.
- **Verificação no dispositivo, sem servidor próprio no lançamento.** Aceita-se o risco de pirataria. Se as vendas o justificarem, entra um servidor mínimo (ex.: Cloudflare Workers, gratuito) sem reescrever a app *(Q3a c)*.
- As compras no Google Play e as chaves de licença **não transitam** entre canais.
- A questão de vender como particular ou como empresa é para decidir com um contabilista *(Q3c)*.

---

## 4. Conceitos

- **Ideia:** a unidade que se guarda. Tem uma lista de camadas, uma duração de loop, andamento e compasso, uma soundfont e o histórico de undo e redo.
- **Camada:** uma gravação. Guarda **notas (MIDI) e eventos de sustain**, nunca áudio *(Q5)*. Tem instrumento, volume, silenciar, solo e quantização.
- **Duração do loop:** propriedade **da ideia**, não da camada 1. É definida pela primeira gravação *(regra 3, §6)*.
- **Soundfont da ideia:** uma por ideia na versão grátis. No Pro podem ser até 3, e cada camada escolhe a sua *(Q5a)*.

---

## 5. Controlos do looper *(Q25)*

Os botões são **Rec**, **Play** e **Stop**, mais **Cancel**, que só aparece durante uma gravação. Também fazem parte da barra: **Undo recording**, **Redo recording**, **Metrónomo** (um toque liga e desliga, um toque longo abre as definições) e **Sustain**.

| Situação | **Rec** | **Play** | **Stop** | **Cancel** |
|---|---|---|---|---|
| Ideia vazia | Começa a 1.ª gravação | inactivo | inactivo | oculto |
| A gravar a 1.ª camada | inactivo | inactivo | **Guarda a camada e o loop começa a tocar** | Descarta a gravação e volta ao estado vazio |
| Loop a tocar | Começa a gravar uma camada nova | inactivo | Pára a reprodução | oculto |
| A gravar por cima do loop | inactivo | inactivo | **Guarda a camada e continua a tocar** | Descarta a camada e continua a tocar |
| Parado, com camadas | Toca do início e grava uma camada nova (com contagem de entrada se o metrónomo estiver ligado) | Toca **do início** | inactivo | oculto |

- **Stop significa sempre "sair do estado actual".** Para parar tudo a partir de uma gravação, carrega-se duas vezes.
- Enquanto se grava, as camadas existentes estão sempre a tocar.
- O Play recomeça sempre do início do loop *(Q26)*.

---

## 6. Gravação

### 6.1 Primeira camada (define o loop)

| Tema | Regra |
|---|---|
| Início sem metrónomo | A gravação fica armada e **começa na primeira nota tocada** *(Q8)* |
| Início com metrónomo | **Contagem de entrada** e começo no compasso. A contagem é de 0, 1 ou 2 compassos, com 1 por omissão. Com 0, a gravação começa no compasso seguinte *(Q8b)* |
| Fim sem metrónomo | O loop acaba exactamente no instante em que se carrega em Stop |
| Fim com metrónomo | **Arredondado ao compasso mais próximo** *(Q9)*. Se o Stop for um pouco antes do compasso, a gravação continua até ao fim dele e o que for tocado até lá fica gravado. Se for um pouco depois, as notas que **comecem** nesse excesso são descartadas, e as que já estavam a soar continuam no início do loop *(Q9a)* |
| Duração mínima | 0,5 s. Abaixo disso a gravação é descartada, como um Cancel *(Q7b)* |
| Protecção contra esquecimento | A gravação da primeira camada **pára sozinha aos 5 minutos** e é guardada |
| Duração máxima de uma ideia | Sem limite de tempo. Há um limite de segurança de **50 000 notas** |

### 6.2 Camadas seguintes (sobreposição)

- A gravação começa **no instante** em que se carrega em Rec. Cada nota fica na posição do loop em que foi tocada *(Q8a)*.
- **Todas as camadas têm a duração do loop** *(Q7)*. Tocar durante várias voltas **sobrepõe** tudo na mesma camada, como um pedal *(Q10)*.
- **Notas iguais no mesmo ponto** (mesma altura, a menos de cerca de 30 ms) **fundem-se numa só**, ficando a de maior intensidade *(Q10)*.
- O **instrumento da nova camada** é o que está seleccionado no teclado quando se carrega em Rec *(Q6)*.

### 6.3 Notas e sustain que atravessam o fim do loop *(Q7a, Q16b)*

Uma nota, ou um sustain, que continue para lá do fim do loop **continua no início do loop** até ao ponto em que foi largada. O loop funciona como um círculo. Se o sustain estiver ligado quando se começa a gravar, esse estado fica registado no início da camada.

---

## 7. Undo, redo e apagar camadas *(Q6a, Q6b)*

- Os botões dizem explicitamente **"Undo recording"** e **"Redo recording"** e aplicam-se **só a gravações**. Trocar o instrumento, a quantização, o volume, o silenciar e o solo não entram no histórico.
- O undo é **cumulativo**: podem desfazer-se várias gravações seguidas.
- **Gravar e guardar uma nova camada** apaga o redo disponível. **Cancelar** uma gravação mantém-no.
- **Apagar** uma camada individual pede confirmação e não se desfaz com undo.

**Regras:**
1. **Apagar retira a camada do histórico.** O undo actua sempre sobre a camada gravada mais recente **que ainda existe**.
   > Camadas 1–5 → apaga-se a 3 → Undo retira a 5, depois a 4, a 2 e a 1 → Redo repõe 1, 2, 4, 5. A 3 não volta.
2. **Só se pode apagar o que está visível.** As camadas à espera de redo não aparecem na lista.
3. **A duração do loop pertence à ideia.** Apagar qualquer camada, incluindo a 1, não altera a duração.
4. **Quando se fica sem camadas visíveis:**
   - Se ainda houver redo, a duração mantém-se.
   - Se não houver redo, a ideia volta ao estado vazio e a próxima gravação define uma nova duração.
   - Se houver redo e se gravar uma camada nova, o redo é apagado, e essa gravação conta como a primeira de uma ideia vazia.

O histórico de undo e redo **fica guardado com a ideia** *(Q22b)*.

---

## 8. Camadas

### 8.1 Linha de cada camada *(Q12)*

```
 ● 3  Electric Piano ▾   [M] [S]  ◔  ⋯
```

| Elemento | Função |
|---|---|
| ● | Cor da camada, a mesma usada na visualização |
| Instrumento ▾ | Tocar abre a lista de instrumentos, para trocar o instrumento em qualquer momento *(Q6)* |
| [M] [S] | Silenciar e solo |
| ◔ | Ícone com o nível do volume. Tocar abre o controlo fino num painel sobreposto |
| ⋯ | Menu com a quantização (on/off e grelha) e apagar |

### 8.2 Painel de camadas e faixa de visualização *(Q12a, Q28)*

- **Telemóvel:** o painel abre e fecha com um botão.
- **Tablet e computador:** o painel aparece aberto por omissão, mas **pode ser colapsado**.
- **Painel fechado:** fica uma **faixa fina de visualização do loop**, com as notas de cada camada desenhadas em pequeno e na cor da camada, as camadas silenciadas esbatidas, a linha de progresso e os compassos marcados. Tocar na faixa abre o painel.
- A app lembra-se do último estado do painel em cada dispositivo.

---

## 9. Metrónomo e andamento *(Q13)*

| Tema | Decisão |
|---|---|
| Andamento (BPM) | Ajustável, com **tap tempo** |
| Compasso | 2/4, 3/4, 4/4 e 6/8 |
| Acento | No primeiro tempo do compasso |
| Volume | Controlo próprio, do mesmo tipo que o volume das camadas |
| Modo **só visual** | O som pode ser desligado, mantendo a indicação visual. A contagem de entrada também passa a ser só visual |
| Indicação visual | Luz discreta que pisca em cada tempo |
| Contagem de entrada | 0, 1 ou 2 compassos, com 1 por omissão |
| Gravação e exportação | O metrónomo **nunca fica gravado** e não entra na exportação de áudio |

**Andamento de um loop gravado sem metrónomo** *(Q9b)*: se o metrónomo for ligado depois, a app **propõe um andamento que encaixa no loop**. O palpite combina a duração do loop com a **distribuição das notas** e prefere andamentos habituais. O número de compassos proposto (1, 2, 4…) pode ser alterado.

**Mudar o andamento depois de gravar** *(Q13a)*:
- **Grátis:** o andamento fica fixo depois da primeira gravação.
- **Pro:** mudar o BPM toca a ideia mais depressa ou mais devagar, sem alterar a altura das notas.

---

## 10. Quantização *(Q11)*

- **On/off por camada**, desligada por omissão.
- **Reversível:** as notas originais ficam sempre guardadas, e a quantização é aplicada só na reprodução e na exportação.
- **Correcção total:** quando está ligada, as notas vão exactamente para a grelha. Não há controlo de intensidade.
- **Grelhas:** 1/4, 1/8, 1/16, 1/8 tercina e 1/16 tercina.
- **O selector vem pré-preenchido com um palpite:** a grelha mais larga que explique bem as notas da camada. Com poucas notas, o palpite é 1/8.
- Precisa de um andamento: o do metrónomo, ou o calculado no §9.

---

## 11. Estender loop (Pro) *(Q7)*

- Está disponível sempre que não esteja a decorrer uma gravação.
- **É sempre ×2** e pode ser aplicado várias vezes seguidas, dando 2, 4, 8… vezes a duração original.
- O conteúdo de **todas as camadas é copiado**, incluindo o das camadas à espera de redo. As notas que atravessavam o fim do loop passam a atravessar a fronteira entre as cópias sem se notar.
- O andamento não muda. O loop passa a ter o dobro dos compassos.
- A nova duração passa a ser a **duração base**, e as gravações seguintes têm essa duração.
- **Não se desfaz com undo**, por isso pede confirmação. **Não há operação inversa** (encolher).

---

## 12. Teclado

| Tema | Decisão |
|---|---|
| Extensão | **88 teclas**, de A0 a C8 *(Q14b)* |
| Tocar | **Acordes com vários dedos** e **glissando** a deslizar o dedo *(Q14)* |
| Navegação | Uma **barra de navegação** com o teclado inteiro em miniatura e um rectângulo a marcar a zona visível. Arrastar o rectângulo desloca o teclado, e esticar ou encolher o rectângulo faz o zoom. As teclas servem **só para tocar** *(Q14a)* |
| Zoom | O mínimo mostra cerca de 1 oitava. O máximo é limitado por teclas brancas com cerca de 7 mm em ecrãs tácteis, e pode ser menor com rato *(Q14b)* |
| Intensidade (velocity) | Depende da **altura do toque na tecla**: mais perto da ponta, mais forte. A escala é proporcional ao comprimento de cada tecla, incluindo as pretas, e o mínimo é sempre audível. No glissando conta o ponto de entrada em cada tecla. Nas definições há uma opção de intensidade fixa *(Q15)* |
| Nomes das notas | Por omissão só os Dós têm nome (C3, C4…), com **C4 como Dó central**. Nas definições: nomes em todas as teclas brancas, ou nenhum. Notação em letras por omissão, com opção de solfejo *(Q18)* |
| Bateria | Quando a bateria está seleccionada: **nomes ou ícones nas teclas** (Kick, Snare, HH…), **deslocação automática** para a zona dos elementos da bateria, e escolha entre os **kits** disponíveis na soundfont *(Q20b)* |

### 12.1 Orientação e disposições *(Q17)*

- **Horizontal:** a disposição principal.
- **Vertical:** tem dois modos, que se alternam com um botão:
  - **Dois teclados sobrepostos.**
  - **Painel de camadas em cima e um teclado em baixo.**
- **Dois teclados:**
  - Cada um tem a sua barra de navegação. Por omissão, o de cima **continua** o de baixo, uma oitava acima *(Q17a)*.
  - Tocam **sempre o mesmo instrumento** *(Q17b)*.
  - Também podem ser usados na horizontal, em ecrãs com altura suficiente *(Q17c)*.

---

## 13. Sustain *(Q16)*

- É um botão no ecrã que **liga e desliga com um toque**. Não há modo de manter premido.
- O estado aceso tem de ser **muito visível**.
- O sustain fica **gravado na camada**, e as regras de atravessar o fim do loop do §6.3 aplicam-se.

---

## 14. Sons

| Tema | Decisão |
|---|---|
| Motor | Sintetizador de soundfonts SF2 e SF3 num processo separado da interface. Candidato: **SpessaSynth**, com licença Apache-2.0 |
| Soundfont embutida | General MIDI de **cerca de 30–50 MB**, com licença comercial. Candidata: **MuseScore_General.sf3** (35,9 MB, MIT). A decisão final depende de testes de som (piano, baixo, bateria e sintetizadores) e de memória *(Q21)* |
| Instrumentos prioritários | **Piano, baixo, bateria e sintetizadores** *(Q20)* |
| Lista de instrumentos | **Atalhos** para os quatro grupos prioritários no topo, **favoritos** marcados com estrela, e a lista completa **por categorias** General MIDI *(Q20a)* |
| Polifonia | Limitada. Quando o limite é atingido, as notas mais antigas ou mais fracas são cortadas |
| Memória | Só os instrumentos em uso são carregados. Há um aviso quando uma soundfont ultrapassar um limite seguro |
| Soundfonts próprias (Pro) | Carregar ficheiros .sf2 e .sf3, que ficam **guardados na app**, com uma lista para os gerir e apagar. **Até 3 soundfonts por ideia**, cada camada escolhe a sua *(Q5a, Q5c)* |
| Soundfont em falta | Se uma ideia usar uma soundfont que não existe no dispositivo, toca com os **instrumentos equivalentes da soundfont embutida** e mostra um aviso *(Q5b)* |

---

## 15. Entrada externa *(Q19)*

- **Teclado do computador (grátis):** duas filas de letras funcionam como teclas de piano, com mapeamento fixo: Z e Q são sempre Dós, com a fila de cima uma oitava acima. Cada fila continua até às teclas mais à direita (a de baixo até ao Mi seguinte, a de cima até ao Sol), pelo que algumas notas se sobrepõem entre as duas filas. A oitava acompanha o teclado no ecrã: **Z toca o Dó mais baixo visível** e Q o seguinte. ← / → deslocam o teclado no ecrã uma oitava.
- **Atalhos dos controlos (grátis)** *(Q19b)*. Proposta:

| Tecla | Função |
|---|---|
| Enter | Rec |
| Espaço | Play / Stop |
| Esc | Cancel |
| Ctrl/Cmd+Z | Undo recording |
| Ctrl/Cmd+Shift+Z | Redo recording |
| Tab | Sustain |

  As teclas finais escolhem-se na implementação, para não colidirem com as teclas de piano.
- **Teclado MIDI físico (Pro):** por USB ou Bluetooth, via Web MIDI. Funciona no Chrome em Android e no computador, mas não no iOS. Usa a intensidade real das teclas e o pedal de sustain físico.

---

## 16. Ideias e armazenamento *(Q22)*

- **Gravação automática:** não há botão Guardar. Cada ideia nova recebe o nome "Idea <data> <hora>", que se pode mudar.
- **O que fica guardado:** camadas, instrumentos, soundfont, andamento, compasso, silenciar e solo, volumes, quantização e **histórico de undo e redo**.
- **Lista de ideias:** da mais recente para a mais antiga, com pesquisa por nome, **duplicar** e apagar com confirmação. O número de ideias é ilimitado.
- **Ecrã ao abrir a app:** abre numa **ideia nova e vazia**, excepto se a última ideia tiver sido usada há **menos de 2 horas**. Nesse caso continua nela.
- **Persistência:** a app pede ao browser armazenamento persistente e **lembra de vez em quando** que há ideias sem cópia de segurança.

---

## 17. Exportação e importação *(Q23)*

| Formato | Conteúdo | Plano |
|---|---|---|
| **Áudio M4A** (por omissão) ou **WAV** | Mistura final, com 1, 2, 4 ou 8 repetições (4 por omissão), sem desvanecimento e com a ressonância natural das últimas notas | Grátis |
| **MIDI (.mid)** | Uma pista por camada | Pro |
| **Ficheiro da app** | Uma ideia ou todas, para cópia de segurança ou para passar para outro dispositivo | **Sempre grátis** |

- Importar ficheiros da app é **sempre grátis**.
- No telemóvel, exportar abre o **menu de partilha** do sistema (WhatsApp, Drive, e-mail…).
- O metrónomo nunca entra na exportação.

---

## 18. Interface geral

| Tema | Decisão |
|---|---|
| Tema | **Escuro** por omissão, com opção de tema claro *(Q31)* |
| Ecrã | Não se apaga sozinho enquanto a app está aberta *(Q29)* |
| Interrupções | Uma chamada, ou mudar de app, **pára a reprodução** e **cancela** uma gravação em curso *(Q30)* |
| Primeira utilização | Introdução de 3 ou 4 ecrãs, com opção de saltar: gravar, sobrepor, undo e camadas *(Q33)* |
| Privacidade | **Zero recolha de dados** de utilização. Nada sai do dispositivo *(Q32)* |

---

## 19. Limites técnicos

| Limite | Valor |
|---|---|
| Camadas por ideia | 5 na versão grátis. No Pro, o limite de estabilidade a medir no Pixel 6 Pro |
| Duração mínima do loop | 0,5 s |
| Paragem automática da 1.ª gravação | 5 min |
| Notas por ideia | 50 000 |
| Fusão de notas repetidas | Cerca de 30 ms |
| Soundfonts por ideia | 1 na versão grátis, 3 no Pro |
| Teclado | 88 teclas |

---

## 20. Fora do âmbito

- Gravação por microfone ou camadas de áudio *(Q24)*.
- Instrumentos diferentes em cada um dos dois teclados *(Q17b)*.
- Camadas com durações diferentes na mesma ideia. O "Estender loop" substitui esta funcionalidade.
- Edição de notas (piano roll). A visualização é só para ver.
- Compassos para além de 2/4, 3/4, 4/4 e 6/8.
- Sincronização na nuvem e contas de utilizador.

---

## 21. A verificar no protótipo

1. **Latência** entre tocar e ouvir no Chrome do Pixel 6 Pro. **Resultado:** aceitável no Chrome, com o atraso do toque à app entre 10 e 17 ms. Fica ligeiramente acima de uma app nativa (Mini Piano Pro), o que se nota em notas muito rápidas. Aberta dentro da app do Claude, a latência sobe para cerca de 100 ms, por isso os testes são feitos pelo GitHub Pages. As amostras de som não têm silêncio inicial que contribua para o atraso.
2. **Memória** da soundfont SF3. **Resultado:** o motor descomprimia os sons no próprio processo de áudio, o que cortava a primeira nota. Passou a ser feito em segundo plano, com cache no dispositivo. O piano da MuseScore_General ocupa cerca de 100 MB descomprimido e demora vários segundos a preparar na primeira utilização. Os outros instrumentos ocupam entre 1 e 6 MB. Candidato a substituição por um piano mais leve.
3. **Qualidade** do piano, baixo, bateria e sintetizadores da MuseScore_General, comparada com outras soundfonts.
4. **Limite de estabilidade** de camadas e da polifonia no Pixel 6 Pro.
5. **Verificação de chaves de licença a partir do browser:** já testado para o Gumroad e o Lemon Squeezy, que aceitam pedidos directos do browser. Falta testar o canal que vier a ser escolhido, se for outro.
6. **Codificação M4A no browser.** Se não estiver disponível num browser, esse browser usa WAV.

---

## 22. Decisões em aberto (não bloqueiam o desenvolvimento)

- Nome comercial e verificação de marca e domínio.
- Canal de venda.
- Preço exacto do Pro.
- Vender como particular ou como empresa.
