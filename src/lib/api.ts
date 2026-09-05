/**
 * Conversa com as rotas do servidor (pasta api/).
 *
 * Tudo aqui devolve a lista completa e atualizada — inclusive o POST. Assim,
 * depois de enviar um recado, a tela já mostra o resultado sem precisar de uma
 * segunda ida ao servidor.
 */

export interface Recado {
  id: string;
  nome: string;
  texto: string;
  em: number;
}

export interface Pontuacao {
  id: string;
  nome: string;
  pontos: number;
  em: number;
}

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(url, init);
  } catch {
    // Falha de rede: sem internet, ou o servidor não respondeu.
    throw new Error("Sem conexão com o servidor.");
  }

  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = (dados as { erro?: string } | null)?.erro;
    throw new Error(erro ?? "Algo deu errado. Tente de novo.");
  }
  return dados as T;
}

function enviarJson<T>(url: string, corpo: unknown): Promise<T> {
  return pedir<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
}

export const listarRecados = () => pedir<{ itens: Recado[] }>("/api/recados");

export const enviarRecado = (nome: string, texto: string) =>
  enviarJson<{ itens: Recado[] }>("/api/recados", { nome, texto });

export const listarRanking = () => pedir<{ itens: Pontuacao[] }>("/api/ranking");

export const enviarPontuacao = (nome: string, pontos: number) =>
  enviarJson<{ itens: Pontuacao[] }>("/api/ranking", { nome, pontos });
