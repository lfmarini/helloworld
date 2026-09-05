/**
 * Detecção de altura (a nota que está soando) pelo algoritmo YIN.
 *
 * Por que não usar o pico da FFT, que seria bem mais simples?
 * Porque a FFT divide o espectro em "caixas" de largura fixa. Com 2048 pontos
 * a 22050 Hz, cada caixa tem ~10,8 Hz de largura. Perto do mi grave (82,41 Hz)
 * um erro de 10 Hz é um erro de mais de 200 cents — dois semitons. Para afinar
 * precisamos de precisão na casa de 1 cent, ou seja, centenas de vezes melhor.
 *
 * O YIN trabalha no tempo, e não na frequência: ele procura o atraso (o
 * "período") que faz a onda coincidir consigo mesma. Depois refina esse atraso
 * com interpolação, chegando a uma precisão bem abaixo de um cent.
 */

export interface PitchResult {
  /** Frequência em Hz, ou -1 quando não há nota confiável. */
  frequency: number;
  /** Confiança de 0 a 1: quão periódico é o sinal. */
  clarity: number;
  /** Volume do trecho analisado (0 a 1). */
  rms: number;
}

/** Frequência mais grave que faz sentido procurar (abaixo do ré grave). */
const MIN_FREQ = 60;

/**
 * Abaixo deste valor a diferença normalizada é considerada "boa o suficiente".
 * Mais baixo = mais exigente (menos falsos positivos, mais silêncios).
 */
const THRESHOLD = 0.12;

export function detectPitch(
  buffer: Float32Array,
  sampleRate: number,
): PitchResult {
  const size = buffer.length;

  // Volume médio do trecho (RMS). Serve de porteiro: sem som suficiente,
  // nem vale a pena rodar o resto.
  let energia = 0;
  for (let i = 0; i < size; i++) energia += buffer[i] * buffer[i];
  const rms = Math.sqrt(energia / size);

  // O maior atraso que precisamos testar corresponde à nota mais grave.
  const maxTau = Math.min(size >> 1, Math.ceil(sampleRate / MIN_FREQ));
  // Janela de comparação fixa: usar sempre o mesmo número de amostras evita
  // que atrasos maiores pareçam artificialmente melhores.
  const janela = size - maxTau;
  if (janela < 128) return { frequency: -1, clarity: 0, rms };

  // --- Passo 1: função diferença -------------------------------------------
  // Para cada atraso tau, mede o quanto a onda difere de si mesma deslocada.
  // Se tau for exatamente o período, a diferença despenca para perto de zero.
  const diff = new Float32Array(maxTau);
  for (let tau = 1; tau < maxTau; tau++) {
    let soma = 0;
    for (let i = 0; i < janela; i++) {
      const d = buffer[i] - buffer[i + tau];
      soma += d * d;
    }
    diff[tau] = soma;
  }

  // --- Passo 2: diferença média cumulativa normalizada ----------------------
  // Sem isso, tau muito pequeno sempre ganharia (menos deslocamento = menos
  // diferença). Dividir pela média acumulada corrige esse viés e é o truque
  // central do YIN.
  const cmnd = new Float32Array(maxTau);
  cmnd[0] = 1;
  let acumulado = 0;
  for (let tau = 1; tau < maxTau; tau++) {
    acumulado += diff[tau];
    cmnd[tau] = acumulado === 0 ? 1 : (diff[tau] * tau) / acumulado;
  }

  // --- Passo 3: primeiro mínimo abaixo do limiar ---------------------------
  // Pegamos o PRIMEIRO vale bom, e não o melhor de todos, justamente para não
  // cair numa oitava abaixo (o dobro do período também casa bem).
  let tau = -1;
  for (let t = 2; t < maxTau; t++) {
    if (cmnd[t] < THRESHOLD) {
      // Desce até o fundo do vale antes de parar.
      while (t + 1 < maxTau && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }

  if (tau === -1) {
    // Nada passou no limiar. Ainda assim tentamos o melhor mínimo global —
    // se for ruim demais, desistimos e devolvemos "sem nota".
    let melhor = 1;
    let valor = cmnd[1];
    for (let t = 2; t < maxTau; t++) {
      if (cmnd[t] < valor) {
        valor = cmnd[t];
        melhor = t;
      }
    }
    if (valor > 0.45) return { frequency: -1, clarity: 0, rms };
    tau = melhor;
  }

  // --- Passo 4: interpolação parabólica ------------------------------------
  // O período verdadeiro quase nunca cai exatamente em cima de uma amostra.
  // Encaixando uma parábola nos três pontos ao redor do vale, achamos o fundo
  // com precisão fracionária. É isso que leva o erro para menos de um cent.
  let tauFino = tau;
  if (tau > 1 && tau + 1 < maxTau) {
    const s0 = cmnd[tau - 1];
    const s1 = cmnd[tau];
    const s2 = cmnd[tau + 1];
    const denominador = 2 * (2 * s1 - s2 - s0);
    if (denominador !== 0) tauFino = tau + (s2 - s0) / denominador;
  }

  if (tauFino <= 0) return { frequency: -1, clarity: 0, rms };

  return {
    frequency: sampleRate / tauFino,
    clarity: Math.max(0, Math.min(1, 1 - cmnd[tau])),
    rms,
  };
}

const NOMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Converte frequência em nome de nota (ex.: 82.4 Hz -> "E2"). */
export function noteFromFrequency(freq: number): string {
  // 69 é o número MIDI do lá central (A4 = 440 Hz); cada semitom soma 1.
  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  const nome = NOMES[((midi % 12) + 12) % 12];
  return `${nome}${Math.floor(midi / 12) - 1}`;
}

/**
 * Diferença entre duas frequências em cents (1 semitom = 100 cents).
 * A escala é logarítmica porque a percepção de altura também é.
 */
export function centsBetween(freq: number, alvo: number): number {
  return 1200 * Math.log2(freq / alvo);
}

/** Mediana de uma lista. Mais resistente a valores esquisitos que a média. */
export function median(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2
    ? ordenados[meio]
    : (ordenados[meio - 1] + ordenados[meio]) / 2;
}
