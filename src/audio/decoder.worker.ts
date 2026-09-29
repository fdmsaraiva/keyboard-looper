// Decodes SF3 (Vorbis-compressed) presets off the audio thread.
//
// SpessaSynth decodes a compressed sample the first time a note uses it, inside
// the audio thread. For long samples (the grand piano) that stalls audio for
// hundreds of milliseconds and truncates the first note. This worker instead
// extracts one preset, decodes its samples and returns it as a small
// uncompressed SF2, which the synthesizer then prefers over the main bank.

import { BasicSoundBank, SoundBankLoader } from 'spessasynth_core'

export type DecoderRequest =
  | { type: 'init'; buffer: ArrayBuffer }
  | { type: 'prepare'; key: string; program: number; bankMSB: number; drums: boolean }

export type DecoderResponse =
  | { type: 'ready' }
  | { type: 'prepared'; key: string; buffer: ArrayBuffer; ms: number }
  | { type: 'error'; key?: string; message: string }

let bank: BasicSoundBank | null = null

self.onmessage = async (e: MessageEvent<DecoderRequest>) => {
  const msg = e.data
  try {
    if (msg.type === 'init') {
      await BasicSoundBank.isSF3DecoderReady
      bank = SoundBankLoader.fromArrayBuffer(msg.buffer)
      post({ type: 'ready' })
      return
    }
    if (!bank) throw new Error('Decoder not initialised')
    const t0 = performance.now()
    const preset = bank.getPreset({ program: msg.program, bankMSB: msg.bankMSB, bankLSB: 0, isGMGSDrum: msg.drums }, 'gs')
    const subset = new BasicSoundBank()
    subset.addCompletePresets([preset])
    for (const sample of subset.samples) {
      if (sample.isCompressed) sample.setAudioData(sample.getAudioData(), sample.sampleRate)
    }
    const buffer = subset.writeSF2({ software: 'Piano Loop Station' })
    post({ type: 'prepared', key: msg.key, buffer, ms: Math.round(performance.now() - t0) }, [buffer])
  } catch (err) {
    post({ type: 'error', key: msg.type === 'prepare' ? msg.key : undefined, message: String(err) })
  }
}

function post(msg: DecoderResponse, transfer: Transferable[] = []) {
  ;(self as unknown as Worker).postMessage(msg, transfer)
}
