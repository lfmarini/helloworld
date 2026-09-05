/** Transforma uma data em texto curto do tipo "há 5 min". */
export function tempoRelativo(quando: number): string {
  const segundos = Math.max(0, Math.floor((Date.now() - quando) / 1000));
  if (segundos < 60) return "agora";

  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `há ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;

  const dias = Math.floor(horas / 24);
  if (dias < 30) return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;

  return new Date(quando).toLocaleDateString("pt-BR");
}
