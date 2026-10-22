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
  START_LIVES,
  TOWER_ORDER,
  TOWER_INFO,
  TOWER_STATS,
  ENEMY_STYLE,
  cardBackground,
  cellCenter,
  isPath,
  cornerTextureKey,
  damageLabel,
  canAffect,
  menuEnemies,
  UI_FONT,
  UI_RESOLUTION,
} from './data';
import {
  buildTextures,
  buildFlagTextures,
  makeCamoTextTexture,
  makeMenuStoneTexture,
  makeStoneSurfaceTexture,
  makeMenuCardShadow,
  makeIconShadowTexture,
  makeBoardStoneTexture,
} from './textures';
import { t, getLang, setLang, towerName, towerEffect, enemyName, type Lang } from './i18n';

const FONT = UI_FONT;
const TITLE_FONT = 'Audiowide, "Trebuchet MS", sans-serif';

/** Both scenes use the tank card's exact stone texture and background color for their bars. */
export function drawStoneBar(scene: Phaser.Scene, centerY: number, height: number, depth: number) {
  const color = cardBackground(ENEMY_STYLE.tank.color);
  const key = makeStoneSurfaceTexture(scene, color, GAME_W, height, 138, 130);
  if (key) {
    return scene.add.image(GAME_W / 2, centerY, key).setDisplaySize(GAME_W, height).setDepth(depth);
  }
  return scene.add.rectangle(GAME_W / 2, centerY, GAME_W, height, color, 1).setDepth(depth);
}

/** Jeden wspólny cień dla kart menu i przycisku startu: miękki, naturalny, wokół całej bryły. */
function addMenuDropShadow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
): Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle {
  const key = makeMenuCardShadow(scene, width, height);
  if (key) return scene.add.image(x, y, key).setDisplaySize(width + 24, height + 24);
  return scene.add.rectangle(x, y + 3, width, height, 0x052e16, 0.85);
}

/* =========================================================================================
   Rysowanie planszy: szachownica trawy i piasku + zaokrąglone kafelki zakrętów.
   `depthBase` pozwala w menu zepchnąć mapę pod interfejs (ujemne głębokości).
   ========================================================================================= */
export function drawMap(scene: Phaser.Scene, alpha: number, depthBase = 0) {
  const board = makeBoardStoneTexture(scene);
  if (board) {
    scene.add.image(GAME_W / 2, WORLD_Y + (ROWS * CELL) / 2, board)
      .setDepth(depthBase + DEPTH.GRID)
      .setAlpha(alpha);
    return;
  }
  // Fallback dla środowisk bez CanvasTexture.
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const onPath = isPath(col, row);
      const c = cellCenter(col, row);
      const cornerKey = cornerTextureKey(col, row);
      if (cornerKey) {
        scene.add
          .image(c.x, c.y, cornerKey)
          .setDepth(depthBase + (onPath ? DEPTH.PATH : DEPTH.GRID))
          .setAlpha(alpha);
        continue;
      }
      const alt = (col + row) % 2 === 0;
      const key = onPath ? (alt ? 'tile-path' : 'tile-path2') : alt ? 'tile-grass' : 'tile-grass2';
      scene.add
        .image(c.x, c.y, key)
        .setDepth(depthBase + (onPath ? DEPTH.PATH : DEPTH.GRID))
        .setAlpha(alpha);
    }
  }
}

/* Strzałki przy wjazdach trzech dróg (A z lewej, B od dołu, C z góry). */
export interface LaneEntryMarker {
  id: string;
  x: number;
  y: number;
  angle: number;
  dx: number;
  dy: number;
  secondX: number;
  secondY: number;
}

const LANE_ARROWS: LaneEntryMarker[] = [
  { id: 'A', x: 12, y: 285, angle: 0, dx: 1, dy: 0, secondX: 27, secondY: 285 },
  { id: 'B', x: 75, y: 646, angle: -Math.PI / 2, dx: 0, dy: -1, secondX: 75, secondY: 631 },
  { id: 'C', x: 125, y: 76, angle: Math.PI / 2, dx: 0, dy: 1, secondX: 125, secondY: 91 },
];

/** Pozycje strzałek wejścia (używane tylko do wyliczeń hover — bez osobnych obiektów UI). */
export function getLaneEntryMarkers(): readonly LaneEntryMarker[] {
  return LANE_ARROWS;
}

/** Zwraca identyfikator drogi, jeśli kursor znajduje się na jednej z jej strzałek wejścia. */
export function laneEntryArrowAt(x: number, y: number): string | null {
  const radiusSq = 18 * 18;
  for (const entry of LANE_ARROWS) {
    const mainDx = x - entry.x;
    const mainDy = y - entry.y;
    if (mainDx * mainDx + mainDy * mainDy <= radiusSq) return entry.id;
    const secondDx = x - entry.secondX;
    const secondDy = y - entry.secondY;
    if (secondDx * secondDx + secondDy * secondDy <= radiusSq) return entry.id;
  }
  return null;
}

export function drawLaneArrows(scene: Phaser.Scene, alpha: number, pulse: boolean, depthBase = 0) {
  for (const entry of LANE_ARROWS) {
    for (let i = 0; i < 2; i++) {
      const img = scene.add
        .image(i === 0 ? entry.x : entry.secondX, i === 0 ? entry.y : entry.secondY, 'lane-arrow')
        .setRotation(entry.angle)
        .setDepth(depthBase + DEPTH.PATH + 1)
        .setAlpha(alpha * (i === 0 ? 0.95 : 0.5))
        .setScale(i === 0 ? 1 : 0.75);
      if (pulse) {
        scene.tweens.add({
          targets: img,
          alpha: { from: alpha * (i === 0 ? 0.5 : 0.25), to: alpha * (i === 0 ? 1 : 0.6) },
          scale: { from: (i === 0 ? 1 : 0.75) * 0.85, to: (i === 0 ? 1 : 0.75) * 1.12 },
          duration: 620 + i * 120,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }
  }
}

/* Czerwone strzałki wyjścia na ostatnim kafelku przed krawędzią ekranu (15,4 -> 16,4).
   Ten sam kształt co białe strzałki wjazdów, tylko czerwone i skierowane ku prawej krawędzi. */
const EXIT_ARROWS = [{ x: 762, y: 285, angle: 0, dx: 1, dy: 0 }];

export function drawExitArrows(scene: Phaser.Scene, alpha: number, pulse: boolean, depthBase = 0) {
  const exit = EXIT_ARROWS[0];
  scene.add
    .text(exit.x + 8, exit.y, 'B', {
      fontFamily: FONT,
      fontSize: '48px',
      fontStyle: 'bold',
      color: '#4ade80',
      resolution: UI_RESOLUTION,
    })
    .setOrigin(0.5)
    // Droga: PATH, litera: PATH + 0.5, strzalki: PATH + 1.
    .setDepth(depthBase + DEPTH.PATH + 0.5)
    .setAlpha(alpha * 0.62);

  for (const entry of EXIT_ARROWS) {
    for (let i = 0; i < 2; i++) {
      const img = scene.add
        .image(entry.x + entry.dx * i * 15, entry.y + entry.dy * i * 15, 'lane-arrow-exit')
        .setRotation(entry.angle)
        .setDepth(depthBase + DEPTH.PATH + 1)
        .setAlpha(alpha * (i === 0 ? 0.95 : 0.5))
        .setScale(i === 0 ? 1 : 0.75);
      if (pulse) {
        scene.tweens.add({
          targets: img,
          alpha: { from: alpha * (i === 0 ? 0.5 : 0.25), to: alpha * (i === 0 ? 1 : 0.6) },
          scale: { from: (i === 0 ? 1 : 0.75) * 0.85, to: (i === 0 ? 1 : 0.75) * 1.12 },
          duration: 620 + i * 120,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }
  }
}

function textStyle(size: number, color: string, bold = false): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: size + 'px',
    color,
    fontStyle: bold ? 'bold' : 'normal',
    resolution: UI_RESOLUTION,
  };
}

/* =========================================================================================
   Boot — buduje tekstury i czeka chwilę na czcionkę tytułu, potem przechodzi do menu.
   ========================================================================================= */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    buildTextures(this);
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      this.scene.start('MenuScene');
    };
    // flagi języków (SVG → canvas) ładują się równolegle z czcionkami
    const flags = buildFlagTextures(this);
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts && typeof fonts.load === 'function') {
      try {
        Promise.allSettled([
          flags,
          fonts.load('46px Audiowide'),
          fonts.load('400 12px Cause'),
          fonts.load('500 14px Cause'),
          fonts.load('700 17px Cause'),
          fonts.load('900 22px Cause'),
        ]).then(start);
      } catch {
        start();
      }
      window.setTimeout(start, 1500);
    } else {
      flags.then(start);
      window.setTimeout(start, 1500);
    }
  }
}

/* =========================================================================================
   Menu główne: plansza w tle, klasyfikacja broni, rodzaje wrogów, przycisk startu.
   ========================================================================================= */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    // gwiazdki dekoracyjne nad mapą
    for (let i = 0; i < 90; i++) {
      this.add
        .circle(
          Phaser.Math.Between(0, GAME_W),
          Phaser.Math.Between(0, GAME_H),
          Phaser.Math.FloatBetween(0.6, 1.6),
          0xffffff,
          Phaser.Math.FloatBetween(0.1, 0.45),
        )
        .setDepth(-30);
    }
    drawMap(this, 0.7, -20);
    drawLaneArrows(this, 0.7, false, -20);
    drawExitArrows(this, 0.7, false, -20);
    // Półprzezroczysta kamienna faktura na planszy: kolor ciemniejszego kafelka drogi
    // (#b8995e, o 5% ciemniejszy), bez koloru źródłowego zdjęcia. Przyciemniamy
    // wyłącznie samą fakturę; bazowy beż i alfa tła pozostają bez zmian.
    const boardWashColor = 0xb8995e;
    const boardWash = makeMenuStoneTexture(this, boardWashColor, GAME_W, 600, 0.42, 0.12);
    if (boardWash) {
      this.add
        .image(GAME_W / 2, WORLD_Y + 300, boardWash)
        .setDisplaySize(GAME_W, 600)
        .setAlpha(0.4)
        .setDepth(-10);
    } else {
      this.add.rectangle(400, WORLD_Y + 300, GAME_W, 600, boardWashColor, 0.4).setDepth(-10);
    }
    drawStoneBar(this, WORLD_Y / 2, WORLD_Y, -5);
    drawStoneBar(this, (PLAY_BOTTOM + GAME_H) / 2, GAME_H - PLAY_BOTTOM, -5);

    /* Układ menu: tytuł, sekcje broni i wrogów oraz przycisk startu pozostają
       w obrębie planszy; informacja o sterowaniu jest wycentrowana w dolnym pasku. */
    // Tytuł wypełniony zimowym kamuflażem (biało-szare moro wojsk górskich), bez obwódki.
    const TITLE_CY = 124;
    const title = this.buildCamoTitle();
    const faceH = (title.getData('faceH') as number | undefined) ?? 86;
    const titleTop = TITLE_CY - faceH / 2;
    const titleBottom = TITLE_CY + faceH / 2;
    const gapTop = titleTop - WORLD_Y;

    /* --- przełącznik języka: flagi PL / EN w lewym górnym rogu, wyśrodkowane na pasku --- */
    this.buildLanguageSwitch();

    /* --- arsenał: 4 karty (bez ceny, proporcje lekko szerszego kwadratu: 152x140) ---
       Nagłówek bez czarnej otoczki; mocny cień identyczny jak pod napisem INWAZJA. */
    const weaponsHeader = this.add
      .text(400, 0, t('weaponsHeader'), textStyle(22, '#cccccc', true))
      .setOrigin(0.5)
      .setShadow(0, 2, '#022c1a', 4, true, true);
    const headerH = weaponsHeader.height;
    const headerY = titleBottom + gapTop + headerH / 2;
    weaponsHeader.setY(headerY);
    const weaponsDy = headerY - 186;
    TOWER_ORDER.forEach((type, index) => {
      const info = TOWER_INFO[type];
      const stats = TOWER_STATS[type][0];
      const x = 400 + (index - 1.5) * 168;
      const cy = 276 + weaponsDy;
      const cardColor = cardBackground(info.color);
      addMenuDropShadow(this, x, cy, 152, 140);
      const cardTexture = makeMenuStoneTexture(this, cardColor, 152, 140);
      if (cardTexture) this.add.image(x, cy, cardTexture).setDisplaySize(152, 140);
      // Ramka zachowuje obecny kolor i jasność tła; środek jest wypełniony fakturą.
      const card = this.add.rectangle(x, cy, 152, 140, 0x000000, 0).setStrokeStyle(1, info.color, 1);
      this.add.image(x, 244 + weaponsDy, 'tower-' + type).setScale(1.15);
      // Większa nazwa (17 px), zakotwiczona dolną krawędzią w dotychczasowym miejscu:
      // rośnie do góry, bez przesuwania ikony, statystyk ani karty.
      this.add.text(x, 290 + weaponsDy, towerName(type).toUpperCase(), textStyle(17, '#f1f5f9', true)).setOrigin(0.5, 1);
      this.add.text(x, 304 + weaponsDy, `${damageLabel(stats)} · ${t('range')} ${stats.range}`, textStyle(11, '#a8b6c8')).setOrigin(0.5);
      // opis mechaniki + ograniczenie broni; auto-dopasowanie, żeby nie wyszedł poza kartę
      const effectLine = this.add.text(x, 324 + weaponsDy, towerEffect(type), textStyle(11, '#8ea0b6')).setOrigin(0.5);
      if (effectLine.width > 138) effectLine.setFontSize(10);
      if (effectLine.width > 138) effectLine.setFontSize(9);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => this.startGame());
    });

    /* --- przeciwnicy: 5 prawie kwadratowych kart ---
       Nagłówek: ten sam mocny cień co pod napisem INWAZJA. */
    // Cały blok (nagłówek + karty) odsunięty w dół względem sekcji broni.
    const enemyDy = 14;
    this.add
      .text(400, 384 + enemyDy, t('enemiesHeader'), textStyle(22, '#cccccc', true))
      .setOrigin(0.5)
      .setShadow(0, 2, '#022c1a', 4, true, true);
    menuEnemies().forEach((enemy, index) => {
      const styleInfo = ENEMY_STYLE[enemy.type];
      const x = 96 + index * 152;
      const cardColor = cardBackground(styleInfo.color);
      addMenuDropShadow(this, x, 469 + enemyDy, 138, 130);
      const cardTexture = makeMenuStoneTexture(this, cardColor, 138, 130);
      if (cardTexture) this.add.image(x, 469 + enemyDy, cardTexture).setDisplaySize(138, 130);
      this.add.rectangle(x, 469 + enemyDy, 138, 130, 0x000000, 0).setStrokeStyle(1, styleInfo.color, 1);
      // Górna krawędź kart jest 20 px pod nagłówkiem — tak samo jak w kartach broni.
      // Cień rozmyty NAOOKOŁO samej ikony wroga (poświata ze wszystkich stron),
      // żeby ikona odcinała się od kamiennego tła karty.
      // Cień tak mocny jak ciemna otasz ikon broni: pełne krycie i ciaśniejszy kontur,
      // żeby ikona wroga odcinała się od kamiennego tła tak samo wyraźnie jak ikony broni.
      makeIconShadowTexture(this, styleInfo.texture, styleInfo.texture + '-glow', 2, 0x000000, 1);
      this.add.image(x, 436 + enemyDy, styleInfo.texture + '-glow').setScale(enemy.scale * 1.08);
      this.add.image(x, 435 + enemyDy, styleInfo.texture).setScale(enemy.scale);
      this.add.text(x, 481 + enemyDy, enemyName(enemy.type), textStyle(17, '#f1f5f9', true)).setOrigin(0.5, 1);
      this.add.text(x, 494 + enemyDy, enemy.hp, textStyle(12, '#a8b6c8')).setOrigin(0.5);
      // ikonki wież, które działają na tego wroga (zamiast opisów odporności)
      const working = TOWER_ORDER.filter((t) => canAffect(t, enemy.type));
      working.forEach((t, i) => {
        const ix = x + (i - (working.length - 1) / 2) * 24;
        this.add.image(ix, 516 + enemyDy, 'tower-' + t).setScale(0.42);
      });
    });

    /* --- start: mniejszy przycisk ROZPOCZNIJ OBRONĘ (bez strzałki) --- */
    const btnY = 608;
    const btnW = 210;
    const btnH = 44;
    // Ten sam kolor i ta sama, delikatniejsza faktura niezależnie od stanu hover.
    const btnTexture = makeMenuStoneTexture(this, 0x16a34a, btnW, btnH, 0.13);
    // Jeden kontener skaluje tło, ramkę i napis razem — bez rozjeżdżania
    // warstw ani konkurujących tweenów z osobnych hitboxów.
    const buttonRoot = this.add.container(400, btnY).setDepth(DEPTH.PANEL);
    // Miękki cień, taki sam jak pod okienkami broni i wrogów (zamiast stałego paska pod spodem).
    const buttonShadow = addMenuDropShadow(this, 0, 0, btnW, btnH);
    const buttonFace = this.add.image(0, 0, btnTexture).setDisplaySize(btnW, btnH);
    const button = this.add.rectangle(0, 0, btnW, btnH, 0x000000, 0).setStrokeStyle(2, 0x86efac, 0.95);
    const buttonText = this.add
      .text(0, 0, t('startButton'), textStyle(16, '#ecfdf5', true))
      .setOrigin(0.5)
      .setShadow(0, 2, '#022c1a', 4, true, true);
    const buttonHit = this.add.zone(0, 0, btnW + 18, btnH + 12).setInteractive({ useHandCursor: true });
    buttonRoot.add([buttonShadow, buttonFace, button, buttonText, buttonHit]);
    let buttonHoverTween: Phaser.Tweens.Tween | null = null;
    const animateButton = (scale: number) => {
      buttonHoverTween?.stop();
      buttonHoverTween = this.tweens.add({
        targets: buttonRoot,
        scaleX: scale,
        scaleY: scale,
        duration: 160,
        ease: 'Sine.easeOut',
      });
    };
    const hoverOn = () => {
      animateButton(1.035);
    };
    const hoverOff = () => {
      animateButton(1);
    };
    buttonHit.on('pointerover', hoverOn);
    buttonHit.on('pointerout', hoverOff);
    buttonHit.on('pointerdown', () => this.startGame());

    /* --- jasna informacja pod przyciskiem startu, wycentrowana na dolnym pasku menu --- */
    this.add
      .text(400, (PLAY_BOTTOM + GAME_H) / 2, t('activeDefenseBanner'), {
        ...textStyle(15, '#ffffff', true),
        align: 'center',
        wordWrap: { width: GAME_W - 24 },
      })
      .setOrigin(0.5)
      .setShadow(0, 1, '#000000', 3, true, true);

    // pełny ekran — ikonka w prawym górnym rogu ekranu tytułowego, wyśrodkowana w pionie na czarnym pasku
    const fsBtn = this.add
      .rectangle(GAME_W - 34, WORLD_Y / 2, 46, 40, 0x1e293b, 0.95)
      .setStrokeStyle(1.5, 0x475569)
      .setInteractive({ useHandCursor: true });
    this.add.text(GAME_W - 34, WORLD_Y / 2, '⤢', textStyle(22, '#e2e8f0')).setOrigin(0.5);
    fsBtn.on('pointerover', () => fsBtn.setFillStyle(0x334155));
    fsBtn.on('pointerout', () => fsBtn.setFillStyle(0x1e293b));
    fsBtn.on('pointerdown', () => {
      try {
        this.scale.toggleFullscreen();
      } catch {
        /* przeglądarka może odmówić bez gestu użytkownika */
      }
    });

    this.input.keyboard?.on('keydown-ENTER', () => this.startGame());
    this.input.keyboard?.on('keydown-SPACE', () => this.startGame());
  }

  /**
   * Tytuł gry wypełniony zimowym kamuflażem (biało-szare moro wojsk górskich).
   * Wzór jest wypalany do tekstury raz, więc w pętli gry nie kosztuje nic.
   * Miękki, chłodny cień pod teksturą dodaje kontrastu nad zieloną planszą.
   * Gdy canvas nie jest dostępny, wracamy do zwykłego napisu z delikatnym cieniem.
   */
  private buildCamoTitle(): Phaser.GameObjects.Container {
    const size = makeCamoTextTexture(this, 'title-camo', t('title'), 72, TITLE_FONT, UI_RESOLUTION);
    if (!size) {
      const fallback = this.add
        .text(400, 124, t('title'), {
          fontFamily: TITLE_FONT,
          fontSize: '72px',
          color: '#e2e8f0',
          fontStyle: 'bold',
          resolution: UI_RESOLUTION,
        })
        .setOrigin(0.5)
        .setShadow(0, 3, '#182720', 8, true, true);
      const container = this.add.container(0, 0, [fallback]).setScale(1.2);
      container.setData('faceH', fallback.displayHeight * 1.2);
      return container;
    }

    const shadow = this.add
      .image(0, 0, 'title-camo-shadow')
      .setOrigin(0.5)
      .setDisplaySize(size.shadowWidth, size.shadowHeight);
    const face = this.add
      .image(0, 0, 'title-camo')
      .setOrigin(0.5)
      .setDisplaySize(size.width, size.height);
    // Powiększenie proporcjonalne w obu osiach, bez zmiany środka logo.
    const container = this.add.container(400, 124, [shadow, face]).setScale(1.2);
    container.setData('faceH', size.height * 1.2);
    return container;
  }

  /**
   * Przełącznik języka: dwie okrągłe flagi (PL, EN) obok siebie w lewym górnym rogu,
   * wyśrodkowane w pionie na czarnym górnym pasku. Aktywny język — flaga kolorowa,
   * nieaktywny — czarno-biała. Kliknięcie zapamiętuje wybór i przeładowuje menu.
   */
  private buildLanguageSwitch() {
    const size = 34;
    const gap = 12;
    const y = WORLD_Y / 2;
    const langs: Lang[] = ['pl', 'en'];
    langs.forEach((lang, i) => {
      const x = 20 + size / 2 + i * (size + gap);
      const active = getLang() === lang;
      const key = 'flag-' + lang + (active ? '' : '-gray');
      if (!this.textures.exists(key)) return; // SVG nie zdążył się wczytać — pomijamy
      const flag = this.add
        .image(x, y, key)
        .setDisplaySize(size, size)
        .setAlpha(active ? 1 : 0.75)
        .setInteractive({ useHandCursor: true });
      flag.on('pointerover', () => flag.setAlpha(1).setDisplaySize(size + 3, size + 3));
      flag.on('pointerout', () => flag.setAlpha(active ? 1 : 0.75).setDisplaySize(size, size));
      flag.on('pointerdown', () => {
        if (getLang() === lang) return;
        setLang(lang);
        this.scene.restart();
      });
    });
  }

  private startGame() {
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene'));
  }
}

/* =========================================================================================
   Ekran końcowy: wynik kampanii, ranga (przy zwycięstwie) i konfetti.
   ========================================================================================= */
export interface EndGameData {
  won: boolean;
  waves: number;
  kills: number;
  goldEarned: number;
  score: number;
  gold: number;
  lives: number;
}

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super('VictoryScene');
  }

  create(data: EndGameData) {
    const won = !!data?.won;
    const lives = Math.max(0, data?.lives || 0);
    const goldLeft = data?.gold || 0;
    const kills = data?.kills || 0;

    // ranga zależy od pozostałych żyć i złota w skarbcu
    const rankPoints = lives * 10 + Math.floor(goldLeft / 100);
    let rating = 'C';
    if (won) {
      if (rankPoints >= 330) rating = 'S';
      else if (rankPoints >= 250) rating = 'A';
      else if (rankPoints >= 160) rating = 'B';
    }
    const ratingColor: Record<string, string> = { S: '#fbbf24', A: '#4ade80', B: '#60a5fa', C: '#f59e0b' };

    this.add.rectangle(400, GAME_H / 2, GAME_W, GAME_H, 0x0b1220);
    for (let i = 0; i < 140; i++) {
      this.add.circle(
        Phaser.Math.Between(0, GAME_W),
        Phaser.Math.Between(0, GAME_H),
        Phaser.Math.FloatBetween(0.6, 2),
        0xffffff,
        Phaser.Math.FloatBetween(0.15, 0.8),
      );
    }

    this.add
      .text(400, 104, won ? t('victory') : t('defeat'), textStyle(52, won ? '#6ee7b7' : '#f87171', true))
      .setOrigin(0.5);
    this.add
      .text(400, 150, won ? t('victoryDesc') : t('defeatDesc'), textStyle(14, '#94a3b8'))
      .setOrigin(0.5);

    const rows: { label: string; value: string; coin?: boolean }[] = [
      { label: t('livesLeft'), value: `${lives} / ${START_LIVES}` },
      { label: t('goldLeft'), value: `${goldLeft}`, coin: true },
      { label: t('kills'), value: `${kills}` },
    ];
    rows.forEach((row, index) => {
      const y = 196 + index * 38;
      this.add.rectangle(400, y, 480, 36, 0x111c2e).setStrokeStyle(1, 0x334155);
      this.add.text(180, y, row.label, textStyle(15, '#cbd5e1')).setOrigin(0, 0.5);
      const valueText = this.add.text(620, y, row.value, textStyle(16, '#f8fafc', true)).setOrigin(1, 0.5);
      if (row.coin) {
        this.add.image(620 - valueText.width - 13, y, 'icon-coin').setScale(0.85);
      }
    });

    // dodatkowy wiersz: zdobyte punkty
    const scoreY = 196 + rows.length * 38;
    this.add.rectangle(400, scoreY, 480, 36, 0x111c2e).setStrokeStyle(1, 0x334155);
    this.add.text(180, scoreY, t('score'), textStyle(15, '#cbd5e1')).setOrigin(0, 0.5);
    this.add.text(620, scoreY, `${data?.score || 0}`, textStyle(16, '#fbbf24', true)).setOrigin(1, 0.5);

    if (won) {
      this.add
        .text(400, scoreY + 48, t('rank', { pts: rankPoints }), textStyle(14, '#64748b'))
        .setOrigin(0.5);
      const ratingText = this.add
        .text(400, scoreY + 96, rating, textStyle(48, ratingColor[rating], true))
        .setOrigin(0.5)
        .setScale(0.4);
      this.tweens.add({ targets: ratingText, scale: 1, duration: 420, ease: 'Back.easeOut' });
      this.spawnConfetti();
    } else {
      this.add
        .text(400, scoreY + 62, t('hint'), textStyle(13, '#94a3b8'))
        .setOrigin(0.5);
    }

    const again = this.add.rectangle(290, 560, 250, 52, 0x16a34a).setStrokeStyle(2, 0x4ade80).setInteractive({ useHandCursor: true });
    this.add.text(290, 560, t('playAgain'), textStyle(17, '#ecfdf5', true)).setOrigin(0.5);
    again.on('pointerover', () => again.setFillStyle(0x22c55e));
    again.on('pointerout', () => again.setFillStyle(0x16a34a));
    again.on('pointerdown', () => this.scene.start('GameScene'));

    const menu = this.add.rectangle(560, 560, 200, 52, 0x1e293b).setStrokeStyle(2, 0x475569).setInteractive({ useHandCursor: true });
    this.add.text(560, 560, t('mainMenu'), textStyle(17, '#e2e8f0', true)).setOrigin(0.5);
    menu.on('pointerover', () => menu.setFillStyle(0x334155));
    menu.on('pointerout', () => menu.setFillStyle(0x1e293b));
    menu.on('pointerdown', () => this.scene.start('MenuScene'));

    this.input.keyboard?.on('keydown-ENTER', () => this.scene.start('GameScene'));
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('MenuScene'));
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private spawnConfetti() {
    const colors = [0xfbbf24, 0x4ade80, 0x60a5fa, 0xa855f7, 0xf87171];
    for (let i = 0; i < 70; i++) {
      const x = Phaser.Math.Between(0, GAME_W);
      const rect = this.add.rectangle(
        x,
        -20,
        Phaser.Math.Between(4, 9),
        Phaser.Math.Between(6, 14),
        colors[Phaser.Math.Between(0, colors.length - 1)],
      );
      this.tweens.add({
        targets: rect,
        y: GAME_H + 20,
        x: x + Phaser.Math.Between(-70, 70),
        angle: Phaser.Math.Between(-360, 360),
        duration: Phaser.Math.Between(2200, 4200),
        delay: Phaser.Math.Between(0, 900),
        onComplete: () => rect.destroy(),
      });
    }
  }
}
