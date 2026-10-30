# Dźwięki INWAZJA

Ten katalog zawiera **tymczasowe, wygenerowane proceduralnie** pliki WAV. Możesz je podmienić
na własne nagrania **pod tymi samymi nazwami** — silnik (`src/game/audio/`) nie wymaga wtedy
żadnych zmian. Jeśli chcesz użyć innego formatu (np. `.ogg` / `.mp3`), zmień rozszerzenie
w funkcji `audioFile()` w `src/game/audio/manifest.ts`.

## Pliki

| Plik | Kiedy gra |
| --- | --- |
| `ui-click.wav` | szare przyciski paska w grze; flagi języka i pełny ekran w menu |
| `ui-select.wav` | wybór broni klawiszem 1–4 lub kartą na dolnym pasku |
| `ui-wave.wav` | przycisk FALA / spacja (start fali) |
| `ui-start.wav` | przycisk ROZPOCZNIJ OBRONĘ (także Enter/Spacja w menu) |
| `ui-victory.wav` | pokazanie planszy zwycięstwa |
| `ui-defeat.wav` | pokazanie planszy porażki |
| `tower-place.wav` | postawienie wieży |
| `tower-upgrade-1.wav` | pierwsze ulepszenie wieży |
| `tower-upgrade-2.wav` | drugie (maksymalne) ulepszenie wieży |
| `shot-arrow.wav` | wystrzał wieży strzał |
| `shot-cannon.wav` | wystrzał armaty |
| `shot-frost.wav` | wystrzał wieży mrozu |
| `shot-lightning.wav` | wystrzał wieży błyskawic |
| `explosion-enemy.wav` | śmierć podstawowego/szybkiego/czołgu (wspólny sample, pitch i głośność losowane) |
| `explosion-boss.wav` | śmierć bossa |
| `explosion-megaboss.wav` | śmierć mega bossa |
| `base-hit.wav` | wróg dociera do bazy gracza (utrata punktów/żyć); bossy brzmią niżej i głośniej |
| `loop-basic.wav` | pętla, gdy na planszy jest choć jeden podstawowy wróg |
| `loop-fast.wav` | pętla, gdy na planszy jest choć jeden szybki wróg |
| `loop-tank.wav` | pętla, gdy na planszy jest choć jeden czołg |
| `loop-boss.wav` | pętla, gdy na planszy jest choć jeden boss |
| `loop-megaboss.wav` | pętla, gdy na planszy jest choć jeden mega boss |
| `music-game.wav` | główny loop rozgrywki (gra przez cały czas, gdy dźwięk jest włączony) |

## Zasady silnika

- **Jeden loop na rodzaj wroga** — 6 czołgów to nadal jeden `loop-tank`, od pojawienia się
  pierwszego do śmierci/zniknięcia ostatniego.
- **Pitch i głośność**: wystrzały i ulepszenia skalują się poziomem wieży; zwykłe wybuchy losują
  lekki pitch/gain; bossy mają stały, dedykowany sample.
- **Sample ma pierwszeństwo** — silnik czeka na zakończenie ładowania pliku zamiast od razu
  grać syntezator. Fallback z `manifest.ts` jest używany dopiero, gdy plik jest niedostępny
  albo nie da się go odkodować.
- **PWA buforuje sample lokalnie** — service worker zapisuje pliki audio w cache podczas
  instalacji, odczytuje je z cache w pierwszej kolejności, a przy braku kopii pobiera z sieci.
- **Dźwięk domyślnie wyłączony** — włącznik w menu (ikona nuty obok pełnego ekranu) jest gestem
  zezwalającym przeglądarce na AudioContext; stan zapisuje się w `localStorage`.
- Zmiana nazw plików: `src/game/audio/manifest.ts`. Ponowne wygenerowanie tymczasowych dźwięków:
  `node scripts/generate-audio.mjs`.
