import { useCallback, useEffect, useRef, useState } from "react";
import { centsBetween, detectPitch, median, noteFromFrequency } from "./pitch";
import type { Tuning } from "./tunings";

export type TunerStatus = "idle" | "requesting" | "listening" | "error";

export type TunerError =
  | "denied" // usuário negou a permissão
  | "notfound" // nenhum microfone conectado
  | "unsupported" // navegador sem suporte a captura de áudio
  | "insecure" // página fora de HTTPS
  | "unknown";

export interface Reading {
  frequency: number;
  note: string;
  /** Quanto está fora do alvo da corda mais próxima, em cents. */
  cents: number;
  /** Índice da corda detectada dentro da afinação escolhida. */
  stringIndex: number;
  clarity: number;
}

/* -------------------------------------------------------------------------
   Portões de qualidade — calibrados com sinais sintéticos de violão.

   Sem eles o afinador fica "nervoso": mostra notas fantasma vindas de ruído
   de fundo e, pior, erra oitava quando o sinal está fraco. Medindo o algoritmo
   com ruído crescente, leituras erradas só começam a aparecer quando a clareza
   cai abaixo de ~0,90 — daí o valor abaixo. Melhor não mostrar nada do que
   mostrar a nota errada.
------------------------------------------------------------------------- */
const MIN_CLARITY = 0.9;
const MIN_RMS = 0.012;
/** Faixa útil de um violão: do ré grave do Drop D até bem acima do mi agudo. */
const MIN_HZ = 60;
const MAX_HZ = 500;

/** Quantas leituras entram na mediana. Mais = mais estável, porém mais lento. */
const HISTORY = 5;
/** Intervalo entre análises. 40ms (25x por segundo) já parece instantâneo. */
const ANALYSIS_MS = 40;
/** Depois de tanto tempo sem som válido, limpamos a tela. */
const SILENCE_MS = 700;

export function useTuner(tuning: Tuning) {
  const [status, setStatus] = useState<TunerStatus>("idle");
  const [error, setError] = useState<TunerError | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);

  /** Desvio suavizado que a agulha 3D lê a cada quadro, sem re-renderizar. */
  const centsRef = useRef(0);
  /** Último desvio medido — é o alvo que a agulha persegue. */
  const targetRef = useRef(0);
  /** Vale 0 quando não há nota; a agulha usa para desbotar. */
  const activeRef = useRef(0);

  const audioRef = useRef<{
    ctx: AudioContext;
    stream: MediaStream;
    analyser: AnalyserNode;
    // O tipo precisa dizer explicitamente ArrayBuffer: getFloatTimeDomainData
    // não aceita um array apoiado em SharedArrayBuffer.
    buffer: Float32Array<ArrayBuffer>;
  } | null>(null);
  const rafRef = useRef(0);
  const historyRef = useRef<number[]>([]);
  const tuningRef = useRef(tuning);
  tuningRef.current = tuning;

  /** Libera microfone e áudio. Chamado ao sair da tela e ao desligar. */
  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const a = audioRef.current;
    if (a) {
      // Sem o track.stop() a luzinha do microfone continua acesa e o navegador
      // segue capturando — é o vazamento mais comum nesse tipo de tela.
      a.stream.getTracks().forEach((t) => t.stop());
      void a.ctx.close();
      audioRef.current = null;
    }
    historyRef.current = [];
    centsRef.current = 0;
    targetRef.current = 0;
    activeRef.current = 0;
    setReading(null);
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    if (!window.isSecureContext) {
      setError("insecure");
      setStatus("error");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("unsupported");
      setStatus("error");
      return;
    }

    setStatus("requesting");
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Os três precisam ficar desligados. Cancelamento de eco e redução de
          // ruído são feitos para voz: eles deformam a forma de onda e destroem
          // a precisão. O ganho automático mexe no volume no meio da nota.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      // 22050 Hz é mais que suficiente: a corda mais aguda do violão solta dá
      // 330 Hz. Taxa menor = quatro vezes menos contas por análise, o que faz
      // diferença real em celular.
      let ctx: AudioContext;
      try {
        ctx = new AudioContext({ sampleRate: 22050 });
      } catch {
        ctx = new AudioContext(); // alguns navegadores ignoram o pedido
      }
      // Em iOS o contexto nasce suspenso até um gesto do usuário.
      if (ctx.state === "suspended") await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);

      // Corta o ronco de rede elétrica e o barulho de ar-condicionado, que
      // ficam abaixo das notas do violão.
      const passaAlta = ctx.createBiquadFilter();
      passaAlta.type = "highpass";
      passaAlta.frequency.value = 55;

      // Corta o agudo. O ruído branco espalha energia por todo o espectro; o
      // violão vive embaixo de 1 kHz. Jogar o agudo fora remove muito ruído e
      // quase nenhum sinal útil — nos testes isso eliminou os erros de oitava.
      const passaBaixa = ctx.createBiquadFilter();
      passaBaixa.type = "lowpass";
      passaBaixa.frequency.value = 1000;

      const analyser = ctx.createAnalyser();
      // Janela maior em taxa alta, para caber períodos suficientes da nota grave.
      analyser.fftSize = ctx.sampleRate > 30000 ? 4096 : 2048;
      analyser.smoothingTimeConstant = 0;

      source.connect(passaAlta);
      passaAlta.connect(passaBaixa);
      passaBaixa.connect(analyser);
      // Repare que nada é conectado a ctx.destination: não queremos devolver o
      // som pelas caixas e causar microfonia.

      const buffer = new Float32Array(analyser.fftSize);
      audioRef.current = { ctx, stream, analyser, buffer };
      setStatus("listening");

      let ultimaAnalise = 0;
      let ultimoSomValido = performance.now();

      const loop = (agora: number) => {
        rafRef.current = requestAnimationFrame(loop);
        const atual = audioRef.current;
        if (!atual) return;

        // A agulha é atualizada todo quadro (movimento suave), mas a análise
        // pesada roda só algumas vezes por segundo. A cada quadro o valor
        // exibido caminha um quarto do caminho até o último valor medido:
        // é o que transforma leituras aos saltos em movimento contínuo.
        const alvo = activeRef.current ? targetRef.current : 0;
        centsRef.current += (alvo - centsRef.current) * 0.25;

        if (agora - ultimaAnalise < ANALYSIS_MS) return;
        ultimaAnalise = agora;

        atual.analyser.getFloatTimeDomainData(atual.buffer);
        const r = detectPitch(atual.buffer, atual.ctx.sampleRate);

        const valida =
          r.frequency > MIN_HZ &&
          r.frequency < MAX_HZ &&
          r.clarity >= MIN_CLARITY &&
          r.rms >= MIN_RMS;

        if (!valida) {
          if (agora - ultimoSomValido > SILENCE_MS) {
            historyRef.current = [];
            targetRef.current = 0;
            activeRef.current = 0;
            setReading((anterior) => (anterior ? null : anterior));
          }
          return;
        }

        ultimoSomValido = agora;

        // Mediana das últimas leituras: sem isso o número treme na tela. A
        // mediana (e não a média) porque ela ignora um valor solto absurdo,
        // em vez de deixá-lo puxar o resultado.
        const hist = historyRef.current;
        hist.push(r.frequency);
        if (hist.length > HISTORY) hist.shift();
        const freq = median(hist);

        // Qual corda o usuário está tocando? A que estiver mais perto em cents.
        const cordas = tuningRef.current.strings;
        let melhor = 0;
        let menorDistancia = Infinity;
        for (let i = 0; i < cordas.length; i++) {
          const d = Math.abs(centsBetween(freq, cordas[i].freq));
          if (d < menorDistancia) {
            menorDistancia = d;
            melhor = i;
          }
        }

        const cents = centsBetween(freq, cordas[melhor].freq);
        targetRef.current = cents;
        activeRef.current = 1;

        setReading({
          frequency: freq,
          note: noteFromFrequency(freq),
          cents,
          stringIndex: melhor,
          clarity: r.clarity,
        });
      };

      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      const nome = (e as DOMException)?.name;
      setError(
        nome === "NotAllowedError" || nome === "SecurityError"
          ? "denied"
          : nome === "NotFoundError" || nome === "DevicesNotFoundError"
            ? "notfound"
            : "unknown",
      );
      setStatus("error");
    }
  }, []);

  // Ao sair da tela, desliga tudo. Sem isso o microfone continuaria ligado
  // enquanto o usuário joga a cobrinha.
  useEffect(() => stop, [stop]);

  return { status, error, reading, centsRef, activeRef, start, stop };
}

export type Tuner = ReturnType<typeof useTuner>;
