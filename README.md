# keyboard-looper

A loop station fed by an embedded piano keyboard (working name: **Piano Loop Station**).

- Specifications: [docs/ESPECIFICACOES.md](docs/ESPECIFICACOES.md)
- Market research: [docs/LEVANTAMENTO.md](docs/LEVANTAMENTO.md)

## Development

```bash
npm install
npm run fetch-soundfont   # downloads MuseScore_General.sf3 (MIT) into public/soundfonts
npm run dev               # local dev server
npm test                  # unit tests (looper model)
npm run build             # type-check + production build into dist/
```

The current code is the **prototype**: touch keyboard, embedded soundfont,
record / overdub / undo / redo with layers. See the spec's §21 for what the
prototype is meant to verify.
