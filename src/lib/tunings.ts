/** Uma corda do violão, com a nota que ela deve dar solta. */
export interface GuitarString {
  /** Como aparece no diagrama do braço (minúscula = corda fina). */
  label: string;
  /** Nota com oitava, ex.: "E2". */
  note: string;
  /** Frequência alvo em Hz. */
  freq: number;
}

export interface Tuning {
  id: string;
  name: string;
  hint: string;
  /** Da 6ª corda (mais grave) para a 1ª (mais aguda). */
  strings: GuitarString[];
}

/**
 * As frequências vêm do temperamento igual com lá central em 440 Hz, que é o
 * padrão usado por praticamente todo afinador e por qualquer gravação moderna.
 */
export const TUNINGS: Tuning[] = [
  {
    id: "padrao",
    name: "Padrão",
    hint: "E A D G B e",
    strings: [
      { label: "E", note: "E2", freq: 82.41 },
      { label: "A", note: "A2", freq: 110.0 },
      { label: "D", note: "D3", freq: 146.83 },
      { label: "G", note: "G3", freq: 196.0 },
      { label: "B", note: "B3", freq: 246.94 },
      { label: "e", note: "E4", freq: 329.63 },
    ],
  },
  {
    id: "dropd",
    name: "Drop D",
    hint: "D A D G B e",
    strings: [
      // Só a 6ª muda: desce um tom inteiro, de E2 para D2.
      { label: "D", note: "D2", freq: 73.42 },
      { label: "A", note: "A2", freq: 110.0 },
      { label: "D", note: "D3", freq: 146.83 },
      { label: "G", note: "G3", freq: 196.0 },
      { label: "B", note: "B3", freq: 246.94 },
      { label: "e", note: "E4", freq: 329.63 },
    ],
  },
  {
    id: "meiotom",
    name: "Meio tom abaixo",
    hint: "Eb Ab Db Gb Bb eb",
    strings: [
      // Tudo um semitom abaixo: cada frequência é a padrão dividida por 2^(1/12).
      { label: "E♭", note: "D#2", freq: 77.78 },
      { label: "A♭", note: "G#2", freq: 103.83 },
      { label: "D♭", note: "C#3", freq: 138.59 },
      { label: "G♭", note: "F#3", freq: 185.0 },
      { label: "B♭", note: "A#3", freq: 233.08 },
      { label: "e♭", note: "D#4", freq: 311.13 },
    ],
  },
];
