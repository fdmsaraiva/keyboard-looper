# Levantamento de mercado — Piano Loop Station

Data: setembro de 2026. Revisto depois de alargado o acesso à rede: as páginas do Google Play, da App Store, do midee e da Google passaram a ser consultadas directamente.

## 1. Aplicações existentes

### Mais próximas da ideia

| App | Plataforma | Semelhanças | Diferenças |
|---|---|---|---|
| **Infinite Looper / Aleph Looper** (Secret Base Design) | iOS | Loops de MIDI num teclado de piano no ecrã, soundfonts embutidas com bateria, intensidade pela altura do toque na tecla, quantização, arranjador de secções | **Parece ter sido retirada da App Store.** A consulta ao catálogo da Apple não devolve nada nos EUA, no Reino Unido, em Portugal nem na Alemanha, enquanto a mesma consulta funciona para outras apps. Não tem Android nem web. |
| **midee** | Web, gratuita | Loop station MIDI que começa na primeira nota, com encaixe no metrónomo, camadas sobrepostas e exportação .mid | Confirmado na página e no código: toca-se com teclado MIDI, teclado do computador ou rato. Tem **13 instrumentos próprios** (Tone.js), sem soundfont General MIDI e **sem bateria**. O undo só retira a última camada e **não há redo**. Não guarda uma lista de ideias. O foco é visualizar MIDI e exportar vídeo. Diz-se open-source, mas o repositório **não tem ficheiro de licença**. |
| **midilooper.com** | Web, computador | Loops MIDI com várias pistas, silenciar e solo, piano clicável | Pensada para computador e para enviar MIDI para equipamento externo. Não quantiza. |

**Pesquisa directa no Google Play:** as pesquisas "piano looper", "piano loop station" e "midi looper keyboard" não devolvem nenhuma app com este conceito. Os resultados são apps de aprender piano, sintetizadores, loopers de áudio e ferramentas MIDI que precisam de teclado externo.

### Parecidas, mas com outro propósito

- **Android** (dados do Google Play):

  | App | O que é | Última actualização | Notas |
  |---|---|---|---|
  | MIDI Looper (VolcanoMobile) | Looper MIDI que precisa de teclado externo | Jul 2025 | Compras na app |
  | MIDI Looper (earnestfox) | Looper MIDI para hardware externo | Ago 2023 | 100+ downloads |
  | Loop Midi | Acompanhamento para teclado MIDI físico | Ago 2026 | |
  | Keyboard Loop Maker | Sequenciador de acordes com soundfont .sf2 | Ago 2023 | Anúncios |
  | Walk Band | Estúdio multipista com piano | — | 50M+ downloads, anúncios e compras na app |
  | Loopify, Strata Live Loop | Loopers de áudio | Set/Ago 2026 | |
  | Expressive MIDI Synthesizer | Sintetizador MPE com teclado de piano | Ago 2026 | Grava para DAWs externas, não faz loops |
- **iOS:**
  - Loopy Pro é um looper de áudio profissional.
  - Ableton Note é um esboço de ideias só para iOS, sem planos para Android.
  - Riffpad (2026) esboça melodias desenhando notas numa grelha.
- **Multiplataforma:** o Looper do BandLab dispara amostras pré-feitas.

### Conclusão

O projecto **não é redundante**. Nenhuma app em Android ou na web junta um teclado de piano táctil pensado para o telemóvel, o fluxo de trabalho de um pedal de loop, uma soundfont General MIDI embutida com bateria e uma biblioteca de ideias guardadas offline. A app com o conceito mais parecido, o Infinite Looper, parece ter saído da App Store, e isso **alarga a lacuna**.

**Principal risco:** o midee. É gratuito e já tem a lógica de loop station. As diferenças confirmadas são a bateria e a soundfont General MIDI, o undo e redo cumulativos, a biblioteca de ideias e o foco no telemóvel.

## 2. Tecnologia

- **SpessaSynth** (Apache-2.0): toca soundfonts SF2, SF3 e DLS num AudioWorklet, e permite gerar o áudio para exportação sem ser em tempo real.
- **Soundfonts:**

| Soundfont | Tamanho | Licença | Observações |
|---|---|---|---|
| MuseScore_General.sf3 | 35,9 MB | MIT | **Candidata principal.** Ocupa cerca de 208 MB descomprimida, por isso é preciso verificar o uso de memória. |
| GeneralUser GS 2.0 | cerca de 30 MB | Permissiva | O autor não garante a origem de todas as amostras. |
| FluidR3_GM | cerca de 140 MB | MIT | Grande demais para a soundfont embutida. |

## 3. Plataformas de venda independentes

| Plataforma | Trata do IVA por ti? | Comissão | Chaves de licença |
|---|---|---|---|
| Gumroad | Sim, desde Jan 2025 | 10% + 0,50 USD | Sim. **Testado: a API aceita pedidos directos do browser (CORS aberto).** |
| Lemon Squeezy | Sim | 5% + 0,50 USD | Sim. **Testado: a API aceita pedidos directos do browser (CORS aberto).** Os problemas relatados eram só em iframes sem origem. |
| Polar | Sim | 5% + 0,50 USD no plano grátis | Sim |
| Paddle | Sim | 5% + 0,50 USD | Mais orientada a empresas |
| Payhip | Não totalmente | 5% no plano grátis | Sim |

**Google Play** (confirmado no blog oficial da Google, a partir de 30 de Junho de 2026 nos EUA, na UE e no Reino Unido):
- **Taxa de serviço de 10%** sobre o primeiro milhão de dólares de receita anual, seja qual for o sistema de pagamento.
- **Mais 5%** quando se usa o sistema de pagamentos da Google. Com pagamento alternativo ou link para o próprio site não há estes 5%, mas há os custos do processador de pagamentos usado.
- Total com o sistema da Google: **15%**. Não há taxa fixa por transacção, o que é vantajoso para preços baixos.

## 4. Nomes candidatos

A verificação foi feita só com pesquisa web. Falta confirmar o registo de marca (EUIPO/INPI) e o domínio.

| Nome | Situação |
|---|---|
| Riffpad, Loopnote | Ocupados por apps de música |
| Keyloop | Nome de uma empresa de software automóvel |
| Ostinato, Vamp | Várias apps de música com nomes iguais ou parecidos |
| **Keyjar**, **Looplet**, **Layerly**, **Loopbook** | Não foi encontrada nenhuma app de música com estes nomes |

## Fontes

- Infinite Looper: https://apps.apple.com/us/app/infinite-looper/id1054808350 · https://discchord.com/blog/2016/4/21/infinite-looper-by-secret-base-design.html
- midee: https://github.com/aayushdutt/midee · https://midee.app/midi-loop-station/
- midilooper: https://midilooper.com/ · https://sonicstate.com/news/2021/02/07/innovative-free-web-based-midi-looper/
- Apps Android: https://play.google.com/store/apps/details?id=net.volcanomobile.midi_looper · https://play.google.com/store/apps/details?id=com.rcksoftware.midiloops · https://play.google.com/store/apps/details?id=com.musicntools.keyboardloopmaker · https://play.google.com/store/apps/details?id=com.gamestar.pianoperfect
- Loopers em geral: https://violetrecording.com/best-looper-apps/ · https://loopypro.com/ · https://forum.ableton.com/viewtopic.php?t=245997 · https://riffpad.app/ · https://help.bandlab.com/hc/en-us/articles/115004496573-Using-the-Looper
- SpessaSynth: https://github.com/spessasus/spessasynth_lib
- Soundfonts: https://musescore.org/en/node/317991 · https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/MuseScore_General_License.md · https://scancode-licensedb.aboutcode.org/generaluser-gs-2.0.html · https://musescore.org/en/node/248741
- Vendas: https://gumroad.com/pricing · https://gumroad.com/help/article/76-license-keys · https://payhip.com/features/vat-taxes · https://dodopayments.com/blogs/payhip-review · https://docs.lemonsqueezy.com/api/license-api · https://fungies.io/polar-sh-review-2026/ · https://dodopayments.com/blogs/paddle-fees-explained
- Google Play Billing e TWA: https://developer.chrome.com/docs/android/trusted-web-activity/play-billing/ · https://android-developers.googleblog.com/2026/06/play-expanded-billing.html
