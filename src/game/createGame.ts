import Phaser from 'phaser';
import { GAME_W, GAME_H } from './data';
import { BootScene, MenuScene, VictoryScene } from './scenes';
import { GameScene } from './GameScene';

/** Tworzy instancję gry Phaser osadzoną w elemencie #game-root (skalowanie FIT). */
export function createGame(parent: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: GAME_W,
    height: GAME_H, // 800x730: pasek HUD (60) + plansza (600) + panel wież (70)
    parent,
    backgroundColor: '#0b1220',
    // wygładzone renderowanie; ostrość napisów zapewnia rozdzielczość
    // ustawiana per-tekst (UI_RESOLUTION w stylach tekstu)
    render: {
      antialias: true,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, MenuScene, GameScene, VictoryScene],
  });
}
