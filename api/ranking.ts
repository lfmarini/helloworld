import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  atualizar,
  lerColecao,
  limpaTexto,
  marcaDeOrigem,
  podeEnviar,
  registraEnvio,
  type ComEspera,
  ConflitoDemais,
} from "./_armazem.js";

/**
 * Cada jogo tem a sua tabela.
 *
 * A lista é fechada e mora no servidor de propósito: o nome do jogo vira nome
 * de arquivo, e aceitar qualquer texto vindo do navegador deixaria alguém
 * escolher onde gravar. Aqui só entra o que está nesta lista.
 *
 * "ordem" diz o que é melhor: na cobrinha e na plataforma, mais pontos; na
 * corrida, menos tempo.
 */
const JOGOS = {
  // Mantém o arquivo antigo: os recordes da cobrinha já estão lá dentro.
  cobrinha: { arquivo: "ranking.json", ordem: "maior", maximo: 17 * 17 - 3 },
  // Valor em centésimos de segundo, para ficar inteiro. Teto de 20 minutos.
  corrida: { arquivo: "ranking-corrida.json", ordem: "menor", maximo: 120_000 },
  plataforma: {
    arquivo: "ranking-plataforma.json",
    ordem: "maior",
    maximo: 90_000,
  },
} as const;

type NomeDeJogo = keyof typeof JOGOS;

/** Quantas posições cada tabela guarda. */
const LIMITE = 20;
const NOME_MAX = 20;
const ESPERA_MS = 10_000;

export interface Pontuacao {
  id: string;
  nome: string;
  pontos: number;
  em: number;
}

interface Ranking extends ComEspera {
  itens: Pontuacao[];
}

const VAZIO: Ranking = { itens: [] };

function paraOCliente(ranking: Ranking) {
  return { itens: ranking.itens };
}

/** Lê o jogo pedido. Sem nome, assume a cobrinha — era o único que existia. */
function jogoPedido(valor: unknown): NomeDeJogo | null {
  const nome = typeof valor === "string" && valor ? valor : "cobrinha";
  return nome in JOGOS ? (nome as NomeDeJogo) : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method === "GET") {
      const jogo = jogoPedido(req.query.jogo);
      if (!jogo) return res.status(400).json({ erro: "Jogo desconhecido." });
      const ranking = await lerColecao<Ranking>(JOGOS[jogo].arquivo, VAZIO);
      return res.status(200).json(paraOCliente(ranking));
    }

    if (req.method === "POST") {
      const corpo = (req.body ?? {}) as Record<string, unknown>;
      const jogo = jogoPedido(corpo.jogo);
      if (!jogo) return res.status(400).json({ erro: "Jogo desconhecido." });

      const config = JOGOS[jogo];
      const nome = limpaTexto(corpo.nome, NOME_MAX);
      const pontos = Number(corpo.pontos);

      if (!nome) {
        return res.status(400).json({ erro: "Escreva seu nome." });
      }
      if (!Number.isInteger(pontos) || pontos < 1 || pontos > config.maximo) {
        return res.status(400).json({ erro: "Pontuação inválida." });
      }

      const marca = marcaDeOrigem(req.headers as Record<string, unknown>);
      let recusa: string | null = null;

      const ranking = await atualizar<Ranking>(config.arquivo, VAZIO, (atual) => {
        if (!podeEnviar(atual, marca, ESPERA_MS)) {
          recusa = "Espere alguns segundos antes de enviar de novo.";
          return atual;
        }
        registraEnvio(atual, marca);

        // Um nome ocupa uma linha só, com a melhor marca dele. Sem isso, quem
        // jogasse muito encheria a tabela inteira sozinho.
        const chave = nome.toLowerCase();
        const outros = atual.itens.filter((p) => p.nome.toLowerCase() !== chave);
        const anterior = atual.itens.find((p) => p.nome.toLowerCase() === chave);

        const melhor =
          anterior === undefined
            ? pontos
            : config.ordem === "maior"
              ? Math.max(pontos, anterior.pontos)
              : Math.min(pontos, anterior.pontos);

        const registro: Pontuacao = {
          id:
            anterior?.id ??
            `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          nome,
          pontos: melhor,
          // Guarda a data da melhor marca: empatou, quem chegou antes fica na frente.
          em: melhor === anterior?.pontos ? anterior.em : Date.now(),
        };

        const itens = [...outros, registro]
          .sort((a, b) =>
            config.ordem === "maior"
              ? b.pontos - a.pontos || a.em - b.em
              : a.pontos - b.pontos || a.em - b.em,
          )
          .slice(0, LIMITE);

        return { ...atual, itens };
      });

      if (recusa) return res.status(429).json({ erro: recusa });
      return res.status(201).json(paraOCliente(ranking));
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ erro: "Método não permitido." });
  } catch (e) {
    if (e instanceof ConflitoDemais) {
      return res.status(503).json({ erro: e.message });
    }
    console.error("Falha no ranking:", e);
    return res
      .status(500)
      .json({ erro: "Não foi possível acessar o ranking agora." });
  }
}
