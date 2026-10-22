import Phaser from 'phaser';
import {
  CELL,
  COLS,
  ROWS,
  GAME_W,
  TOWER_INFO,
  TOWER_ORDER,
  cornerRadius,
  cornerTextureKey,
  isPath,
} from './data';

/* =========================================================================================
   Tekstury rysowane proceduralnie na starcie gry (kafelki terenu, wieże 4x3, pociski,
   wrogowie, ikony HUD). Dzięki temu gra nie potrzebuje żadnych plików graficznych.
   ========================================================================================= */

/* Cieplejsza zieleń trawy i zakrętów o zbliżonej jasności obu tonów.
   Krawędzie (kratownica) rozjaśnione do koloru zbliżonego do bazy — kratka
   ma być ledwie widoczna, nie rzucać się w oczy. */
const GRASS_TONES = [
  { base: 0x4a7f2c, edge: 0x46792a },
  { base: 0x47792a, edge: 0x437428 },
];
const SAND_TONES = [
  { base: 0xc9a86a, edge: 0xc4a465 },
  // Ciemniejszy kafelek drogi lekko rozjaśniony; jaśniejszy pozostaje bez zmian.
  { base: 0xc7a669, edge: 0xc0a061 },
];

type CornerDir = 'ne' | 'nw' | 'se' | 'sw';

/* Wspólna wysokość wszystkich glifów broni (wystających z korpusu wieży):
   od 1 px do 21 px — dzięki temu ikony wszystkich wież wyglądają tak samo. */
const GLYPH_TOP = 1;
const GLYPH_BOTTOM = 21;

/** Ścieżka „wszystko oprócz klina w narożniku” — wspólna geometria kafelków zakrętów. */
function cornerCutPath(g: Phaser.GameObjects.Graphics, corner: CornerDir) {
  const S = CELL;
  const R = cornerRadius();
  g.beginPath();
  if (corner === 'sw') {
    g.moveTo(0, 0);
    g.lineTo(S, 0);
    g.lineTo(S, S);
    g.lineTo(R, S);
    g.arc(R, S - R, R, Math.PI / 2, Math.PI, false);
  } else if (corner === 'se') {
    g.moveTo(0, 0);
    g.lineTo(S, 0);
    g.lineTo(S, S - R);
    g.arc(S - R, S - R, R, 0, Math.PI / 2, false);
    g.lineTo(0, S);
  } else if (corner === 'nw') {
    g.moveTo(0, S);
    g.lineTo(S, S);
    g.lineTo(S, 0);
    g.lineTo(R, 0);
    g.arc(R, R, R, -Math.PI / 2, -Math.PI, true);
  } else {
    g.moveTo(0, 0);
    g.lineTo(S - R, 0);
    g.arc(S - R, R, R, -Math.PI / 2, 0, false);
    g.lineTo(S, S);
    g.lineTo(0, S);
  }
  g.closePath();
}

function buildTiles(g: Phaser.GameObjects.Graphics) {
  const tones = [
    { list: GRASS_TONES, key: 'tile-grass' },
    { list: SAND_TONES, key: 'tile-path' },
  ];
  for (const { list, key } of tones) {
    list.forEach((tone, i) => {
      g.clear();
      g.fillStyle(tone.base, 1);
      g.fillRect(0, 0, CELL, CELL);
      g.lineStyle(1, tone.edge, 1);
      g.strokeRect(0.5, 0.5, CELL - 1, CELL - 1);
      // Ziarno powstaje raz na całej planszy, a nie w tych samych miejscach kafelka.
      g.generateTexture(i === 0 ? key : key + '2', CELL, CELL);
    });
  }

  /* Kafelki zakrętów: droga z trawą w kącie i trawa z kawałkiem drogi — 4 kierunki x 2 tony. */
  const dirs: CornerDir[] = ['ne', 'nw', 'se', 'sw'];
  for (let tone = 0; tone < 2; tone++) {
    const suffix = tone === 0 ? '' : '-b';
    const grass = GRASS_TONES[tone];
    const sand = SAND_TONES[tone];
    for (const dir of dirs) {
      // kafelek drogi: tło trawy, jezdnia z zaokrąglonym narożnikiem
      g.clear();
      g.fillStyle(grass.base, 1);
      g.fillRect(0, 0, CELL, CELL);
      cornerCutPath(g, dir);
      g.fillStyle(sand.base, 1);
      g.fillPath();
      cornerCutPath(g, dir);
      g.lineStyle(1, sand.edge, 1);
      g.strokePath();
      g.generateTexture('tile-corner-' + dir + suffix, CELL, CELL);

      // kafelek trawy: tło jezdni, klin trawy w narożniku
      g.clear();
      g.fillStyle(sand.base, 1);
      g.fillRect(0, 0, CELL, CELL);
      cornerCutPath(g, dir);
      g.fillStyle(grass.base, 1);
      g.fillPath();
      cornerCutPath(g, dir);
      g.lineStyle(1, grass.edge, 1);
      g.strokePath();
      g.generateTexture('tile-inner-' + dir + suffix, CELL, CELL);
    }
  }
}

function buildTowers(g: Phaser.GameObjects.Graphics) {
  for (const type of TOWER_ORDER) {
    const color = TOWER_INFO[type].color;
    for (let level = 0; level < 3; level++) {
      g.clear();
      if (level === 2) {
        g.fillStyle(color, 0.18);
        g.fillCircle(22, 22, 21);
      }
      // podstawa i korpus w kolorze typu
      g.fillStyle(0x111827, 1);
      g.fillRoundedRect(6, 6, 32, 32, 9);
      const grow = level === 2 ? 1 : 0;
      g.fillStyle(color, 1);
      g.fillRoundedRect(9 - grow, 9 - grow, 26 + grow * 2, 26 + grow * 2, 8);
      g.fillStyle(0x000000, level * 0.12);
      g.fillRoundedRect(6, 6, 32, 32, 9);

      // Biały glif broni wystający z korpusu. WSZYSTKIE glify mają tę samą
      // wysokość (GLYPH_TOP = 1 px do GLYPH_BOTTOM = 21 px) i są wyśrodkowane
      // w osi wieży (x = 22), żeby ikony wyglądały spójnie.
      g.fillStyle(0xf1f5f9, 1);
      if (type === 'arrow') {
        g.fillTriangle(22, GLYPH_TOP, 17, 8, 27, 8);
        g.fillRect(20, 5, 4, GLYPH_BOTTOM - 5);
      } else if (type === 'cannon') {
        g.fillRoundedRect(16, GLYPH_TOP, 12, GLYPH_BOTTOM - GLYPH_TOP, 5);
      } else if (type === 'frost') {
        g.fillTriangle(22, GLYPH_TOP, 15, GLYPH_BOTTOM, 29, GLYPH_BOTTOM);
      } else {
        // piorun ze szpicami na obu końcach, dopasowany do wysokości reszty glifów
        g.fillPoints(
          [
            { x: 23.4, y: GLYPH_TOP },
            { x: 16.4, y: 11 },
            { x: 20.6, y: 11 },
            { x: 17.8, y: GLYPH_BOTTOM },
            { x: 27.6, y: 9 },
            { x: 22.7, y: 9 },
          ],
          true,
        );
      }

      // środek: oko celownicze, wyższe poziomy dostają złoty rdzeń i obręcz
      g.fillStyle(0xf8fafc, 1);
      g.fillCircle(22, 22, 9);
      g.fillStyle(color, 1);
      g.fillCircle(22, 22, 5.5);
      if (level >= 1) {
        g.fillStyle(0xfbbf24, 1);
        g.fillCircle(22, 22, 3);
      }
      if (level === 2) {
        g.lineStyle(2.5, 0xfde68a, 0.9);
        g.strokeCircle(22, 22, 21);
      }
      for (let p = 0; p <= level; p++) {
        g.fillStyle(0xfde68a, 0.95);
        g.fillRect(18 + p * 5, 37, 3, 3);
      }
      g.generateTexture('tower-' + type + (level === 0 ? '' : '-l' + (level + 1)), 44, 44);
    }
  }
}

function buildProjectiles(g: Phaser.GameObjects.Graphics) {
  g.clear();
  g.fillStyle(0xbbf7d0, 1);
  g.fillTriangle(18, 7, 2, 2, 2, 12);
  g.fillRect(8, 5, 8, 4);
  g.generateTexture('proj-arrow', 18, 14);

  g.clear();
  g.fillStyle(0x7c2d12, 1);
  g.fillCircle(8, 8, 7);
  g.fillStyle(0xf59e0b, 1);
  g.fillCircle(6, 6, 3);
  g.generateTexture('proj-cannon', 16, 16);

  g.clear();
  g.fillStyle(0xbfdbfe, 1);
  g.fillTriangle(8, 0, 16, 8, 8, 16);
  g.fillTriangle(8, 0, 0, 8, 8, 16);
  g.generateTexture('proj-frost', 16, 16);

  g.clear();
  g.fillStyle(0xe9d5ff, 1);
  // ten sam kształt ze szpicami co na wieży, wyśrodkowany w teksturze 16x18 (środek x = 8)
  g.fillPoints(
    [
      { x: 9.55, y: 0 },
      { x: 4.65, y: 8 },
      { x: 8.15, y: 8 },
      { x: 5.35, y: 18 },
      { x: 12.35, y: 7 },
      { x: 8.85, y: 7 },
    ],
    true,
  );
  g.generateTexture('proj-lightning', 16, 18);
}

function buildEnemies(g: Phaser.GameObjects.Graphics) {
  // podstawowy — czerwone koło
  g.clear();
  g.fillStyle(0x7f1d1d, 1);
  g.fillCircle(15, 15, 14);
  g.fillStyle(0xef4444, 1);
  g.fillCircle(15, 15, 11);
  g.fillStyle(0xfecaca, 0.85);
  g.fillCircle(11, 11, 3.5);
  g.generateTexture('enemy-basic', 30, 30);

  // szybki — pomarańczowy romb
  g.clear();
  g.fillStyle(0xb45309, 1);
  g.fillPoints([{ x: 14, y: 0 }, { x: 28, y: 14 }, { x: 14, y: 28 }, { x: 0, y: 14 }], true);
  g.fillStyle(0xf59e0b, 1);
  g.fillPoints([{ x: 14, y: 4 }, { x: 24, y: 14 }, { x: 14, y: 24 }, { x: 4, y: 14 }], true);
  g.fillStyle(0xfff7ed, 0.9);
  g.fillCircle(11, 11, 2.5);
  g.generateTexture('enemy-fast', 28, 28);

  // czołg — stalowy sześciokąt
  g.clear();
  g.fillStyle(0x1e293b, 1);
  g.fillPoints(
    [{ x: 17, y: 0 }, { x: 34, y: 9 }, { x: 34, y: 25 }, { x: 17, y: 34 }, { x: 0, y: 25 }, { x: 0, y: 9 }],
    true,
  );
  g.fillStyle(0x94a3b8, 1);
  g.fillPoints(
    [{ x: 17, y: 4 }, { x: 30, y: 11 }, { x: 30, y: 23 }, { x: 17, y: 30 }, { x: 4, y: 23 }, { x: 4, y: 11 }],
    true,
  );
  g.fillStyle(0x475569, 1);
  g.fillCircle(17, 17, 6);
  g.generateTexture('enemy-tank', 34, 34);

  // boss — fioletowy pięciokąt (bez zewnętrznego kółka)
  g.clear();
  g.fillStyle(0x7c3aed, 1);
  g.fillPoints([{ x: 24, y: 2 }, { x: 45, y: 17 }, { x: 37, y: 43 }, { x: 11, y: 43 }, { x: 3, y: 17 }], true);
  g.fillStyle(0xe9d5ff, 1);
  g.fillCircle(24, 22, 7);
  g.fillStyle(0xa855f7, 1);
  g.fillCircle(24, 22, 4);
  g.generateTexture('enemy-boss', 48, 48);

  // mega boss — większy, karmazynowy, z pancerzem (pięciokąt bez zewnętrznego kółka)
  g.clear();
  g.fillStyle(0xe11d48, 1);
  g.fillPoints(
    [{ x: 32, y: 0 }, { x: 59, y: 20 }, { x: 49, y: 60 }, { x: 15, y: 60 }, { x: 5, y: 20 }],
    true,
  );
  g.lineStyle(3, 0xfecdd3, 0.9);
  g.strokePoints(
    [{ x: 32, y: 4 }, { x: 55, y: 22 }, { x: 46, y: 56 }, { x: 18, y: 56 }, { x: 9, y: 22 }],
    true,
    true,
  );
  g.fillStyle(0x475569, 1);
  g.fillCircle(32, 30, 11);
  g.fillStyle(0xfda4af, 1);
  g.fillCircle(32, 30, 7);
  g.fillStyle(0x7f1d1d, 1);
  g.fillCircle(32, 30, 4);
  g.generateTexture('enemy-megaboss', 64, 64);
}

function buildIcons(g: Phaser.GameObjects.Graphics) {
  g.clear();
  g.fillStyle(0xb45309, 1);
  g.fillCircle(11, 11, 11);
  g.fillStyle(0xfbbf24, 1);
  g.fillCircle(11, 11, 9);
  g.fillStyle(0xfde68a, 1);
  g.fillCircle(11, 11, 5);
  g.generateTexture('icon-coin', 22, 22);

  g.clear();
  g.fillStyle(0xef4444, 1);
  g.fillCircle(7, 7, 7);
  g.fillCircle(17, 7, 7);
  g.fillTriangle(0, 8, 24, 8, 12, 22);
  g.fillStyle(0xfca5a5, 0.8);
  g.fillCircle(6, 6, 2.5);
  g.generateTexture('icon-heart', 24, 22);

  g.clear();
  g.lineStyle(3, 0x60a5fa, 1);
  g.beginPath();
  g.moveTo(2, 14);
  g.lineTo(7, 14);
  g.lineTo(10, 6);
  g.lineTo(14, 19);
  g.lineTo(17, 12);
  g.lineTo(22, 12);
  g.strokePath();
  g.generateTexture('icon-wave', 24, 24);

  // chevron strzałki kierunku drogi
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(2, 1, 14, 9, 2, 17);
  g.fillTriangle(2, 1, 8, 9, 2, 17);
  g.generateTexture('lane-arrow', 16, 18);

  // czerwony chevron wyjścia (ostatni kafelek przed krawędzią ekranu)
  g.clear();
  g.fillStyle(0xef4444, 1);
  g.fillTriangle(2, 1, 14, 9, 2, 17);
  g.fillTriangle(2, 1, 8, 9, 2, 17);
  g.generateTexture('lane-arrow-exit', 16, 18);
}

/* -----------------------------------------------------------------------------------------
   Flagi języków (PL / EN) z plików SVG użytkownika. Każda flaga jest renderowana do dwóch
   tekstur: kolorowej (aktywny język) i czarno-białej (nieaktywny). Rozmiar 40x40 px
   w rozdzielczości ekranu, żeby okrągłe flagi były ostre.
   ----------------------------------------------------------------------------------------- */
const FLAG_SIZE = 40;

const FLAG_SVG: Record<'pl' | 'en', string> = {
  pl: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><mask id="pl-c"><circle cx="256" cy="256" r="256" fill="#fff"/></mask><g mask="url(#pl-c)"><path fill="#eee" d="M0 0h512v256H0z"/><path fill="#d80027" d="M0 256h512v256H0z"/></g></svg>`,
  en: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><mask id="gb-c"><circle cx="256" cy="256" r="256" fill="#fff"/></mask><g mask="url(#gb-c)"><path fill="#eee" d="m0 0 8 22-8 23v23l32 54-32 54v32l32 48-32 48v32l32 54-32 54v68l22-8 23 8h23l54-32 54 32h32l48-32 48 32h32l54-32 54 32h68l-8-22 8-23v-23l-32-54 32-54v-32l-32-48 32-48v-32l-32-54 32-54V0l-22 8-23-8h-23l-54 32-54-32h-32l-48 32-48-32h-32l-54 32L68 0H0z"/><path fill="#0052b4" d="M336 0v108L444 0Zm176 68L404 176h108zM0 176h108L0 68ZM68 0l108 108V0Zm108 512V404L68 512ZM0 444l108-108H0Zm512-108H404l108 108Zm-68 176L336 404v108z"/><path fill="#d80027" d="M0 0v45l131 131h45L0 0zm208 0v208H0v96h208v208h96V304h208v-96H304V0h-96zm259 0L336 131v45L512 0h-45zM176 336 0 512h45l131-131v-45zm160 0 176 176v-45L381 336h-45z"/></g></svg>`,
};

/**
 * Renderuje SVG flagi do tekstur `flag-pl`, `flag-pl-gray`, `flag-en`, `flag-en-gray`.
 * Zwraca Promise — po jej spełnieniu tekstury są gotowe w menedżerze tekstur sceny.
 */
export function buildFlagTextures(scene: Phaser.Scene): Promise<void> {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const px = Math.round(FLAG_SIZE * dpr);
  const jobs = (Object.keys(FLAG_SVG) as ('pl' | 'en')[]).map(
    (lang) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          for (const gray of [false, true]) {
            const key = 'flag-' + lang + (gray ? '-gray' : '');
            if (scene.textures.exists(key)) continue;
            const canvas = document.createElement('canvas');
            canvas.width = px;
            canvas.height = px;
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;
            if (gray) ctx.filter = 'grayscale(1) brightness(0.8)';
            ctx.drawImage(img, 0, 0, px, px);
            scene.textures.addCanvas(key, canvas);
          }
          resolve();
        };
        img.onerror = () => resolve();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(FLAG_SVG[lang]);
      }),
  );
  return Promise.all(jobs).then(() => undefined);
}

/** Buduje wszystkie tekstury gry w scenie startowej. */
export function buildTextures(scene: Phaser.Scene) {
  const g = scene.add.graphics({ x: 0, y: 0 });
  buildTiles(g);
  buildTowers(g);
  buildProjectiles(g);
  buildEnemies(g);
  buildIcons(g);
  g.destroy();
}

/* =========================================================================================
   TYTUŁ W ZIMOWYM KAMUFLAŻU (wojska górskie).
   Litery są wypełnione biało-szarym wzorem moro: rysujemy plamy na canvasie, a potem
   przycinamy je do kształtu napisu (`destination-in`). Powstaje zwykła tekstura, więc
   w pętli gry nie ma żadnego dodatkowego kosztu ani pracy dla GC.
   ========================================================================================= */

/** Deterministyczny generator — wzór moro jest zawsze ten sam przy każdym uruchomieniu. */
function camoRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Rozlana ciecz: „grzbiecik" zbudowany z nakładających się kropli o losowych promieniach
 * i przesunięciach. Krawędzie są faliste i nierówne, jak płyn rozlany na powierzchni,
 * a nie regularny wielokąt.
 */
function camoBlob(
  ctx: CanvasRenderingContext2D,
  rnd: () => number,
  cx: number,
  cy: number,
  radius: number,
) {
  // krople główne + od 2 do 4 satelitów „rozlanych" w losowych kierunkach
  const drops = 3 + Math.floor(rnd() * 3);
  for (let d = 0; d < drops; d++) {
    const angle = d === 0 ? 0 : rnd() * Math.PI * 2;
    // pierwsza kropla siedzi w środku, kolejne są coraz mniejsze i dalej
    const drift = d === 0 ? 0 : radius * (0.45 + rnd() * 0.85);
    const cx2 = cx + Math.cos(angle) * drift;
    const cy2 = cy + Math.sin(angle) * drift * 0.62;
    const r2 = d === 0 ? radius * (0.85 + rnd() * 0.4) : radius * (0.3 + rnd() * 0.5);

    // obwód z falowaniem o dwóch częstotliwościach (duża fala + drobne nerwowości)
    const points = 22;
    const phase = rnd() * Math.PI * 2;
    const wob = 0.24 + rnd() * 0.2;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const t = (i / points) * Math.PI * 2;
      const wave =
        1 +
        wob * 0.5 * Math.sin(t * 3 + phase) +
        wob * 0.28 * Math.sin(t * 5 - phase * 1.7) +
        wob * 0.16 * Math.sin(t * 8 + phase * 2.3);
      // rozciągnięcie poziome: ciecz rozlewa się szerzej niż w pionie
      const rx = r2 * wave * 1.3;
      const ry = r2 * wave * 0.78;
      const px = cx2 + Math.cos(t) * rx;
      const py = cy2 + Math.sin(t) * ry;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
}

/* Zimowa paleta moro — kolor podstawowy #ddd (jasny szary), biel tylko jako akcent.
   Paleta od najjaśniejszego do najciemniejszego: biel jest osobno, bo jest akcentem. */
const CAMO_BASE = '#dddddd';
const CAMO_TONES = ['#d4d8de', '#c6ccd4', '#b0b8c2', '#98a1ad'];
const CAMO_ACCENT = '#f4f6f8'; // biel — ma być w wyraźnej mniejszości
const CAMO_DARK = '#5a6473'; // ciemne lodowe plamy — współrządne z bazą #ddd

interface PatternGrid {
  width: number;
  height: number;
  values: Float32Array;
}

function makePatternGrid(width: number, height: number, rnd: () => number): PatternGrid {
  const values = new Float32Array(width * height);
  for (let i = 0; i < values.length; i++) values[i] = rnd() * 2 - 1;
  return { width, height, values };
}

function samplePatternGrid(grid: PatternGrid, x: number, y: number, width: number, height: number): number {
  const gx = (x / width) * grid.width;
  const gy = (y / height) * grid.height;
  const x0 = Math.floor(gx) % grid.width;
  const y0 = Math.floor(gy) % grid.height;
  const x1 = (x0 + 1) % grid.width;
  const y1 = (y0 + 1) % grid.height;
  const tx0 = gx - Math.floor(gx);
  const ty0 = gy - Math.floor(gy);
  const tx = tx0 * tx0 * (3 - 2 * tx0);
  const ty = ty0 * ty0 * (3 - 2 * ty0);
  const a = grid.values[y0 * grid.width + x0];
  const b = grid.values[y0 * grid.width + x1];
  const c = grid.values[y1 * grid.width + x0];
  const d = grid.values[y1 * grid.width + x1];
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

/**
 * Jedna tekstura całej planszy: zachowuje geometrię i dwie tonacje trawy/piasku,
 * ale kamienne ziarno liczy z GLOBALNYCH współrzędnych 800×600. Nie powtarza się
 * co 25 px ani co szerokość kart/pasków. Powstaje raz i jest współdzielona przez sceny.
 */
export function makeBoardStoneTexture(scene: Phaser.Scene): string {
  const key = 'board-stone-unique-v1';
  if (scene.textures.exists(key)) return key;
  const height = ROWS * CELL;
  const texture = scene.textures.createCanvas(key, GAME_W, height);
  if (!texture) return '';
  const ctx = texture.getContext();

  // Najpierw składamy mapę z dotychczasowych kafelków, włącznie z zaokrągleniami dróg.
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const corner = cornerTextureKey(col, row);
      const alt = (col + row) % 2 === 0;
      const tileKey = corner ?? (isPath(col, row)
        ? (alt ? 'tile-path' : 'tile-path2')
        : (alt ? 'tile-grass' : 'tile-grass2'));
      ctx.drawImage(scene.textures.get(tileKey).getSourceImage() as CanvasImageSource, col * CELL, row * CELL);
    }
  }

  const image = ctx.getImageData(0, 0, GAME_W, height);
  const pixels = image.data;
  const rnd = camoRandom(0x6f726f6a);
  // Wszystkie oktawy rozpięte na CAŁEJ planszy; nie są kafelkowane między polami.
  const coarse = makePatternGrid(37, 29, rnd);
  const medium = makePatternGrid(129, 99, rnd);
  const fine = makePatternGrid(379, 283, rnd);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < GAME_W; x++) {
      const offset = (y * GAME_W + x) * 4;
      const stone =
        samplePatternGrid(coarse, x, y, GAME_W, height) * 0.36 +
        samplePatternGrid(medium, x, y, GAME_W, height) * 0.32 +
        samplePatternGrid(fine, x, y, GAME_W, height) * 0.24;
      // Niezależny pył w każdym pikselu; również jego wzór nie ma okresu kafelka.
      let hash = Math.imul(x + 16411, 374761393) ^ Math.imul(y + 24133, 668265263);
      hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
      const dust = ((hash >>> 0) / 4294967295 - 0.5) * 0.07;
      const pathTone = pixels[offset] > pixels[offset + 1] * 1.08;
      // Plansza ma mieć widoczne, ale subtelne ziarno — faktura nie może konkurować
      // z drogami, wieżami i wrogami. Paski/menu zachowują osobną, mocniejszą fakturę.
      const strength = pathTone ? 0.12 : 0.16;
      const multiplier = Math.max(0.88, Math.min(1.12, 1 + (stone + dust) * strength));
      pixels[offset] = Math.round(pixels[offset] * multiplier);
      pixels[offset + 1] = Math.round(pixels[offset + 1] * multiplier);
      pixels[offset + 2] = Math.round(pixels[offset + 2] * multiplier);
    }
  }
  ctx.putImageData(image, 0, 0);
  texture.refresh();
  return key;
}

/**
 * Tworzy ziarnisty kamienny wzór z obrazu jako achromatyczną modulację jasności.
 * Bazowy kolor karty pozostaje bez zmian (oblicza go cardBackground); kolorem źródłowego
 * zdjęcia w ogóle nie malujemy. Kilka zawijanych oktaw szumu daje drobne kruszywo,
 * a odejmowanie średniej utrzymuje średnią jasność karty i jej obecną barwę.
 * `textureDarkness` zwiększa tylko kontrast ciemnych drobinek na wskazanej teksturze;
 * nie przyciemnia bazowego koloru powierzchni.
 */
export function makeMenuStoneTexture(
  scene: Phaser.Scene,
  baseColor: number,
  logicalWidth: number,
  logicalHeight: number,
  grainStrength = 0.28,
  textureDarkness = 0,
): string {
  const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(logicalWidth * dpr));
  const height = Math.max(1, Math.round(logicalHeight * dpr));
  const key = `menu-stone-${baseColor.toString(16).padStart(6, '0')}-${width}x${height}-g${Math.round(grainStrength * 100)}-d${Math.round(textureDarkness * 100)}`;
  if (scene.textures.exists(key)) return key;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const seed = (baseColor ^ (width * 374761393) ^ (height * 668265263)) >>> 0;
  const rnd = camoRandom(seed);
  const grids = [
    { grid: makePatternGrid(7, 6, rnd), weight: 0.42 },
    { grid: makePatternGrid(19, 16, rnd), weight: 0.29 },
    { grid: makePatternGrid(53, 46, rnd), weight: 0.19 },
    { grid: makePatternGrid(Math.max(1, Math.floor(width / 3)), Math.max(1, Math.floor(height / 3)), rnd), weight: 0.1 },
  ];

  const noise = new Float32Array(width * height);
  let mean = 0;
  let pixel = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      for (const layer of grids) value += samplePatternGrid(layer.grid, x, y, width, height) * layer.weight;
      noise[pixel++] = value;
      mean += value;
    }
  }
  mean /= noise.length;

  const image = ctx.createImageData(width, height);
  const sourceR = (baseColor >>> 16) & 255;
  const sourceG = (baseColor >>> 8) & 255;
  const sourceB = baseColor & 255;
  // Only deepen the negative/noise grains; keep the mean at 1 so the base color stays put.
  let shapedMean = 0;
  for (let i = 0; i < noise.length; i++) {
    const delta = noise[i] - mean;
    shapedMean += delta < 0 ? delta * (1 + textureDarkness) : delta;
  }
  shapedMean /= noise.length;

  // Neutral luminance-only modulation preserves hue; darkening affects only the pattern.
  for (let i = 0; i < noise.length; i++) {
    const delta = noise[i] - mean;
    const shaped = (delta < 0 ? delta * (1 + textureDarkness) : delta) - shapedMean;
    const luminanceMix = Math.max(0.55, Math.min(1.32, 1 + shaped * grainStrength));
    const offset = i * 4;
    image.data[offset] = Math.min(255, Math.max(0, Math.round(sourceR * luminanceMix)));
    image.data[offset + 1] = Math.min(255, Math.max(0, Math.round(sourceG * luminanceMix)));
    image.data[offset + 2] = Math.min(255, Math.max(0, Math.round(sourceB * luminanceMix)));
    image.data[offset + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);

  const texture = scene.textures.addCanvas(key, canvas);
  texture?.refresh();
  return key;
}

/** Reuses the exact menu-card grain at its original scale, cached for each surface size. */
export function makeStoneSurfaceTexture(
  scene: Phaser.Scene,
  baseColor: number,
  logicalWidth: number,
  logicalHeight: number,
  sourceWidth: number,
  sourceHeight: number,
  grainStrength = 0.28,
): string {
  const sourceKey = makeMenuStoneTexture(scene, baseColor, sourceWidth, sourceHeight, grainStrength);
  if (!sourceKey) return '';
  if (logicalWidth === sourceWidth && logicalHeight === sourceHeight) return sourceKey;

  // makeMenuStoneTexture always uses an HTMLCanvasElement as its source.
  const source = scene.textures.get(sourceKey).getSourceImage() as HTMLCanvasElement;
  const width = Math.max(1, Math.round(logicalWidth * source.width / sourceWidth));
  const height = Math.max(1, Math.round(logicalHeight * source.height / sourceHeight));
  const key = `${sourceKey}-surface-${width}x${height}`;
  if (scene.textures.exists(key)) return key;

  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) return '';
  const ctx = texture.getContext();
  for (let y = 0; y < height; y += source.height) {
    for (let x = 0; x < width; x += source.width) {
      ctx.drawImage(source, x, y);
    }
  }
  texture.refresh();
  return key;
}

/** Cień karty menu: miękka, ciemna krawędź rozłożona pod całą kartą, nie płaska plama. */
export function makeMenuCardShadow(scene: Phaser.Scene, cardWidth: number, cardHeight: number): string {
  const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  const pad = Math.ceil(12 * dpr);
  const width = Math.round((cardWidth + 24) * dpr);
  const height = Math.round((cardHeight + 24) * dpr);
  const key = `menu-card-shadow-${cardWidth}x${cardHeight}-d${dpr}`;
  if (scene.textures.exists(key)) return key;

  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) return '';
  const ctx = texture.getContext();
  const x = pad;
  const y = pad;
  const w = cardWidth * dpr;
  const h = cardHeight * dpr;
  const radius = 3 * dpr;

  // Rozmycie rozchodzi się na boki, z lekkim ciężarem cienia w dół.
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.78)';
  ctx.shadowBlur = 9 * dpr;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4 * dpr;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.restore();
  texture.refresh();
  return key;
}

export interface CamoTextTexture {
  width: number;
  height: number;
  shadowWidth: number;
  shadowHeight: number;
}

/**
 * Buduje teksturę napisu wypełnionego zimowym kamuflażem (bez obwódki).
 * Zwraca logiczny rozmiar (w px ekranu) albo null, gdy canvas jest niedostępny.
 */
export function makeCamoTextTexture(
  scene: Phaser.Scene,
  key: string,
  text: string,
  fontPx: number,
  fontFamily: string,
  resolution: number,
): CamoTextTexture | null {
  const scale = Math.max(1, Math.min(3, resolution));
  const font = `${Math.round(fontPx * scale)}px ${fontFamily}`;

  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) return null;
  probe.font = font;
  const metrics = probe.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent || fontPx * scale * 0.8;
  const descent = metrics.actualBoundingBoxDescent || fontPx * scale * 0.25;
  const pad = Math.round(6 * scale);
  const width = Math.ceil(metrics.width) + pad * 2;
  const height = Math.ceil(ascent + descent) + pad * 2;
  if (width <= 0 || height <= 0) return null;

  if (scene.textures.exists(key)) scene.textures.remove(key);
  const canvasTexture = scene.textures.createCanvas(key, width, height);
  if (!canvasTexture) return null;
  const ctx = canvasTexture.getContext();

  // 1. Tło: kolor podstawowy #ddd z lekkim pionowym przejściem (subtelna głębia).
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, CAMO_BASE);
  base.addColorStop(1, CAMO_TONES[0]);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // 2. Plamy moro: od największych (jasna szarość) po najmniejsze (chłodny cień).
  const rnd = camoRandom(0x5eed_2024);
  // Warstwy od ciemniejszych do jaśniejszych — biel jest ostatnia i najrzadsza,
  // więc pozostaje akcentem, a nie tłem wzoru.
  const layers = [
    // Ciemno-szare plamy wyraźnie akcentują wzór, ale bez dominacji nad bazą #ddd
    // i bez wypierania jaśniejszych tonów.
    { color: CAMO_DARK, count: 12, min: 0.3, max: 0.5 },
    { color: CAMO_TONES[2], count: 8, min: 0.26, max: 0.44 },
    { color: CAMO_TONES[1], count: 5, min: 0.2, max: 0.34 },
    { color: CAMO_ACCENT, count: 3, min: 0.12, max: 0.2 },
  ];
  for (const layer of layers) {
    ctx.fillStyle = layer.color;
    for (let i = 0; i < layer.count; i++) {
      const cx = rnd() * width;
      const cy = rnd() * height;
      const radius = height * (layer.min + rnd() * (layer.max - layer.min));
      camoBlob(ctx, rnd, cx, cy, radius);
    }
  }

  // 3. Drobne punkty na bazie #ddd — głównie jasne, co trzeci ciemniejszy, żeby
  // wzór nie był płaski i miał głębię także w drobnej skali.
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = i % 3 === 2 ? CAMO_TONES[3] : CAMO_ACCENT;
    const r = (0.6 + rnd() * 1.6) * scale;
    ctx.beginPath();
    ctx.arc(rnd() * width, rnd() * height, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Przycięcie wzoru do kształtu liter — bez obrysu i bez cienia.
  ctx.globalCompositeOperation = 'destination-in';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000000';
  ctx.fillText(text, width / 2, pad + ascent);
  ctx.globalCompositeOperation = 'source-over';

  canvasTexture.refresh();

  // Wyraźniejszy cień typograficzny: głęboka szarość, większe przesunięcie i mocniejsze
  // rozmycie — kontrastuje z zielonym tłem, bez czarnej obwódki. Druga warstwa dodaje
  // poświatę przy krawędziach, żeby litery mocniej odcinały się od planszy.
  const shadowPad = Math.round(16 * scale);
  const shadowOffsetY = Math.round(3.5 * scale);
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = width + shadowPad * 2;
  shadowCanvas.height = height + shadowPad * 2;
  const shadowCtx = shadowCanvas.getContext('2d');
  if (shadowCtx) {
    shadowCtx.filter = `blur(${Math.round(6.5 * scale)}px)`;
    shadowCtx.globalAlpha = 0.92;
    shadowCtx.drawImage(ctx.canvas, shadowPad, shadowPad + shadowOffsetY);
    shadowCtx.filter = 'none';
    shadowCtx.globalAlpha = 1;
    shadowCtx.globalCompositeOperation = 'source-in';
    shadowCtx.fillStyle = '#0a0f14';
    shadowCtx.fillRect(0, 0, shadowCanvas.width, shadowCanvas.height);
    shadowCtx.globalCompositeOperation = 'source-over';

    // warstwa poświaty na krawędziach — dodatkowo odcina litery od zielonego tła
    shadowCtx.globalAlpha = 0.75;
    shadowCtx.filter = `blur(${Math.round(2.5 * scale)}px)`;
    shadowCtx.drawImage(ctx.canvas, shadowPad, shadowPad + shadowOffsetY);
    shadowCtx.filter = 'none';
    shadowCtx.globalAlpha = 1;
    shadowCtx.globalCompositeOperation = 'source-in';
    shadowCtx.fillStyle = '#0a0f14';
    shadowCtx.fillRect(0, 0, shadowCanvas.width, shadowCanvas.height);
    shadowCtx.globalCompositeOperation = 'source-over';

    const shadowKey = key + '-shadow';
    if (scene.textures.exists(shadowKey)) scene.textures.remove(shadowKey);
    const shadowTexture = scene.textures.createCanvas(shadowKey, shadowCanvas.width, shadowCanvas.height);
    if (shadowTexture) {
      shadowTexture.getContext().drawImage(shadowCanvas, 0, 0);
      shadowTexture.refresh();
    }
  }

  return {
    width: width / scale,
    height: height / scale,
    shadowWidth: shadowCanvas.width / scale,
    shadowHeight: shadowCanvas.height / scale,
  };
}

/* =========================================================================================
   MIĘKKI CIEŃ WOBBEC IKONY (poświata naokoło, nie plama spod ikony).
   Kopia tekstury jest rozmywana i przyciemniana — powstaje poświata otaczająca ikonę
   z każdej strony. Generowana raz, jak wszystkie tekstury gry.
   ========================================================================================= */
export function makeIconShadowTexture(
  scene: Phaser.Scene,
  sourceKey: string,
  shadowKey: string,
  blur: number,
  fill: number,
  alpha: number,
): boolean {
  if (scene.textures.exists(shadowKey)) return true;
  const src = scene.textures.get(sourceKey).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
  if (!src || !src.width || !src.height) return false;

  const pad = Math.ceil(blur * 2.5);
  const width = src.width + pad * 2;
  const height = src.height + pad * 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(src as CanvasImageSource, pad, pad);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-in';
  const r = (fill >> 16) & 255;
  const g = (fill >> 8) & 255;
  const b = fill & 255;
  ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';

  const texture = scene.textures.addCanvas(shadowKey, canvas);
  texture?.refresh();
  return Boolean(texture);
}
