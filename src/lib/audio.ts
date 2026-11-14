import type { AudioPlayer } from 'expo-audio';

/**
 * expo-audio expone `loop` y `volume` como propiedades mutables del
 * reproductor. Se encapsula aquí para no mutar directamente el objeto
 * devuelto por el hook dentro del componente.
 */
export function configurePlayer(
  player: AudioPlayer,
  options: { loop?: boolean; volume?: number; restart?: boolean } = {},
): void {
  if (options.loop !== undefined) player.loop = options.loop;
  if (options.volume !== undefined) player.volume = options.volume;
  if (options.restart) player.seekTo(0);
}
