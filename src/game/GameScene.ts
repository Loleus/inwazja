import Phaser from 'phaser';
import {
  CELL,
  COLS,
  ROWS,
  GAME_W,
  GAME_H,
  WORLD_Y,
  PLAY_BOTTOM,
  DEPTH,
  TOTAL_WAVES,
  TOWER_SCALE,
  START_GOLD,
  START_LIVES,
  SPEEDS,
  SELL_FACTOR,
  TOWER_ORDER,
  TOWER_INFO,
  TOWER_STATS,
  PROJECTILE_SPEED,
  ENEMY_ORDER,
  ENEMY_STYLE,
  ENEMY_POINTS,
  LEVEL_SCORE_FACTOR,
  SCORE_WAVE_STEP,
  type TowerType,
  type TowerLevelStats,
  type EnemyType,
  type EnemyConfig,
  type Wave,
  type LanePath,
  cellCenter,
  pointerCell,
  pointerOnBoard,
  onBoard,
  isPath,
  isAdjacentToPath,
  getPathById,
  canAffect,
  cardBackground,
  damageFactor,
  isBossType,
  damageLabel,
  makeWaves,
  waveHasBoss,
  isBetterTarget,
  UI_FONT,
  UI_RESOLUTION,
} from './data';
import { drawMap, drawLaneArrows, drawExitArrows, drawStoneBar, laneEntryArrowAt } from './scenes';
import { makeStoneSurfaceTexture } from './textures';
import { t, towerName, enemyName } from './i18n';

const FONT = UI_FONT;

/** Trzy drogi ataku — aktywne od pierwszej fali. */
const LANES = ['A', 'B', 'C'] as const;

interface Tower {
  type: TowerType;
  level: number;
  col: number;
  row: number;
  sprite: Phaser.GameObjects.Image;
  lastFired: number;
  invested: number;
  homeX: number;
  homeY: number;
  // odrzut po strzale: kierunek (px) i czas gry, do którego trwa — bez tweenów
  recoilDx: number;
  recoilDy: number;
  recoilUntil: number;
}

interface Enemy {
  config: EnemyConfig;
  hp: number;
  maxHp: number;
  sprite: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Rectangle;
  barBg: Phaser.GameObjects.Rectangle;
  barW: number;
  barOffset: number;
  path: LanePath;
  pathIndex: number;
  x: number;
  y: number;
  baseSpeed: number;
  travelled: number;
  remaining: number;
  slowTimer: number;
  slowFactor: number;
  alive: boolean;
  onBoard: boolean;
  damage: number;
  lastResistFx: number;
  barPct: number;
  tinted: boolean;
  targetScale: number;
  spawnT: number;
}

/** Efekt wizualny z puli: interpolacja pozycji/skali/alfy liczona ręcznie w updateFx. */
interface Fx {
  kind: 'rect' | 'circle';
  obj: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc;
  t: number;
  dur: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  s0: number;
  s1: number;
  a0: number;
  a1: number;
  ease: number;
}

interface Projectile {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  targetEnemy: Enemy;
  speed: number;
  towerType: TowerType;
  towerLevel: number;
  damage: number;
  slow: number;
  slowDuration: number;
  chain: number;
  chainDamage: number[];
  alive: boolean;
}

interface SpawnEntry {
  config: EnemyConfig;
  pathId: string;
  at: number;
}

/* =========================================================================================
   Scena gry: górny pasek HUD, plansza 32x24, dolny panel z kartami wież.
   Cała komunikacja z graczem idzie przez pasek statusu — plansza jest bez napisów.
   ========================================================================================= */
export class GameScene extends Phaser.Scene {
  private waves: Wave[] = [];
  private waveNumber = 0;
  private waveActive = false;
  private gold = START_GOLD;
  private lives = START_LIVES;
  private score = 0;
  private kills = 0;
  private goldEarned = 0;
  private clock = 0;
  private gameSpeed = 1;
  private speedIndex = 0;
  private paused = false;
  private gameEnded = false;
  private finished = false;

  private towers: Tower[] = [];
  private gridTowers: (Tower | null)[][] = [];
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private spawnQueue: SpawnEntry[] = [];
  private spawnCursor = 0;
  private enemiesAliveInWave = 0;

  private selectedTowerType: TowerType | null = null;
  private selectedTower: Tower | null = null;
  private infoPanelItems: Phaser.GameObjects.GameObject[] = [];
  private infoPanelOpen = false;
  private uiGuard = false;

  private goldText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private scoreValue!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private prompterBackground!: Phaser.GameObjects.Graphics;
  private prompterWidth = 0;
  private prompterCountersRight = -1;
  private defaultPrompterText = '';
  private readonly prompterHeight = 48;
  private statusUntil = 0;
  private lastStatusColor = '';
  private speedText!: Phaser.GameObjects.Text;
  private speedButton!: Phaser.GameObjects.Rectangle;
  private pauseButton!: Phaser.GameObjects.Rectangle;
  private pauseShade!: Phaser.GameObjects.Rectangle;
  private previewGfx!: Phaser.GameObjects.Graphics;
  private placementPreview!: Phaser.GameObjects.Image;
  private towerButtons: Record<string, { bg: Phaser.GameObjects.Rectangle; hoverFrame: Phaser.GameObjects.Rectangle; hoverTween: Phaser.Tweens.Tween | null; icon: Phaser.GameObjects.Image; coin: Phaser.GameObjects.Image; name: Phaser.GameObjects.Text; cost: Phaser.GameObjects.Text; key: Phaser.GameObjects.Text; state: number }> = {};
  private hoveredLaneEntry: string | null = null;
  private hoveredTowerKey = '';
  private lastHoverRefreshAt = 0;
  private previewHidden = true;
  private previewCellKey = '';

  constructor() {
    super('GameScene');
  }

  create() {
    this.waves = makeWaves();
    this.waveNumber = 0;
    this.waveActive = false;
    this.gold = START_GOLD;
    this.lives = START_LIVES;
    this.score = 0;
    this.kills = 0;
    this.goldEarned = 0;
    this.clock = 0;
    this.speedIndex = 0;
    this.gameSpeed = SPEEDS[0];
    this.paused = false;
    this.gameEnded = false;
    this.finished = false;
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    // pule efektów/pocisków: po restarcie sceny stare obiekty są już zniszczone przez Phaser
    this.projectilePool = [];
    this.fxPool = [];
    this.fxActive = [];
    this.lightningPool = [];
    this.lightningActive = [];
    this.spawnQueue = [];
    this.spawnCursor = 0;
    this.enemiesAliveInWave = 0;
    this.selectedTowerType = null;
    this.selectedTower = null;
    this.infoPanelItems = [];
    this.infoPanelOpen = false;
    this.uiGuard = false;
    this.statusUntil = 0;
    this.lastStatusColor = '';
    this.prompterCountersRight = -1;
    this.defaultPrompterText = t('shortcuts');
    this.gridTowers = Array.from({ length: COLS }, () => Array<null>(ROWS).fill(null));

    drawMap(this, 1);
    drawLaneArrows(this, 1, true);
    drawExitArrows(this, 1, true);
    this.buildTopBar();
    this.buildBottomPanel();

    this.previewGfx = this.add.graphics().setDepth(DEPTH.TOWER + 2);
    this.placementPreview = this.add
      .image(0, 0, 'tower-arrow')
      .setAlpha(0.65)
      .setVisible(false)
      .setDepth(DEPTH.TOWER + 1)
      .setScale(TOWER_SCALE);

    this.pauseShade = this.add
      .rectangle(400, WORLD_Y + 300, GAME_W, 600, 0x020617, 0.45)
      .setDepth(DEPTH.PANEL + 5)
      .setVisible(false);
    this.hoveredLaneEntry = null;

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.handleHover(pointer));
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handleClick(pointer));
    this.bindKeys();

    this.cameras.main.fadeIn(240, 0, 0, 0);
    this.setStatus(t('intro'), '#a5b4fc', 5200);
    this.refreshHud();
    this.refreshTowerButtons();
  }

  /* ------------------------------- pasek górny ------------------------------- */
  private buildTopBar() {
    const topY = WORLD_Y / 2;
    drawStoneBar(this, topY, WORLD_Y, DEPTH.HUD);
    this.add.rectangle(400, WORLD_Y - 1, 800, 2, 0x334155).setDepth(DEPTH.HUD);

    // --- Dwa wiersze liczników po lewej (wyrównane w pionie):
    //     wiersz 1: złoto · życie      wiersz 2: punkty · fala ---
    // Szarfa z ikonami proporcjonalnie mniejsza (-25%): coin 0.9, serce 0.86.
    const row1 = 17;
    const row2 = 42;
    const colB = 102;

    this.add.image(22, row1, 'icon-coin').setDepth(DEPTH.HUD).setScale(0.9);
    this.goldText = this.add
      .text(42, row1, '' + START_GOLD, {
        fontFamily: FONT, fontSize: '19px', color: '#fbbf24', fontStyle: 'bold', resolution: UI_RESOLUTION,
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.HUD);
    this.add.image(colB + 8, row1, 'icon-heart').setDepth(DEPTH.HUD).setScale(0.86);
    this.livesText = this.add
      .text(colB + 22, row1, '' + START_LIVES, {
        fontFamily: FONT, fontSize: '19px', color: '#f87171', fontStyle: 'bold', resolution: UI_RESOLUTION,
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.HUD);

    // Wiersz 2: duża litera P (PL) / S (EN) proporcjonalna do ikony fali i cyfry
    // w dokładnie tym samym rozmiarze, co cyfry licznika fali (17 px).
    this.scoreText = this.add
      .text(22, row2, t('scoreMark') + ':', {
        fontFamily: FONT, fontSize: '24px', color: '#fbbf24', fontStyle: 'bold', resolution: UI_RESOLUTION,
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.HUD);
    // Cyfry mają zostać dokładnie w dotychczasowym miejscu — zapamiętujemy ich X
    // przed wyśrodkowaniem oznaczenia pod ikoną złota (środek ikony to x = 22).
    const scoreValueX = this.scoreText.x + this.scoreText.width + 3;
    this.scoreText.setOrigin(0.5, 0.5);
    this.scoreValue = this.add
      .text(scoreValueX, row2, '0', {
        fontFamily: FONT, fontSize: '17px', color: '#fbbf24', fontStyle: 'bold', resolution: UI_RESOLUTION,
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.HUD);
    this.add.image(colB + 8, row2, 'icon-wave').setDepth(DEPTH.HUD).setScale(1.05);
    this.waveText = this.add
      .text(colB + 22, row2, '0/' + TOTAL_WAVES, {
        fontFamily: FONT, fontSize: '17px', color: '#93c5fd', fontStyle: 'bold', resolution: UI_RESOLUTION,
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.HUD);

    // Translucent green tint preserves the bar's stone grain beneath the prompter.
    this.prompterBackground = this.add.graphics()
      .setName('game-prompter-background')
      .setDepth(DEPTH.HUD);
    this.statusText = this.add
      .text(0, topY, '', {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#d9e8d9',
        align: 'center',
        lineSpacing: 3,
        resolution: UI_RESOLUTION,
      })
      .setOrigin(0.5, 0.5)
      .setName('game-prompter-text')
      .setDepth(DEPTH.HUD + 1);
    this.layoutPrompter();
    this.displayPrompterText(this.defaultPrompterText, '#d9e8d9');

    // większe przyciski sterujące (36x34) z czytelnymi napisami + szeroki przycisk FALA
    const smallButton = (x: number, handler: () => void) => {
      const bg = this.add
        .rectangle(x, topY, 36, 34, 0x1e293b)
        .setStrokeStyle(1.5, 0x475569)
        .setDepth(DEPTH.HUD)
        .setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setFillStyle(0x334155));
      bg.on('pointerout', () => bg.setFillStyle(0x1e293b));
      bg.on('pointerdown', handler);
      return bg;
    };
    const glyph = (x: number, label: string, fontSize: number, bold = false) =>
      this.add
        .text(x, topY, label, {
          fontFamily: FONT,
          fontSize: fontSize + 'px',
          color: '#e2e8f0',
          fontStyle: bold ? 'bold' : 'normal',
          resolution: UI_RESOLUTION,
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.HUD + 1);

    smallButton(504, () => this.scene.restart());
    glyph(504, '↻', 19);
    smallButton(545, () => this.toggleFullscreen());
    glyph(545, '⤢', 19);
    smallButton(586, () => this.scene.start('MenuScene'));
    glyph(586, '≡', 21);
    this.speedButton = smallButton(627, () => this.toggleSpeed());
    this.speedText = glyph(627, '1×', 16, true);
    this.pauseButton = smallButton(668, () => this.togglePause());
    // ikona pauzy z prostokątów — zawsze czytelna, niezależnie od czcionki
    this.add.rectangle(664, topY, 4.5, 15, 0xe2e8f0).setDepth(DEPTH.HUD + 1);
    this.add.rectangle(672, topY, 4.5, 15, 0xe2e8f0).setDepth(DEPTH.HUD + 1);

    // Reuse the start button's exact green stone texture without stretching its grain.
    const waveTexture = makeStoneSurfaceTexture(this, 0x16a34a, 102, 38, 210, 44, 0.13);
    if (waveTexture) this.add.image(744, topY, waveTexture).setDisplaySize(102, 38).setDepth(DEPTH.HUD);
    const sendButton = this.add
      .rectangle(744, topY, 102, 38, 0x16a34a, waveTexture ? 0 : 1)
      .setStrokeStyle(1.5, 0x4ade80)
      .setDepth(DEPTH.HUD)
      .setInteractive({ useHandCursor: true });
    const sendHoverFrame = this.add
      .rectangle(744, topY, 102, 38, 0x000000, 0)
      .setStrokeStyle(1.5, 0xbbf7d0, 1)
      .setAlpha(0)
      .setDepth(DEPTH.HUD + 1);
    this.add
      .text(744, topY, t('wave'), {
        fontFamily: FONT, fontSize: '15px', color: '#ecfdf5', fontStyle: 'bold', resolution: UI_RESOLUTION,
      })
      .setOrigin(0.5)
      .setShadow(0, 2, '#022c1a', 4, true, true)
      .setDepth(DEPTH.HUD + 1);
    // Zapowiedź fali pokazuje się wyłącznie po najechaniu na strzałkę wejścia na planszy.
    const animateWaveFrame = (alpha: number) => {
      this.tweens.killTweensOf(sendHoverFrame);
      this.tweens.add({
        targets: sendHoverFrame,
        alpha,
        duration: 200,
        ease: 'Sine.easeOut',
      });
    };
    sendButton.on('pointerover', () => animateWaveFrame(1));
    sendButton.on('pointerout', () => animateWaveFrame(0));
    sendButton.on('pointerdown', () => this.sendWave());
  }

  /* ------------------------------- panel dolny ------------------------------- */
  private buildBottomPanel() {
    const panelTop = PLAY_BOTTOM;
    drawStoneBar(this, (panelTop + GAME_H) / 2, GAME_H - PLAY_BOTTOM, DEPTH.HUD);
    this.add.rectangle(400, panelTop, 800, 2, 0x334155).setDepth(DEPTH.HUD);

    this.towerButtons = {};
    // Wyśrodkowanie przycisków w dolnym pasku:
    // Szerokość każdego przycisku 160 px, odstęp 16 px -> 4 * 160 + 3 * 16 = 688 px.
    // Zostaje 112 px zapasu (po 56 px z lewej i prawej), środki przycisków: 136, 312, 488, 664.
    const btnW = 160;
    const btnGap = 16;
    const startX = (GAME_W - (4 * btnW + 3 * btnGap)) / 2 + btnW / 2; // 56 + 80 = 136

    const paddingY = 10;
    const borderWidth = 2;
    const btnMidY = (panelTop + GAME_H) / 2;
    const bgMidY = btnMidY;
    const iconY = btnMidY + 4;
    const buttonFaces: Phaser.GameObjects.Image[] = [];
    let contentTop = Infinity;
    let contentBottom = -Infinity;

    TOWER_ORDER.forEach((type, index) => {
      const info = TOWER_INFO[type];
      const stats = TOWER_STATS[type][0];
      const x = startX + index * (btnW + btnGap);
      const color = cardBackground(info.color);
      // Apply the final stone texture after measuring the content, preserving draw order.
      const face = this.add.image(x, bgMidY, 'tile-grass').setVisible(false).setDepth(DEPTH.HUD);
      buttonFaces.push(face);
      const bg = this.add
        .rectangle(x, bgMidY, btnW, 1, color, 1)
        .setStrokeStyle(borderWidth, info.color, 0.4)
        .setDepth(DEPTH.HUD)
        .setInteractive({ useHandCursor: true });
      // Osobna warstwa tylko do płynnego rozjaśnienia ramki po najechaniu (0,2 s).
      // Nie rusza tła ani zawartości przycisku i nie koliduje ze stanem wyboru.
      const brighten = (hex: number, amount: number) => {
        const r = Math.round(((hex >> 16) & 255) + (255 - ((hex >> 16) & 255)) * amount);
        const g = Math.round(((hex >> 8) & 255) + (255 - ((hex >> 8) & 255)) * amount);
        const b = Math.round((hex & 255) + (255 - (hex & 255)) * amount);
        return (r << 16) | (g << 8) | b;
      };
      const hoverFrame = this.add
        .rectangle(x, bgMidY, btnW, 1, 0x000000, 0)
        .setStrokeStyle(3, brighten(info.color, 0.45), 1)
        .setAlpha(0)
        .setDepth(DEPTH.HUD + 1);
      const icon = this.add.image(x - 50, iconY, 'tower-' + type).setDepth(DEPTH.HUD).setScale(0.85);
      const name = this.add
        .text(x - 22, btnMidY - 14, towerName(type), {
          fontFamily: FONT, fontSize: '14px', color: '#e2e8f0', fontStyle: 'bold', resolution: UI_RESOLUTION,
        })
        .setDepth(DEPTH.HUD);
      // cena: ikonka monety + liczba · obrażenia
      const coin = this.add.image(x - 15, btnMidY + 10, 'icon-coin').setDepth(DEPTH.HUD).setScale(0.66);
      const cost = this.add
        .text(x - 5, btnMidY + 3, `${stats.cost} · ${damageLabel(stats)}`, {
          fontFamily: FONT, fontSize: '12px', color: '#fbbf24', resolution: UI_RESOLUTION,
        })
        .setDepth(DEPTH.HUD);
      const key = this.add
        .text(x + 74, btnMidY - 16, '[' + info.hotkey + ']', {
          fontFamily: FONT, fontSize: '11px', color: '#d9e8d9', resolution: UI_RESOLUTION,
        })
        .setOrigin(1, 0)
        .setDepth(DEPTH.HUD);
      let hoverTween: Phaser.Tweens.Tween | null = null;
      const animateHoverFrame = (alpha: number) => {
        hoverTween?.stop();
        hoverTween = this.tweens.add({
          targets: hoverFrame,
          alpha,
          duration: 200,
          ease: 'Sine.easeOut',
        });
        const stored = this.towerButtons[type];
        if (stored) stored.hoverTween = hoverTween;
      };
      bg.on('pointerover', () => animateHoverFrame(1));
      bg.on('pointerout', () => animateHoverFrame(0));
      bg.on('pointerdown', () => this.selectTowerType(type));
      this.towerButtons[type] = { bg, hoverFrame, hoverTween, icon, coin, name, cost, key, state: -1 };

      for (const item of [icon, coin, name, cost, key]) {
        const bounds = item.getBounds();
        contentTop = Math.min(contentTop, bounds.top);
        contentBottom = Math.max(contentBottom, bounds.bottom);
      }
    });

    // One shared content band gives every button 10 px of padding at both inner edges.
    // All contents move together, retaining their existing sizes and relative positions.
    const btnH = contentBottom - contentTop + paddingY * 2 + borderWidth;
    const contentOffset = btnMidY - (contentTop + contentBottom) / 2;
    TOWER_ORDER.forEach((type, index) => {
      const btn = this.towerButtons[type];
      btn.bg.setSize(btnW, btnH);
      btn.hoverFrame.setSize(btnW, btnH);
      for (const item of [btn.icon, btn.coin, btn.name, btn.cost, btn.key]) {
        item.y += contentOffset;
      }
      const color = cardBackground(TOWER_INFO[type].color);
      const stoneKey = makeStoneSurfaceTexture(this, color, btnW, btnH, 152, 140);
      if (stoneKey) {
        buttonFaces[index].setTexture(stoneKey).setDisplaySize(btnW, btnH).setVisible(true);
        btn.bg.setFillStyle(color, 0);
      }
    });
  }

  private bindKeys() {
    const kb = this.input.keyboard;
    if (!kb) return;
    TOWER_ORDER.forEach((type, i) => {
      kb.on('keydown-' + ['ONE', 'TWO', 'THREE', 'FOUR'][i], () => this.selectTowerType(type));
    });
    kb.on('keydown-SPACE', () => this.sendWave());
    kb.on('keydown-U', () => this.upgradeSelected());
    kb.on('keydown-S', () => this.sellSelected());
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-F', () => this.toggleSpeed());
    kb.on('keydown-R', () => this.scene.restart());
    kb.on('keydown-M', () => this.scene.start('MenuScene'));
    kb.on('keydown-ESC', () => {
      this.selectedTowerType = null;
      this.placementPreview.setVisible(false);
      this.previewGfx.clear();
      this.closeInfoPanel();
      this.refreshTowerButtons();
    });
  }

  /* ------------------------------- HUD / status -------------------------------
     Tekst w Phaserze to osobny canvas + nowa tekstura przy każdym setText, więc HUD
     jest odświeżany najwyżej raz na klatkę i tylko gdy wartość faktycznie się zmieniła
     (w późnych falach ginie kilka wrogów na sekundę — bez tego każdy kill robił 4 tekstury). */
  private hudGold = -1;
  private hudLives = -1;
  private hudWave = -1;
  private hudScore = -1;
  private hudDirty = true;
  private buttonsDirty = true;
  private lastHudTextAt = 0;

  private refreshHud() {
    this.hudDirty = true;
  }

  private refreshTowerButtons() {
    this.buttonsDirty = true;
  }

  private flushHud() {
    if (this.hudDirty) {
      this.hudDirty = false;
      const now = this.time.now;
      // Złoto i punkty zmieniają się przy każdym zabiciu. Przerenderowanie tekstu
      // (nowa tekstura na canvasie)setki razy na sekundę było jednym ze źródeł przycięć,
      // więc liczniki odświeżamy najwyżej 8 razy na sekundę; po zakończeniu fali od razu.
      const canUpdateCounters = now - this.lastHudTextAt >= 120 || !this.waveActive;
      if (this.hudGold !== this.gold && canUpdateCounters) {
        this.hudGold = this.gold;
        this.goldText.setText('' + this.gold);
      }
      const lives = Math.max(0, this.lives);
      if (this.hudLives !== lives) {
        this.hudLives = lives;
        this.livesText.setText('' + lives);
      }
      if (this.hudWave !== this.waveNumber) {
        this.hudWave = this.waveNumber;
        this.waveText.setText(this.waveNumber + '/' + TOTAL_WAVES);
      }
      if (this.hudScore !== this.score && canUpdateCounters) {
        this.hudScore = this.score;
        this.scoreValue.setText('' + this.score);
        this.lastHudTextAt = now;
      }
      this.layoutPrompter();
    }
    if (this.buttonsDirty) {
      this.buttonsDirty = false;
      for (const type of TOWER_ORDER) {
        const btn = this.towerButtons[type];
        if (!btn) continue;
        const info = TOWER_INFO[type];
        const stats = TOWER_STATS[type][0];
        const affordable = this.gold >= stats.cost;
        const selected = this.selectedTowerType === type;
        const state = (affordable ? 1 : 0) | (selected ? 2 : 0);
        if (btn.state === state) continue; // nic się nie zmieniło dla tej karty
        btn.state = state;
        // Selection changes the frame only, keeping each weapon's stone color intact.
        btn.bg.setStrokeStyle(selected ? 3 : 2, info.color, selected ? 1 : affordable ? 0.4 : 0.18);
        const alpha = affordable ? 1 : 0.45;
        btn.icon.setAlpha(alpha);
        btn.coin.setAlpha(alpha);
        btn.name.setAlpha(alpha);
        btn.cost.setAlpha(alpha);
        btn.cost.setColor(affordable ? '#fbbf24' : '#f87171');
        btn.key.setAlpha(alpha);
      }
    }
  }

  /** Occupies 90% of the actual gap between the counters and the first control button. */
  private layoutPrompter() {
    const countersRight = Math.max(
      this.goldText.x + this.goldText.displayWidth,
      this.livesText.x + this.livesText.displayWidth,
      this.scoreValue.x + this.scoreValue.displayWidth,
      this.waveText.x + this.waveText.displayWidth,
    );
    if (Math.abs(countersRight - this.prompterCountersRight) < 0.5) return;
    this.prompterCountersRight = countersRight;
    const controlsLeft = 504 - 36 / 2;
    const availableWidth = controlsLeft - countersRight;
    this.prompterWidth = availableWidth * 0.9;
    const centerX = (countersRight + controlsLeft) / 2;
    const top = (WORLD_Y - this.prompterHeight) / 2;
    this.prompterBackground.clear();
    this.prompterBackground.fillStyle(0x315f37, 0.5);
    this.prompterBackground.fillRoundedRect(
      centerX - this.prompterWidth / 2, top, this.prompterWidth, this.prompterHeight, 4,
    );
    this.prompterBackground.lineStyle(2, 0x86efac, 1);
    this.prompterBackground.strokeRoundedRect(
      centerX - this.prompterWidth / 2, top, this.prompterWidth, this.prompterHeight, 4,
    );
    this.statusText.setX(centerX);
    this.statusText.setWordWrapWidth(this.prompterWidth - 18, true);
    this.fitPrompterText();
  }

  private fitPrompterText() {
    this.statusText.setScale(1).setFontSize(12);
    let size = 12;
    while (this.statusText.height > this.prompterHeight - 8 && size > 10) {
      size -= 0.5;
      this.statusText.setFontSize(size);
    }
    if (this.statusText.height > this.prompterHeight - 8) {
      this.statusText.setScale((this.prompterHeight - 8) / this.statusText.height);
    }
  }

  private displayPrompterText(message: string, color: string) {
    if (this.statusText.text === message && this.lastStatusColor === color) {
      return;
    }
    this.lastStatusColor = color;
    this.statusText.setText(message).setColor(color);
    this.fitPrompterText();
  }

  private setStatus(message: string, color = '#a5b4fc', holdMs = 2600) {
    this.statusUntil = this.time.now + holdMs;
    this.displayPrompterText(message, color);
  }

  private restorePrompterText() {
    if (this.statusUntil > 0 && this.time.now >= this.statusUntil) {
      this.statusUntil = 0;
      this.displayPrompterText(this.defaultPrompterText, '#d9e8d9');
    }
  }

  /* ------------------------------- sterowanie ------------------------------- */
  private toggleSpeed() {
    this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
    this.gameSpeed = SPEEDS[this.speedIndex];
    this.speedText.setText(this.gameSpeed + '×');
    this.speedButton.setStrokeStyle(1.5, this.gameSpeed === 1 ? 0x475569 : 0x4ade80);
  }

  private togglePause() {
    this.paused = !this.paused;
    this.pauseShade.setVisible(this.paused);
    this.pauseButton.setStrokeStyle(1, this.paused ? 0xfbbf24 : 0x475569);
  }

  private toggleFullscreen() {
    try {
      this.scale.toggleFullscreen();
    } catch {
      /* przeglądarka może odmówić bez gestu użytkownika */
    }
  }

  /* ------------------------------- budowanie wież ------------------------------- */
  private selectTowerType(type: TowerType) {
    if (this.gameEnded) return;
    const stats = TOWER_STATS[type][0];
    if (this.selectedTowerType === type) {
      this.selectedTowerType = null;
      this.placementPreview.setVisible(false);
      if (!this.previewHidden) this.previewGfx.clear();
      this.previewHidden = true;
      this.previewCellKey = '';
    } else {
      if (this.gold < stats.cost) {
        this.setStatus(t('noGoldTower', { cost: stats.cost }), '#f87171');
        return;
      }
      this.selectedTowerType = type;
      this.closeInfoPanel();
      this.placementPreview.setTexture('tower-' + type).setVisible(true);
      this.previewCellKey = '';
      this.previewHidden = true;
    }
    this.refreshTowerButtons();
  }

  private canPlaceTower(col: number, row: number): boolean {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (isPath(col, row)) return false;
    if (!isAdjacentToPath(col, row)) return false;
    if (this.gridTowers[col][row]) return false;
    if (!this.selectedTowerType) return false;
    return this.gold >= TOWER_STATS[this.selectedTowerType][0].cost;
  }

  private handleHover(pointer: Phaser.Input.Pointer) {
    if (this.gameEnded) {
      if (!this.previewHidden) this.previewGfx.clear();
      this.previewHidden = true;
      this.placementPreview.setVisible(false);
      return;
    }
    if (!this.selectedTowerType) {
      // WAŻNE (wydajność): przy każdym ruchu myszy NIE wolno przerenderowywać tekstu.
      // Tekst w Phaserze to nowa tekstura na canvasie — dlatego podpowiedzi są cache'owane
      // i odświeżane najwyżej raz na 120 ms.
      const now = this.time.now;
      const canRefresh = now - this.lastHoverRefreshAt >= 120;
      if (!this.previewHidden) {
        this.previewGfx.clear();
        this.previewHidden = true;
      }
      // Strzałki wejścia: najechanie pokazuje skład i punkty wejścia następnej fali.
      const laneId = laneEntryArrowAt(pointer.x, pointer.y);
      if (laneId) {
        if (this.isOverActiveLaneArrow(pointer)) {
          if (this.hoveredLaneEntry !== laneId && canRefresh) {
            this.hoveredLaneEntry = laneId;
            this.lastHoverRefreshAt = now;
            this.showWavePreviewStatus(laneId);
          }
        } else {
          this.hoveredLaneEntry = null;
        }
        return;
      }
      this.hoveredLaneEntry = null;
      // najechanie na postawioną wieżę: krótki opis w pasku statusu
      if (pointerOnBoard(pointer.x, pointer.y) && canRefresh) {
        const cell = pointerCell(pointer.x, pointer.y);
        const towerThere = this.gridTowers[cell.col]?.[cell.row];
        if (towerThere && !this.infoPanelOpen) {
          const key = towerThere.col + ',' + towerThere.row + ':' + towerThere.level;
          if (key !== this.hoveredTowerKey) {
            this.hoveredTowerKey = key;
            this.lastHoverRefreshAt = now;
            const st = TOWER_STATS[towerThere.type][towerThere.level];
            const line1 = `${towerName(towerThere.type)} · ${t('hoverLevel')} ${towerThere.level + 1}/3`;
            const line2 = `${damageLabel(st)} · ${t('range')} ${st.range}px · ${t('hoverEvery')} ${st.fireRate} ms`;
            const line3 =
              towerThere.level < 2
                ? t('hoverUpgrade', { cost: st.upgradeCost })
                : t('hoverMax');
            this.setStatus(`${line1}\n${line2}\n${line3}`, '#c4b5fd', 1600);
          }
        } else {
          this.hoveredTowerKey = '';
        }
      }
      return;
    }
    this.hoveredTowerKey = '';


    if (!pointerOnBoard(pointer.x, pointer.y)) {
      if (!this.previewHidden) this.previewGfx.clear();
      this.previewHidden = true;
      this.previewCellKey = '';
      this.placementPreview.setVisible(false);
      return;
    }
    // Scalar cell lookup avoids allocating a temporary {col,row} on every pointermove.
    const col = Math.floor(pointer.x / CELL);
    const row = Math.floor((pointer.y - WORLD_Y) / CELL);
    const canPlace = this.canPlaceTower(col, row);
    const selectedType = this.selectedTowerType;
    if (!selectedType) return;
    const cellKey = `${selectedType}:${col}:${row}:${canPlace ? 1 : 0}`;
    // The green/red build preview and range ring only change when the hovered cell/state changes.
    if (cellKey === this.previewCellKey && !this.previewHidden) return;
    this.previewCellKey = cellKey;
    const center = cellCenter(col, row);
    const stats = TOWER_STATS[selectedType][0];
    const color = TOWER_INFO[selectedType].color;


    if (!this.placementPreview.visible) this.placementPreview.setVisible(true);
    this.previewHidden = false;
    this.placementPreview.setPosition(center.x, center.y);
    this.placementPreview.setTint(canPlace ? 0xffffff : 0xff6b6b);


    const cellX = col * CELL + 1;
    const cellY = WORLD_Y + row * CELL + 1;
    this.previewGfx.clear();
    this.previewGfx.fillStyle(canPlace ? 0x4ade80 : 0xef4444, 0.25);
    this.previewGfx.fillRect(cellX, cellY, CELL - 2, CELL - 2);
    this.previewGfx.lineStyle(1.5, canPlace ? 0x4ade80 : 0xef4444, 0.95);
    this.previewGfx.strokeRect(cellX, cellY, CELL - 2, CELL - 2);
    this.previewGfx.fillStyle(color, 0.12);
    this.previewGfx.fillCircle(center.x, center.y, stats.range);
    this.previewGfx.lineStyle(1.5, color, 0.55);
    this.previewGfx.strokeCircle(center.x, center.y, stats.range);
  }

  private handleClick(pointer: Phaser.Input.Pointer) {
    if (this.gameEnded || this.paused) return;
    if (this.uiGuard) {
      this.uiGuard = false;
      return;
    }
    if (!pointerOnBoard(pointer.x, pointer.y)) return;
    const { col, row } = pointerCell(pointer.x, pointer.y);

    const existing = this.gridTowers[col]?.[row];
    if (existing) {
      this.openInfoPanel(existing);
      return;
    }
    if (!this.selectedTowerType) {
      this.closeInfoPanel();
      return;
    }
    if (!this.canPlaceTower(col, row)) {
      this.setStatus(t('cannotBuild'), '#f87171');
      return;
    }

    const type = this.selectedTowerType;
    const stats = TOWER_STATS[type][0];
    const center = cellCenter(col, row);
    this.gold -= stats.cost;

    const sprite = this.add.image(center.x, center.y, 'tower-' + type).setDepth(DEPTH.TOWER).setScale(TOWER_SCALE);
    const tower: Tower = {
      type,
      level: 0,
      col,
      row,
      sprite,
      lastFired: 0,
      invested: stats.cost,
      homeX: center.x,
      homeY: center.y,
      recoilDx: 0,
      recoilDy: 0,
      recoilUntil: 0,
    };
    this.towers.push(tower);
    this.gridTowers[col][row] = tower;
    this.tweens.add({
      targets: sprite,
      scale: { from: TOWER_SCALE * 0.4, to: TOWER_SCALE },
      duration: 200,
      ease: 'Back.easeOut',
    });
    this.spawnParticles(center.x, center.y, TOWER_INFO[type].color, 8);
    this.refreshHud();
    this.refreshTowerButtons();
    this.handleHover(pointer);
  }

  /* ------------------------------- panel informacji o wieży ------------------------------- */
  private clearInfoPanel() {
    for (const item of this.infoPanelItems) item.destroy();
    this.infoPanelItems = [];
    this.infoPanelOpen = false;
  }

  private closeInfoPanel() {
    this.clearInfoPanel();
    this.selectedTower = null;
    this.refreshTowerButtons();
  }

  private openInfoPanel(tower: Tower) {
    this.clearInfoPanel();
    this.selectedTower = tower;
    this.selectedTowerType = null;
    this.placementPreview.setVisible(false);
    this.previewGfx.clear();
    this.refreshTowerButtons();

    const stats = TOWER_STATS[tower.type][tower.level];
    const info = TOWER_INFO[tower.type];
    const center = cellCenter(tower.col, tower.row);
    const items = this.infoPanelItems;
    const add = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
      items.push(obj);
      return obj;
    };

    // Koło zasięgu jest POD półprzezroczystą kartą, więc prześwituje przez jej tło
    // i nie przecina tekstu ani przycisków.
    const g = add(this.add.graphics().setDepth(DEPTH.PANEL));
    g.fillStyle(info.color, 0.16);
    g.fillCircle(center.x, center.y, stats.range);
    g.lineStyle(2.5, info.color, 0.9);
    g.strokeCircle(center.x, center.y, stats.range);

    /* ZWARTY UKŁAD KARTY (240 x 116 px):
         top+18 nagłówek · top+38 statystyki · top+53 efekt · top+69 ikony celów
         bottom-16 przyciski. Krótkie odstępy, bez pustego wiersza i nakładania cen. */
    const cardW = 240;
    const cardH = 116;
    const halfW = cardW / 2;
    const halfH = cardH / 2;

    const placeLeft = center.x > GAME_W / 2;
    const cardX = Phaser.Math.Clamp(
      center.x + (placeLeft ? -halfW - 28 : halfW + 28),
      halfW + 8,
      GAME_W - halfW - 8,
    );
    const placeTop = center.y > (WORLD_Y + PLAY_BOTTOM) / 2;
    const cardY = Phaser.Math.Clamp(
      center.y + (placeTop ? -halfH - 18 : halfH + 18),
      WORLD_Y + halfH + 6,
      PLAY_BOTTOM - halfH - 6,
    );
    const top = cardY - halfH;
    const bottom = cardY + halfH;
    const left = cardX - halfW + 12;
    const right = cardX + halfW - 12;

    const D_BG = DEPTH.PANEL + 1;
    const D_GFX = DEPTH.PANEL + 4;
    const D_TXT = DEPTH.PANEL + 6;

    const cardBg = add(
      this.add
        .rectangle(cardX, cardY, cardW, cardH, 0x07111e, 0.42)
        .setStrokeStyle(1.5, info.color, 0.9)
        .setDepth(D_BG),
    );
    cardBg.setInteractive();
    cardBg.on('pointerdown', () => {
      this.uiGuard = true;
    });

    const label = (size: number, color: string, bold = false) => ({
      fontFamily: FONT,
      fontSize: size + 'px',
      color,
      fontStyle: bold ? 'bold' : 'normal',
      resolution: UI_RESOLUTION,
    });

    // Nagłówek: ikona i dwie linie tekstu mają wspólny środek pionowy (y = top + 20).
    const headCy = top + 18;
    const iconLeft = left;
    add(this.add.image(iconLeft, headCy, 'tower-' + tower.type + (tower.level === 0 ? '' : '-l' + (tower.level + 1))).setScale(0.55).setDepth(D_GFX));
    add(this.add.text(iconLeft + 22, headCy - 8, towerName(tower.type).toUpperCase(), label(12, '#ffffff', true)).setOrigin(0, 0.5).setDepth(D_TXT));
    add(
      this.add
        .text(iconLeft + 22, headCy + 7, t('level') + ' ' + (tower.level + 1) + '/3', label(9.5, '#fbbf24', true))
        .setOrigin(0, 0.5)
        .setDepth(D_TXT),
    );

    const close = add(
      this.add
        .text(right, top + 7, '✕', label(13, '#94a3b8'))
        .setOrigin(1, 0)
        .setDepth(D_TXT)
        .setInteractive({ useHandCursor: true }),
    );
    close.on('pointerdown', () => {
      this.uiGuard = true;
      this.closeInfoPanel();
    });

    // Statystyki i efekt.
    add(
      this.add
        .text(left, top + 38, `${damageLabel(stats)} · ${t('range')} ${stats.range} · ${stats.fireRate} ms`, label(10, '#e2e8f0'))
        .setOrigin(0, 0.5)
        .setDepth(D_TXT),
    );

    let effectText = t('singleTarget');
    let effectColor = '#93c5fd';
    if (stats.slow) {
      effectText = `${t('slow')} ${Math.round(stats.slow * 100)}% · ${stats.slowDuration / 1000} s`;
      effectColor = '#93c5fd';
    } else if (stats.chain) {
      // prąd nie działa na czołgi — podajemy to wprost, bo ikony celów mogą umknąć uwadze
      effectText = `${t('chain')} ${stats.chain} · ${stats.chainDamage.join('/')} DMG · ${t('noTank')}`;
      effectColor = '#c4b5fd';
    } else if (tower.type === 'cannon') {
      // armata nie nadąża za szybkimi — też komunikujemy wprost
      effectText = `${t('singleTarget')} · ${t('noFast')}`;
      effectColor = '#fdba74';
    } else if (tower.type === 'arrow') {
      effectText = `${t('tank')} 25% · ${t('bossMega')} 50%`;
      effectColor = '#fca5a5';
    }
    const effectLine = add(
      this.add.text(left, top + 53, effectText, label(9.5, effectColor)).setOrigin(0, 0.5).setDepth(D_TXT),
    );
    // wiersz efektu mieści się w karcie także po dopisaniu ograniczeń broni
    if (effectLine.width > cardW - 24) effectLine.setFontSize(9);

    // Cele: ikonki w jednym rzędzie. Ograniczone obrażenia (np. strzała vs czołg 25%)
    // są opisane w wierszu efektu — tutaj tylko przygaszamy ikonę, bez nachodzących napisów.
    add(this.add.text(left, top + 69, t('worksOn'), label(9.5, '#94a3b8')).setOrigin(0, 0.5).setDepth(D_TXT));
    const enemyTexSize: Record<string, number> = { basic: 30, fast: 28, tank: 34, boss: 48, megaboss: 64 };
    let ix = left + 64;
    for (const et of ENEMY_ORDER) {
      if (!canAffect(tower.type, et)) continue;
      const factor = damageFactor(tower.type, et);
      add(
        this.add
          .image(ix, top + 69, ENEMY_STYLE[et].texture)
          .setScale(15 / enemyTexSize[et])
          .setAlpha(factor < 1 ? 0.45 : 1)
          .setDepth(D_GFX),
      );
      ix += 23;
    }

    // Przyciski: cena wyłącznie w przycisku, wyśrodkowana, z monetą po tekście.
    const btnCy = bottom - 16;
    const btnH = 22;
    const btnW = 100;
    const gap = 8;
    const upCx = cardX - (btnW + gap) / 2;
    const sellCx = cardX + (btnW + gap) / 2;

    const makeButton = (
      cx: number,
      fill: number,
      stroke: number,
      textColor: string,
      text: string,
      coinAmount: string | null,
      onClick?: () => void,
    ) => {
      const bg = add(
        this.add
          .rectangle(cx, btnCy, btnW, btnH, fill, 0.92)
          .setStrokeStyle(1.5, stroke)
          .setDepth(D_GFX),
      );
      const txt = add(
        this.add.text(0, btnCy, text, label(9.5, textColor, true)).setOrigin(0, 0.5).setDepth(D_TXT),
      );
      const price = coinAmount === null
        ? null
        : add(this.add.text(0, btnCy, coinAmount, label(9, textColor, true)).setOrigin(0, 0.5).setDepth(D_TXT));
      // Etykieta, moneta i cena tworzą jeden, matematycznie wyśrodkowany blok.
      // Cena nie jest częścią tekstu przycisku, więc nie może nachodzić na rząd ikon celów.
      const coinSize = 9;
      const coinGap = price ? 4 : 0;
      const priceGap = price ? 3 : 0;
      let groupWidth = txt.width + (price ? coinGap + coinSize + priceGap + price.width : 0);
      if (groupWidth > btnW - 8 && price) {
        // Dłuższe tłumaczenie skaluje się w obrębie przycisku, nie wchodzi na ikonki celów.
        txt.setFontSize(8.5);
        price.setFontSize(8);
        groupWidth = txt.width + coinGap + coinSize + priceGap + price.width;
      }
      const groupLeft = cx - groupWidth / 2;
      txt.setPosition(groupLeft, btnCy);
      if (price) {
        const coinX = groupLeft + txt.width + coinGap + coinSize / 2;
        add(this.add.image(coinX, btnCy, 'icon-coin').setScale(coinSize / 22).setDepth(D_TXT));
        price.setPosition(coinX + coinSize / 2 + priceGap, btnCy);
      }
      if (onClick) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', onClick);
      }
    };

    if (tower.level < 2) {
      const cost = stats.upgradeCost;
      const canUpgrade = this.gold >= cost;
      makeButton(
        upCx,
        canUpgrade ? 0x1d4ed8 : 0x1e293b,
        canUpgrade ? 0x60a5fa : 0x475569,
        canUpgrade ? '#ffffff' : '#94a3b8',
        t('upgradeBtn'),
        String(cost),
        () => {
          this.uiGuard = true;
          this.upgradeSelected();
        },
      );
    } else {
      makeButton(upCx, 0x1e293b, 0x64748b, '#fbbf24', t('maxLevel'), null);
    }

    makeButton(
      sellCx,
      0x7f1d1d,
      0xf87171,
      '#fee2e2',
      t('sellBtn'),
      '+' + Math.floor(tower.invested * SELL_FACTOR),
      () => {
        this.uiGuard = true;
        this.sellSelected();
      },
    );

    this.infoPanelOpen = true;
  }

  private upgradeSelected() {
    const tower = this.selectedTower;
    if (!tower || tower.level >= 2) return;
    const stats = TOWER_STATS[tower.type][tower.level];
    if (this.gold < stats.upgradeCost) {
      this.setStatus(t('noGoldUpgrade', { cost: stats.upgradeCost }), '#f87171');
      return;
    }
    this.gold -= stats.upgradeCost;
    tower.invested += stats.upgradeCost;
    tower.level++;
    tower.sprite.setTexture('tower-' + tower.type + '-l' + (tower.level + 1));
    this.spawnParticles(tower.sprite.x, tower.sprite.y, 0xfde68a, 10);
    this.tweens.add({
      targets: tower.sprite,
      scale: { from: TOWER_SCALE * 1.25, to: TOWER_SCALE },
      duration: 240,
      ease: 'Back.easeOut',
    });
    this.openInfoPanel(tower);
    this.refreshHud();
    this.refreshTowerButtons();
  }

  private sellSelected() {
    const tower = this.selectedTower;
    if (!tower) return;
    const refund = Math.floor(tower.invested * SELL_FACTOR);
    this.gold += refund;
    this.gridTowers[tower.col][tower.row] = null;
    this.towers.splice(this.towers.indexOf(tower), 1);
    this.spawnParticles(tower.sprite.x, tower.sprite.y, 0xf59e0b, 8);
    tower.sprite.destroy();
    this.setStatus(t('sold', { refund }), '#fbbf24');
    this.closeInfoPanel();
    this.refreshHud();
    this.refreshTowerButtons();
  }

  /* ------------------------------- zapowiedź fali po najechaniu na strzałkę wejścia ------------------------------- */

  /** true, jeśli kursor jest nad strzałką wejścia drogi aktywnej w następnej fali. */
  private isOverActiveLaneArrow(pointer: Phaser.Input.Pointer): boolean {
    if (this.waveActive) return false;
    if (this.waveNumber + 1 > this.waves.length) return false;
    // Wszystkie trzy drogi są aktywne od pierwszej fali — każda strzałka pokazuje zapowiedź.
    return laneEntryArrowAt(pointer.x, pointer.y) !== null;
  }

  /** Pokazuje zapowiedź następnej fali w górnym pasku statusu. */
  private showWavePreviewStatus(laneId?: string) {
    if (this.gameEnded || this.waveActive || this.waveNumber >= this.waves.length) return;
    const nextWave = this.waves[this.waveNumber];
    const waveNum = this.waveNumber + 1;

    const counts: Partial<Record<EnemyType, number>> = {};
    let totalEnemies = 0;
    for (const g of nextWave.groups) {
      counts[g.config.type] = (counts[g.config.type] || 0) + g.count;
      totalEnemies += g.count;
    }
    const detailParts: string[] = [];
    for (const et of ENEMY_ORDER) {
      if (counts[et]) detailParts.push(`${counts[et]}x ${enemyName(et)}`);
    }
    // Podział jest zawsze równy na 3 drogi (reszta trafia na kolejne drogi w rotacji).
    const perLane = [Math.floor(totalEnemies / 3), Math.floor(totalEnemies / 3), Math.floor(totalEnemies / 3)];
    for (let i = 0; i < totalEnemies % 3; i++) perLane[i]++;
    const split = `A: ${perLane[0]} · B: ${perLane[1]} · C: ${perLane[2]}`;
    const laneName = laneId === 'A' ? t('laneA') : laneId === 'B' ? t('laneB') : laneId === 'C' ? t('laneC') : '';
    const laneText = laneName ? `${laneName} → ` : '';

    this.setStatus(
      t('nextWaveHover', {
        n: waveNum,
        count: totalEnemies,
        details: detailParts.join(', '),
        lanes: '3',
        split,
      }).replace('{lane}', laneText),
      '#fde68a',
      4500,
    );
  }

  /* ------------------------------- fale i spawn ------------------------------- */
  private sendWave() {
    if (this.gameEnded || this.paused) return;
    if (this.waveActive) {
      this.setStatus(t('waveRunning'), '#f87171');
      return;
    }
    if (this.waveNumber >= this.waves.length) return;

    const wave = this.waves[this.waveNumber];
    this.waveNumber++;
    this.waveActive = true;

    // Każda grupa ma własny czas startu, a liczebność dzielona jest po równo
    // na trzy drogi (rotacja A -> B -> C); `burst` wypuszcza kilka sztuk naraz.
    this.spawnQueue = [];
    this.spawnCursor = 0;
    let total = 0;
    const start = this.clock + 500;
    let laneCursor = 0;
    // ZAWSZE trzy drogi, od pierwszej fali: każda grupa jest rozdzielana po równo
    // na A -> B -> C (rotacja), więc atak nigdy nie idzie jednym pasem.
    for (const group of wave.groups) {
      const batchStep = Math.max(60, group.interval * group.burst);
      for (let i = 0; i < group.count; i++) {
        const lane = LANES[(laneCursor + i) % 3];
        this.spawnQueue.push({
          config: group.config,
          pathId: lane,
          at: start + group.delay + Math.floor(i / group.burst) * batchStep,
        });
      }
      laneCursor = (laneCursor + group.count) % 3;
      total += group.count;
    }
    this.spawnQueue.sort((a, b) => a.at - b.at);
    this.enemiesAliveInWave = total;

    const bossType = waveHasBoss(wave);
    this.setStatus(
      t('waveStart', { n: this.waveNumber, total: TOTAL_WAVES, count: total }) +
        (bossType === 'megaboss' ? ' · MEGA BOSS' : bossType ? ' · BOSS' : ''),
      bossType === 'megaboss' ? '#fda4af' : bossType ? '#c4b5fd' : '#fbbf24',
    );
    this.refreshHud();
  }

  private spawnQueuedEnemies() {
    if (!this.waveActive) return;
    // Kursor zamiast shift(): bez przesuwania całej tablicy przy każdym wrogu.
    const queue = this.spawnQueue;
    while (this.spawnCursor < queue.length && queue[this.spawnCursor].at <= this.clock) {
      const entry = queue[this.spawnCursor++];
      this.spawnEnemy(entry.config, getPathById(entry.pathId));
    }
  }

  private spawnEnemy(config: EnemyConfig, path: LanePath) {
    const style = ENEMY_STYLE[config.type];
    const spawn = path.points[0];
    const sprite = this.add.image(spawn.x, spawn.y, style.texture).setDepth(DEPTH.ENEMY);
    const barW = config.type === 'megaboss' ? 64 : config.type === 'boss' ? 44 : config.type === 'tank' ? 34 : 30;
    const barOffset = config.type === 'megaboss' ? 46 : config.type === 'boss' ? 30 : 22;
    const barBg = this.add.rectangle(spawn.x, spawn.y - barOffset, barW, 5, 0x0f172a).setDepth(DEPTH.HEALTH);
    const bar = this.add
      .rectangle(spawn.x - barW / 2, spawn.y - barOffset, barW, 5, 0x4ade80)
      .setDepth(DEPTH.HEALTH + 1)
      .setOrigin(0, 0.5);

    const enemy: Enemy = {
      config,
      hp: config.hp,
      maxHp: config.hp,
      sprite,
      bar,
      barBg,
      barW,
      barOffset,
      path,
      pathIndex: 1,
      x: spawn.x,
      y: spawn.y,
      baseSpeed: config.speed * path.speedScale,
      travelled: 0,
      remaining: path.length,
      slowTimer: 0,
      slowFactor: 0,
      alive: true,
      onBoard: onBoard(spawn.x, spawn.y),
      damage: config.damage,
      lastResistFx: 0,
      barPct: 1,
      tinted: false,
      targetScale: 1,
      spawnT: 0,
    };
    sprite.setVisible(enemy.onBoard);
    bar.setVisible(enemy.onBoard);
    barBg.setVisible(enemy.onBoard);

    this.enemies.push(enemy);
    const targetScale = config.type === 'megaboss' ? 1.45 : config.type === 'boss' ? 1.1 : 1;
    // animacja wejścia liczona w updateEnemies — bez tweena i domknięcia na każdego wroga
    enemy.targetScale = targetScale;
    enemy.spawnT = 0;
    sprite.setScale(targetScale * 0.3);
  }

  /* ------------------------------- ruch wrogów ------------------------------- */
  private updateEnemies(dt: number) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.alive) continue;
      if (enemy.spawnT < 240) {
        enemy.spawnT += dt;
        const k = Math.min(1, enemy.spawnT / 240);
        // Back.easeOut: lekkie przestrzelenie, potem powrót do skali docelowej
        const c1 = 1.70158;
        const c3 = c1 + 1;
        const eased = 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
        enemy.sprite.setScale(enemy.targetScale * (0.3 + 0.7 * eased));
      }

      if (enemy.slowTimer > 0) {
        enemy.slowTimer -= dt;
        if (enemy.slowTimer <= 0) {
          enemy.slowTimer = 0;
          enemy.slowFactor = 0;
          enemy.tinted = false;
          enemy.sprite.clearTint();
        }
      }
      const speed = enemy.baseSpeed * (1 - enemy.slowFactor);
      if (enemy.slowFactor > 0 && !enemy.tinted) {
        enemy.tinted = true;
        enemy.sprite.setTint(0x93c5fd);
      }

      const target = enemy.path.points[enemy.pathIndex];
      if (!target) {
        this.enemyReachedBase(enemy);
        continue;
      }
      const dx = target.x - enemy.x;
      const dy = target.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const step = (speed * dt) / 1000;
      if (dist <= Math.max(step, 2)) {
        enemy.x = target.x;
        enemy.y = target.y;
        enemy.travelled += dist;
        enemy.pathIndex++;
        if (enemy.pathIndex >= enemy.path.points.length) {
          this.enemyReachedBase(enemy);
          continue;
        }
      } else {
        enemy.x += (dx / dist) * step;
        enemy.y += (dy / dist) * step;
        enemy.travelled += step;
      }
      enemy.remaining = Math.max(0, enemy.path.length - enemy.travelled);

      const visible = onBoard(enemy.x, enemy.y);
      if (visible !== enemy.onBoard) {
        enemy.onBoard = visible;
        enemy.sprite.setVisible(visible);
        enemy.bar.setVisible(visible);
        enemy.barBg.setVisible(visible);
      }
      if (enemy.x > GAME_W) {
        this.enemyReachedBase(enemy);
        continue;
      }

      enemy.sprite.setPosition(enemy.x, enemy.y);
      if (enemy.config.type === 'fast') enemy.sprite.setRotation(Math.atan2(dy, dx) + Math.PI / 2);
      if (enemy.config.type === 'boss') enemy.sprite.setRotation(enemy.sprite.rotation + 0.006 * this.gameSpeed);
      if (enemy.config.type === 'megaboss') enemy.sprite.setRotation(enemy.sprite.rotation + 0.004 * this.gameSpeed);

      // Paski HP: pozycja co klatkę (ruch), ale rozmiar i kolor tylko gdy HP się zmieniło.
      enemy.barBg.setPosition(enemy.x, enemy.y - enemy.barOffset);
      enemy.bar.setPosition(enemy.x - enemy.barW / 2, enemy.y - enemy.barOffset);
      const pct = Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1);
      if (Math.abs(pct - enemy.barPct) > 0.004) {
        enemy.barPct = pct;
        enemy.bar.setSize(Math.max(1, enemy.barW * pct), 5);
        enemy.bar.setFillStyle(pct > 0.5 ? 0x4ade80 : pct > 0.25 ? 0xfbbf24 : 0xef4444);
      }
    }
  }

  private enemyReachedBase(enemy: Enemy) {
    if (!enemy.alive) return;
    enemy.alive = false;
    this.lives -= enemy.damage;
    this.enemiesAliveInWave--;
    enemy.sprite.destroy();
    enemy.bar.destroy();
    enemy.barBg.destroy();
    const index = this.enemies.indexOf(enemy);
    if (index >= 0) this.enemies.splice(index, 1);
    if (isBossType(enemy.config.type)) {
      this.setStatus(
        t('bossInBase', { boss: enemy.config.type === 'megaboss' ? 'MEGA BOSS' : 'BOSS', dmg: enemy.damage }),
        '#f87171',
      );
    }
    this.cameras.main.shake(140, 0.006);
    this.refreshHud();
    if (this.lives <= 0) this.endGame(false);
    else this.checkWaveComplete();
  }

  /* ------------------------------- wieże i pociski ------------------------------- */
  private updateTowers() {
    const towers = this.towers;
    for (let ti = 0; ti < towers.length; ti++) {
      const tower = towers[ti];
      // Odrzut liczony z czasu gry: wyjście (0..35 ms) i powrót (35..70 ms) — trójkąt.
      // Poza odrzutem sprite stoi dokładnie w punkcie domowym (antydryf).
      const left = tower.recoilUntil - this.clock;
      if (left > 0) {
        const k = left > 35 ? (70 - left) / 35 : left / 35;
        tower.sprite.setPosition(tower.homeX + tower.recoilDx * k, tower.homeY + tower.recoilDy * k);
      } else if (tower.sprite.x !== tower.homeX || tower.sprite.y !== tower.homeY) {
        tower.sprite.setPosition(tower.homeX, tower.homeY);
      }

      const stats = TOWER_STATS[tower.type][tower.level];
      if (this.clock - tower.lastFired < stats.fireRate) continue;

      const bestTarget = this.pickTarget(tower, stats);
      if (bestTarget) {
        // Bez dryfu tempa ognia: termin kolejnego strzału liczony od POPRZEDNIEGO
        // terminu (wielokrotność fireRate), a nie od chwili klatki. Wcześniej przy
        // przyspieszeniu gry każda klatka "zjadała" resztę czasu i wieże realnie
        // strzelały wolniej (przy x4 nawet o ~10%).
        const elapsed = this.clock - tower.lastFired;
        tower.lastFired += Math.floor(elapsed / stats.fireRate) * stats.fireRate;
        this.fireProjectile(tower, bestTarget);
      }
    }
  }

  /** Czy wróg w ogóle może być celem tej wieży (żywy, widoczny, w zasięgu, podatny).
      Odległość porównywana w kwadracie — bez pierwiastka i bez wywołań pomocniczych. */
  private isCandidate(tower: Tower, enemy: Enemy, rangeSq: number): boolean {
    if (!enemy.alive || !enemy.onBoard) return false;
    if (!canAffect(tower.type, enemy.config.type)) return false;
    // mróz nie celuje we wrogów aktualnie spowolnionych; po odzyskaniu
    // pełnej prędkości wróg może dostać spowolnienie ponownie (także od tej samej wieży)
    if (tower.type === 'frost' && enemy.slowTimer > 0) return false;
    const dx = tower.homeX - enemy.x;
    const dy = tower.homeY - enemy.y;
    return dx * dx + dy * dy <= rangeSq;
  }

  /* PRIORYTET CELÓW — reguła w isBetterTarget (data.ts), ta sama dla całej broni:
     najniższe aktualne HP, potem szybszy typ wroga, potem najbliżej bazy.
     Pętla nie alokuje: wróg jest przekazywany bezpośrednio (spełnia TargetCandidate). */
  private pickTarget(tower: Tower, stats: TowerLevelStats): Enemy | null {
    const rangeSq = stats.range * stats.range;
    let best: Enemy | null = null;
    const enemies = this.enemies;
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (!this.isCandidate(tower, enemy, rangeSq)) continue;
      if (!best || isBetterTarget(enemy, best)) best = enemy;
    }
    return best;
  }

  /* ---------------- pula pocisków ----------------
     Sprite'y pocisków nie są tworzone i niszczone przy każdym strzale (to były setki
     obiektów na sekundę i tyle samo pracy dla GC). Zużyty pocisk wraca do puli i jest
     ponownie użyty przy kolejnym strzale; obiekt-stan również jest recyklingowany. */
  private projectilePool: Projectile[] = [];

  private acquireProjectile(textureKey: string): Projectile {
    const pooled = this.projectilePool.pop();
    if (pooled) {
      pooled.sprite.setTexture(textureKey).setVisible(true).setActive(true);
      return pooled;
    }
    const sprite = this.add.image(0, 0, textureKey).setDepth(DEPTH.PROJECTILE);
    return {
      sprite,
      x: 0,
      y: 0,
      targetEnemy: null as unknown as Enemy,
      speed: 0,
      towerType: 'arrow',
      towerLevel: 0,
      damage: 0,
      slow: 0,
      slowDuration: 0,
      chain: 0,
      chainDamage: [],
      alive: false,
    };
  }

  private releaseProjectile(p: Projectile) {
    p.alive = false;
    p.targetEnemy = null as unknown as Enemy;
    p.sprite.setVisible(false).setActive(false).setScale(1).clearTint().setRotation(0);
    this.projectilePool.push(p);
  }

  /** Usuwa pocisk z aktywnej listy przez podmianę z ostatnim (O(1), bez przesuwania tablicy). */
  private removeProjectileAt(i: number) {
    const list = this.projectiles;
    const last = list.length - 1;
    const p = list[i];
    if (i !== last) list[i] = list[last];
    list.length = last;
    this.releaseProjectile(p);
  }

  private fireProjectile(tower: Tower, enemy: Enemy) {
    const stats = TOWER_STATS[tower.type][tower.level];
    const p = this.acquireProjectile('proj-' + tower.type);
    const sprite = p.sprite;
    sprite.setPosition(tower.homeX, tower.homeY);
    const dx = enemy.x - tower.homeX;
    const dy = enemy.y - tower.homeY;
    if (tower.type === 'arrow' || tower.type === 'lightning') sprite.setRotation(Math.atan2(dy, dx));
    if (tower.level === 2) sprite.setScale(1.25).setTint(0xfde68a);

    p.x = tower.homeX;
    p.y = tower.homeY;
    p.targetEnemy = enemy;
    p.speed = PROJECTILE_SPEED[tower.type];
    p.towerType = tower.type;
    p.towerLevel = tower.level;
    p.damage = stats.damage;
    p.slow = stats.slow;
    p.slowDuration = stats.slowDuration;
    p.chain = stats.chain;
    p.chainDamage = stats.chainDamage;
    p.alive = true;
    this.projectiles.push(p);

    // krótki odrzut wieży w stronę strzału — liczony ręcznie w updateTowers,
    // bez tworzenia tweena (i domknięcia) przy każdym strzale
    const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    tower.recoilDx = (dx / len) * 3;
    tower.recoilDy = (dy / len) * 3;
    tower.recoilUntil = this.clock + 70;
  }

  /** Promień, w którym błyskawica może skakać do kolejnych wrogów. */
  private readonly LIGHTNING_CHAIN_RANGE = 110;

  private updateProjectiles(dt: number) {
    // Iteracja od końca + swap-remove: usunięcie nie przesuwa reszty tablicy,
    // a element wstawiony z końca był już przetworzony w tej klatce.
    const list = this.projectiles;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      let target = p.targetEnemy;
      if (!target || !target.alive) {
        const found = this.findNearestEnemy(p.x, p.y, 160, p.towerType, null, null, null);
        if (!found) {
          this.removeProjectileAt(i);
          continue;
        }
        target = found;
        p.targetEnemy = target;
      }
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const step = (p.speed * dt) / 1000;
      if (p.towerType === 'cannon') {
        p.sprite.setRotation(p.sprite.rotation + 0.2 * this.gameSpeed);
      } else if (p.towerType === 'arrow' || p.towerType === 'lightning') {
        p.sprite.setRotation(Math.atan2(dy, dx));
      }
      if (dist < 8 || step >= dist) {
        p.x = target.x;
        p.y = target.y;
        this.impactProjectile(p);
        this.removeProjectileAt(i);
        continue;
      }
      p.x += (dx / dist) * step;
      p.y += (dy / dist) * step;
      p.sprite.setPosition(p.x, p.y);
      p.sprite.setVisible(onBoard(p.x, p.y));
    }
  }

  /** Najbliższy wróg podatny na daną broń. Wykluczenia (do 2, dla łańcucha błyskawicy)
      przekazywane jako osobne argumenty — bez tworzenia Set przy każdym trafieniu. */
  private findNearestEnemy(
    x: number,
    y: number,
    maxDist: number,
    towerType: TowerType,
    ex1: Enemy | null,
    ex2: Enemy | null,
    ex3: Enemy | null,
  ): Enemy | null {
    let best: Enemy | null = null;
    let bestDistSq = maxDist * maxDist;
    const enemies = this.enemies;
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (!enemy.alive || !enemy.onBoard) continue;
      if (enemy === ex1 || enemy === ex2 || enemy === ex3) continue;
      if (!canAffect(towerType, enemy.config.type)) continue;
      if (towerType === 'frost' && enemy.slowTimer > 0) continue;
      const dx = x - enemy.x;
      const dy = y - enemy.y;
      const d = dx * dx + dy * dy;
      if (d < bestDistSq) {
        bestDistSq = d;
        best = enemy;
      }
    }
    return best;
  }

  /* Trafienie zawsze 1 do 1: pocisk rani dokładnie ten cel, w który trafił.
     Sprite pocisku NIE jest tu niszczony — wraca do puli w removeProjectileAt. */
  private impactProjectile(p: Projectile) {
    const target = p.targetEnemy;
    if (!target || !target.alive) return;
    // broń, która nie działa na ten typ wroga, tylko się od niego odbija
    if (!canAffect(p.towerType, target.config.type)) {
      this.sparkFx(p.x, p.y, 0x94a3b8);
      return;
    }

    if (p.towerType === 'cannon') {
      this.explosionFx(p.x, p.y, 22); // efekt wizualny, bez obrażeń obszarowych
      this.damageEnemy(target, p.damage, p.towerLevel, p.towerType);
    } else if (p.towerType === 'frost') {
      this.frostFx(p.x, p.y);
      // pocisk mrozu działa tylko na wroga z pełną prędkością: trafienie
      // w spowolnionego (np. pocisk wystrzelony wcześniej) nie odnawia spowolnienia
      if (target.slowTimer <= 0) this.applySlow(target, p.slow, p.slowDuration);
    } else if (p.towerType === 'lightning') {
      // łańcuch na 3 cele; obrażenia maleją wzdłuż łańcucha (25/10/5 = 40 HP łącznie).
      // Jeśli w zasięgu jest mniej wrogów, pierwszy cel i tak dostaje pełne 25 HP,
      // a kolejne ogniwa dostają mniej.
      const links = p.chainDamage;
      const firstDmg = links.length ? links[0] : p.damage;
      this.drawLightning(p.x, p.y, target.x, target.y);
      this.sparkFx(p.x, p.y, 0xe9d5ff);
      this.damageEnemy(target, firstDmg, p.towerLevel, p.towerType);

      // już trafione ogniwa trzymane w trzech zmiennych (łańcuch ma maks. 3 cele) — bez Set
      let current: Enemy = target;
      let hit1: Enemy | null = target;
      let hit2: Enemy | null = null;
      for (let link = 1; link < p.chain && link < links.length; link++) {
        const next = this.findNearestEnemy(current.x, current.y, this.LIGHTNING_CHAIN_RANGE, p.towerType, hit1, hit2, null);
        if (!next || !next.alive) break;
        this.drawLightning(current.x, current.y, next.x, next.y);
        this.sparkFx(next.x, next.y, 0xe9d5ff);
        this.damageEnemy(next, links[link], p.towerLevel, p.towerType);
        hit2 = next;
        current = next;
      }
    } else {
      this.sparkFx(p.x, p.y, TOWER_INFO[p.towerType].color);
      this.damageEnemy(target, p.damage, p.towerLevel, p.towerType);
    }
  }

  private applySlow(enemy: Enemy, factor: number, durationMs: number) {
    if (!enemy || !enemy.alive || factor <= 0) return;
    if (isBossType(enemy.config.type)) return;
    enemy.slowTimer = durationMs;
    enemy.slowFactor = Math.max(enemy.slowFactor, factor);
  }

  private damageEnemy(enemy: Enemy, amount: number, towerLevel: number, towerType: TowerType) {
    if (!enemy || !enemy.alive) return;
    const factor = damageFactor(towerType, enemy.config.type);
    const dealt = Math.max(1, Math.round(amount * factor));
    enemy.hp -= dealt;
    if (factor < 1) this.showResistFx(enemy);
    if (enemy.hp <= 0) this.killEnemy(enemy, towerLevel);
  }

  private showResistFx(enemy: Enemy) {
    if (!enemy || !enemy.alive) return;
    if (this.time.now < enemy.lastResistFx + 700) return;
    enemy.lastResistFx = this.time.now;
    this.sparkFx(enemy.x, enemy.y - 6, 0x93c5fd);
  }

  /* Punkty za zabójstwo: maksimum za wieżę podstawową, mniej za ulepszone. */
  private scoreForKill(type: EnemyType, towerLevel: number): number {
    const base = ENEMY_POINTS[type] || 10;
    const waveScale = 1 + SCORE_WAVE_STEP * Math.max(0, this.waveNumber - 1);
    const factor = LEVEL_SCORE_FACTOR[Math.max(0, Math.min(2, towerLevel || 0))];
    return Math.round(base * waveScale * factor);
  }

  private killEnemy(enemy: Enemy, towerLevel: number) {
    enemy.alive = false;
    this.kills++;
    const points = this.scoreForKill(enemy.config.type, towerLevel);
    this.score += points;
    this.gold += enemy.config.gold;
    this.goldEarned += enemy.config.gold;
    this.enemiesAliveInWave--;
    const style = ENEMY_STYLE[enemy.config.type];
    const aliveCount = this.enemies.length;
    const baseCount = enemy.config.type === 'megaboss' ? 60 : enemy.config.type === 'boss' ? 26 : 10;
    // Przy 60+ wrogach na planszy cząstki ograniczamy — to czysto wizualne, a skoki były od nich.
    const count = aliveCount > 60 ? Math.min(baseCount, 4) : aliveCount > 30 ? Math.min(baseCount, 6) : baseCount;
    this.spawnParticles(enemy.x, enemy.y, style.color, count);
    if (enemy.config.type === 'boss') {
      this.cameras.main.shake(400, 0.012);
      this.setStatus(t('bossKilled', { gold: enemy.config.gold, points }), '#c4b5fd');
    }
    if (enemy.config.type === 'megaboss') {
      this.cameras.main.shake(900, 0.02);
      this.setStatus(t('megaKilled', { gold: enemy.config.gold, points }), '#fda4af');
    }
    enemy.sprite.destroy();
    enemy.bar.destroy();
    enemy.barBg.destroy();
    const index = this.enemies.indexOf(enemy);
    if (index >= 0) this.enemies.splice(index, 1);
    this.refreshHud();
    this.refreshTowerButtons();
    this.checkWaveComplete();
  }

  private checkWaveComplete() {
    if (this.gameEnded || !this.waveActive) return;
    if (this.spawnCursor < this.spawnQueue.length || this.enemiesAliveInWave > 0) return;
    const wave = this.waves[this.waveNumber - 1];
    this.gold += wave.bonus;
    this.goldEarned += wave.bonus;
    this.waveActive = false;
    this.setStatus(t('waveDone', { n: this.waveNumber, bonus: wave.bonus }), '#4ade80');
    this.refreshHud();
    this.refreshTowerButtons();
    if (this.waveNumber >= this.waves.length) {
      this.gameEnded = true;
      this.time.delayedCall(1600, () => this.endGame(true));
    }
  }

  private endGame(won: boolean) {
    if (this.finished) return;
    this.finished = true;
    this.gameEnded = true;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('VictoryScene', {
        won,
        waves: this.waveNumber,
        kills: this.kills,
        goldEarned: this.goldEarned,
        score: this.score,
        gold: this.gold,
        lives: Math.max(0, this.lives),
      });
    });
  }

  /* ------------------------------- efekty (pula, bez tweenów) -------------------------------
     Każdy efekt (cząsteczka, iskra, pierścień, błyskawica) to obiekt z puli animowany
     ręcznie w updateFx. Wcześniej każdy strzał tworzył nowe obiekty sceny + tweeny
     z domknięciami, a po ułamku sekundy je niszczył — przy kilkuset trafieniach na
     sekundę to był główny producent śmieci dla GC (stąd skoki klatek). */
  private fxPool: Fx[] = [];
  private fxActive: Fx[] = [];
  private lightningPool: Phaser.GameObjects.Graphics[] = [];
  private lightningActive: { g: Phaser.GameObjects.Graphics; t: number; dur: number }[] = [];

  private acquireFx(kind: 'rect' | 'circle'): Fx {
    // szukamy w puli obiektu tego samego rodzaju (rect/circle), żeby nie tworzyć nowych
    for (let i = this.fxPool.length - 1; i >= 0; i--) {
      const fx = this.fxPool[i];
      if (fx.kind === kind) {
        const last = this.fxPool.length - 1;
        if (i !== last) this.fxPool[i] = this.fxPool[last];
        this.fxPool.length = last;
        fx.obj.setVisible(true).setActive(true);
        return fx;
      }
    }
    const obj =
      kind === 'rect'
        ? this.add.rectangle(0, 0, 4, 4, 0xffffff).setDepth(DEPTH.FX)
        : this.add.circle(0, 0, 10, 0xffffff).setDepth(DEPTH.FX);
    return { kind, obj, t: 0, dur: 1, x0: 0, y0: 0, x1: 0, y1: 0, s0: 1, s1: 1, a0: 1, a1: 0, ease: 0 };
  }

  private startFx(fx: Fx, x0: number, y0: number, x1: number, y1: number, s0: number, s1: number, a0: number, a1: number, dur: number, ease: number, depth: number) {
    fx.t = 0;
    fx.dur = dur;
    fx.x0 = x0; fx.y0 = y0; fx.x1 = x1; fx.y1 = y1;
    fx.s0 = s0; fx.s1 = s1; fx.a0 = a0; fx.a1 = a1;
    fx.ease = ease;
    fx.obj.setPosition(x0, y0).setScale(s0).setAlpha(a0).setDepth(depth);
    this.fxActive.push(fx);
  }

  private spawnParticles(x: number, y: number, color: number, count: number) {
    // Twardy sufit aktywnych cząstek: przy dużych falach setki drobnych obiektów
    // były głównym powodem skoków klatek, a wizualnie nic nie wnoszą.
    if (this.fxActive.length >= 140) return;
    const allowed = Math.min(count, 140 - this.fxActive.length);
    for (let i = 0; i < allowed; i++) {
      const fx = this.acquireFx('rect');
      const size = 3 + Math.random() * 3;
      (fx.obj as Phaser.GameObjects.Rectangle).setSize(size, size).setFillStyle(i % 3 === 0 ? 0xffffff : color);
      const angle = Math.random() * Math.PI * 2;
      const distance = 18 + Math.random() * 34;
      this.startFx(fx, x, y, x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, 1, 0.2, 1, 0, 320 + Math.random() * 300, 1, DEPTH.FX);
    }
  }

  private circleFx(x: number, y: number, radius: number, color: number, s0: number, s1: number, a0: number, a1: number, dur: number, depth: number) {
    const fx = this.acquireFx('circle');
    (fx.obj as Phaser.GameObjects.Arc).setRadius(radius).setFillStyle(color);
    this.startFx(fx, x, y, x, y, s0, s1, a0, a1, dur, 0, depth);
  }

  private explosionFx(x: number, y: number, radius: number) {
    this.circleFx(x, y, radius, 0xe67e22, 0.25, 1, 0.5, 0, 320, DEPTH.FX);
    this.circleFx(x, y, radius * 0.45, 0xfde68a, 0.2, 1, 0.9, 0, 260, DEPTH.FX + 1);
  }

  private frostFx(x: number, y: number) {
    this.circleFx(x, y, 26, 0x93c5fd, 0.3, 1.1, 0.6, 0, 380, DEPTH.FX);
  }

  private sparkFx(x: number, y: number, color: number) {
    this.circleFx(x, y, 9, color, 1, 0.1, 1, 0, 180, DEPTH.FX);
  }

  private drawLightning(x1: number, y1: number, x2: number, y2: number) {
    const g = this.lightningPool.pop() ?? this.add.graphics().setDepth(DEPTH.FX + 2);
    g.clear().setVisible(true).setAlpha(1);
    g.lineStyle(3, 0xe9d5ff, 0.95);
    const segments = 6;
    g.beginPath();
    g.moveTo(x1, y1);
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      g.lineTo(x1 + (x2 - x1) * t + (Math.random() * 18 - 9), y1 + (y2 - y1) * t + (Math.random() * 18 - 9));
    }
    g.lineTo(x2, y2);
    g.strokePath();
    this.lightningActive.push({ g, t: 0, dur: 240 });
  }

  /** Animacja wszystkich efektów z puli; czas realny (efekty nie zwalniają przy pauzie tempa). */
  private updateFx(deltaMs: number) {
    const act = this.fxActive;
    for (let i = act.length - 1; i >= 0; i--) {
      const fx = act[i];
      fx.t += deltaMs;
      let k = fx.t / fx.dur;
      if (k >= 1) {
        fx.obj.setVisible(false).setActive(false);
        const last = act.length - 1;
        if (i !== last) act[i] = act[last];
        act.length = last;
        this.fxPool.push(fx);
        continue;
      }
      // ease: 0 = liniowo, 1 = Cubic.easeOut (jak dawne tweeny cząsteczek)
      if (fx.ease === 1) {
        const u = 1 - k;
        k = 1 - u * u * u;
      }
      fx.obj.setPosition(fx.x0 + (fx.x1 - fx.x0) * k, fx.y0 + (fx.y1 - fx.y0) * k);
      fx.obj.setScale(fx.s0 + (fx.s1 - fx.s0) * k);
      fx.obj.setAlpha(fx.a0 + (fx.a1 - fx.a0) * k);
    }
    const la = this.lightningActive;
    for (let i = la.length - 1; i >= 0; i--) {
      const l = la[i];
      l.t += deltaMs;
      if (l.t >= l.dur) {
        l.g.setVisible(false);
        this.lightningPool.push(l.g);
        const last = la.length - 1;
        if (i !== last) la[i] = la[last];
        la.length = last;
        continue;
      }
      l.g.setAlpha(1 - l.t / l.dur);
    }
  }

  /* ------------------------------- pętla główna ------------------------------- */
  update(_time: number, delta: number) {
    this.restorePrompterText();
    if (this.paused || this.gameEnded) {
      // HUD i karty wież muszą się odświeżać także w pauzie (np. sprzedaż/ulepszenie)
      this.flushHud();
      return;
    }
    const dt = Math.min(delta, 50) * this.gameSpeed;
    this.clock += dt;
    this.spawnQueuedEnemies();
    this.updateEnemies(dt);
    this.updateTowers();
    this.updateProjectiles(dt);
    this.updateFx(Math.min(delta, 50));
    this.flushHud();
  }
}
