import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  get,
  put,
} from "@vercel/blob";
import { createHash } from "node:crypto";

/**
 * Guarda e lê os dados compartilhados (recados e ranking) no Vercel Blob.
 *
 * O Blob guarda arquivos, não é um banco de dados de verdade — então cada
 * coleção é um arquivo JSON que precisa ser lido, alterado e gravado inteiro.
 * O risco óbvio disso seria perder dados: se duas pessoas comentassem no mesmo
 * instante, as duas leriam a mesma lista e a segunda gravação apagaria a
 * primeira.
 *
 * Resolvemos com escrita condicional. Toda leitura vem com uma "etiqueta"
 * (etag) que identifica aquela versão exata do arquivo. Na hora de gravar,
 * mandamos a etiqueta junto e dizemos: só grave se o arquivo ainda estiver
 * nesta versão. Se alguém tiver gravado no meio do caminho, a gravação é
 * recusada, e a gente lê de novo e refaz a alteração por cima do dado novo.
 * Nada se perde.
 */

/** Quantas vezes tentar de novo quando duas gravações se cruzam. */
const TENTATIVAS = 12;

/** Erro de quem tentou muitas vezes e desistiu: a rota devolve 503, não 500. */
export class ConflitoDemais extends Error {
  constructor() {
    super("Muita gente enviando ao mesmo tempo. Tente de novo em instantes.");
    this.name = "ConflitoDemais";
  }
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Tira o prefixo "W/" da etiqueta de versao.
 *
 * Quando a resposta vem comprimida, o servidor devolve uma etiqueta "fraca"
 * (W/"abc") em vez da forte ("abc"). As duas apontam para o mesmo conteudo,
 * mas a gravacao condicional so aceita a forte — com a fraca ela recusa tudo,
 * sempre, com "ETag mismatch".
 *
 * Isso e traicoeiro porque so aparece depois que o arquivo cresce: enquanto os
 * dados eram poucos, nada era comprimido, a etiqueta vinha forte e tudo
 * funcionava. Foi assim que o problema passou batido nos primeiros testes.
 */
function etiquetaForte(etag: string | undefined): string | undefined {
  return etag?.replace(/^W\//, "");
}

async function ler<T>(
  caminho: string,
  padrao: T,
): Promise<{ dados: T; etag?: string }> {
  try {
    // useCache: false vai direto na origem. Sem isso, poderíamos ler uma
    // versão antiga guardada no cache da rede de distribuição e sobrescrever
    // recados que já existem.
    const r = await get(caminho, { access: "private", useCache: false });
    if (!r || !r.stream) return { dados: padrao };
    const texto = await new Response(r.stream).text();
    return { dados: JSON.parse(texto) as T, etag: etiquetaForte(r.blob.etag) };
  } catch (e) {
    if (e instanceof BlobNotFoundError) return { dados: padrao };
    throw e;
  }
}

/** Lê a coleção sem intenção de gravar. */
export async function lerColecao<T>(caminho: string, padrao: T): Promise<T> {
  const { dados } = await ler(caminho, padrao);
  return dados;
}

/**
 * Lê, aplica a alteração e grava — repetindo se alguém gravar no meio.
 * Devolve o conteúdo final já gravado.
 */
export async function atualizar<T>(
  caminho: string,
  padrao: T,
  mudar: (atual: T) => T,
): Promise<T> {
  for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {
    const { dados, etag } = await ler(caminho, padrao);
    const novo = mudar(dados);

    try {
      await put(caminho, JSON.stringify(novo), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        cacheControlMaxAge: 0,
        // Com etiqueta: só grava se ninguém mexeu. Sem etiqueta (arquivo ainda
        // não existe): só grava se ninguém tiver criado antes da gente.
        ...(etag
          ? { allowOverwrite: true, ifMatch: etag }
          : { allowOverwrite: false }),
      });
      return novo;
    } catch (e) {
      const conflito =
        e instanceof BlobPreconditionFailedError ||
        // O caso "outra pessoa criou o arquivo primeiro" não tem classe de erro
        // própria; identificamos pela mensagem e tratamos como conflito normal.
        (!etag && e instanceof Error && /exist/i.test(e.message));
      if (!conflito) throw e;
      // Espera crescente E com sorteio. O sorteio é o detalhe que importa:
      // sem ele, todos os pedidos em conflito acordariam no mesmo instante e
      // colidiriam de novo, em bloco, a cada rodada.
      const base = 40 * (tentativa + 1);
      await espera(base * (0.5 + Math.random()));
    }
  }
  throw new ConflitoDemais();
}

/* ------------------------------------------------------------------ */
/* Utilidades usadas pelas duas rotas                                  */
/* ------------------------------------------------------------------ */

/**
 * Identifica quem está enviando, para o limite de tempo entre envios.
 *
 * Guardamos um resumo criptográfico do IP, nunca o IP em si: serve para
 * reconhecer envios seguidos da mesma origem sem armazenar de quem são.
 */
export function marcaDeOrigem(cabecalhos: Record<string, unknown>): string {
  const bruto = String(
    cabecalhos["x-forwarded-for"] ?? cabecalhos["x-real-ip"] ?? "desconhecido",
  );
  const ip = bruto.split(",")[0].trim();
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

/** Remove espaços das pontas, corta no tamanho máximo e tira caracteres de controle. */
export function limpaTexto(valor: unknown, maximo: number): string {
  if (typeof valor !== "string") return "";
  // Descarta caracteres de controle (quebras de linha, tabulacoes, bytes
  // invisiveis) comparando o codigo de cada caractere. Fazemos assim, e nao
  // com uma expressao regular, porque o codigo fica legivel e sem escapes.
  const visivel = Array.from(valor)
    .filter((c) => {
      const codigo = c.codePointAt(0) ?? 0;
      return codigo >= 32 && codigo !== 127;
    })
    .join("");
  return visivel.replace(/  +/g, " ").trim().slice(0, maximo);
}

export interface ComEspera {
  /** Marca de origem -> instante do último envio. */
  espera?: Record<string, number>;
}

/**
 * Aplica o intervalo mínimo entre envios da mesma origem e limpa marcas
 * antigas, para o arquivo não crescer para sempre.
 */
export function podeEnviar(
  dados: ComEspera,
  marca: string,
  intervaloMs: number,
): boolean {
  const agora = Date.now();
  const mapa = dados.espera ?? {};
  for (const [chave, quando] of Object.entries(mapa)) {
    if (agora - quando > intervaloMs) delete mapa[chave];
  }
  dados.espera = mapa;
  return !(marca in mapa);
}

export function registraEnvio(dados: ComEspera, marca: string) {
  dados.espera = { ...(dados.espera ?? {}), [marca]: Date.now() };
}
