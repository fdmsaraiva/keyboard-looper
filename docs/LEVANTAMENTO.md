# Levantamento de mercado — Piano Loop Station

Data: setembro de 2026. Algumas páginas (Google Play, midee.app, sites de fabricantes) não puderam ser abertas directamente a partir do ambiente de trabalho. Nesses casos a informação vem de resumos de pesquisa.

## 1. Aplicações existentes

### Mais próximas da ideia

| App | Plataforma | Semelhanças | Diferenças |
|---|---|---|---|
| **Infinite Looper** (Secret Base Design) | Só iOS | Loops de MIDI num teclado de piano no ecrã, soundfonts embutidas com bateria, intensidade pela altura do toque na tecla, quantização | Só iOS, de 2016. Orientada para arranjos com vários instrumentos e secções de música. Não tem Android nem web. |
| **midee** | Web, gratuita e open-source | Loop station MIDI com encaixe no compasso do metrónomo, camadas sobrepostas, undo e exportação .mid | O foco é visualizar MIDI e aprender a tocar. Toca-se com um teclado MIDI ou com o teclado do computador. A documentação não refere teclado táctil no ecrã, soundfonts, nem uma lista de ideias guardadas. |
| **midilooper.com** | Web, computador | Loops MIDI com várias pistas, silenciar e solo, piano clicável | Pensada para computador e para enviar MIDI para equipamento externo. Não quantiza. |

### Parecidas, mas com outro propósito

- **Android:**
  - MIDI Looper e Loop Midi exigem um teclado MIDI físico.
  - Keyboard Loop Maker é um sequenciador de acordes.
  - Walk Band é um estúdio multipista.
  - Loopify e LoopStation são loopers de áudio.
- **iOS:**
  - Loopy Pro é um looper de áudio profissional.
  - Ableton Note é um esboço de ideias só para iOS, sem planos para Android.
  - Riffpad (2026) esboça melodias desenhando notas numa grelha.
- **Multiplataforma:** o Looper do BandLab dispara amostras pré-feitas.

### Conclusão

O projecto **não é redundante**. Nenhuma app em Android ou na web junta um teclado de piano táctil pensado para o telemóvel, o fluxo de trabalho de um pedal de loop, uma soundfont General MIDI embutida com bateria e uma biblioteca de ideias guardadas offline.

**Principal risco:** o midee. É gratuito, open-source e já tem a lógica de loop station. A diferença tem de estar na experiência no telemóvel.

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
| Gumroad | Sim, desde Jan 2025 | 10% + 0,50 USD | Sim, com uma API para as verificar |
| Lemon Squeezy | Sim | 5% + 0,50 USD | Sim. Há relatos de bloqueios (CORS) quando a verificação é feita a partir do browser. |
| Polar | Sim | 5% + 0,50 USD no plano grátis | Sim |
| Paddle | Sim | 5% + 0,50 USD | Mais orientada a empresas |
| Payhip | Não totalmente | 5% no plano grátis | Sim |

Google Play: pelo que foi encontrado, a comissão é de cerca de 10% de serviço mais 5% pelo processamento do pagamento, desde 30 de Junho de 2026 na UE, no Reino Unido e nos EUA. Os valores ficam por confirmar na fonte oficial.

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
