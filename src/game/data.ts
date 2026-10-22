/* =========================================================================================
   INWAZJA — dane i balans gry tower defense
   Plansza 800x600 podzielona na gęstą siatkę 32x24 (komórka 25 px), trzy drogi ataku
   (A — środkowa, B — dolna, C — górna) schodzące się w placu i jednym wyjściu do bazy.
   ========================================================================================= */

export const CELL = 25; // gęsta siatka: 800 / 25 = 32 kolumny, 600 / 25 = 24 wiersze
export const COLS = 32;
export const ROWS = 24;
export const PATH_CELL = 50; // logiczna komórka drogi = 2x2 gęste komórki

/* Układ ekranu: pasek HUD (0..60) / plansza (60..660) / panel wież (660..730). */
export const GAME_W = 800;
export const WORLD_Y = 60;
export const PLAY_BOTTOM = WORLD_Y + 600; // 660
export const PANEL_H = 70;
export const GAME_H = PLAY_BOTTOM + PANEL_H; // 730

/* Czytelna czcionka interfejsu (Roboto, ładowana w index.html) oraz rozdzielczość
   renderowania dopasowana do ekranu — napisy i cyfry są ostre także na HiDPI. */
export const UI_FONT = 'Cause, Roboto, "Segoe UI", "Helvetica Neue", Arial, sans-serif';
export const UI_RESOLUTION =
  typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

/* -----------------------------------------------------------------------------------------
   Priorytet wyboru celu (ta sama reguła dla całej broni):
     1. NAJNIŻSZE aktualne HP — dobijanie słabych; boss z dużym HP nie jest wybierany,
        dopóki obok jest np. czołg z mniejszym HP,
     2. przy równym HP — szybszy typ wroga (ENEMY_SPEED, spowolnienie obniża prędkość),
     3. remis — ten, któremu zostało najmniej drogi do bazy.
   Długość trasy NIE wpływa na priorytet (inaczej trasa decydowałaby o wyborze, a nie wróg).
   ----------------------------------------------------------------------------------------- */
/** Minimalny opis kandydata na cel — pasuje do niego obiekt wroga w scenie gry
    (żadnych obiektów pośrednich: funkcja jest wołana tysiące razy na klatkę). */
export interface TargetCandidate {
  hp: number;
  slowFactor: number;
  remaining: number;
  config: { type: EnemyType };
}

/** Efektywna prędkość wroga: nominalna prędkość typu pomniejszona o spowolnienie. */
export function targetSpeed(type: EnemyType, slowFactor: number): number {
  return ENEMY_SPEED[type] * (1 - slowFactor);
}

/** true, jeśli kandydat `a` ma wyższy priorytet niż `b`. Bez alokacji. */
export function isBetterTarget(a: TargetCandidate, b: TargetCandidate): boolean {
  // 1. najniższe HP — to główne kryterium
  if (a.hp !== b.hp) return a.hp < b.hp;
  // 2. przy równym HP — szybszy wróg
  const sa = targetSpeed(a.config.type, a.slowFactor);
  const sb = targetSpeed(b.config.type, b.slowFactor);
  if (Math.abs(sa - sb) > 1e-9) return sa > sb;
  // 3. remis — bliżej bazy
  return a.remaining < b.remaining;
}

/** Bazowe, bardzo ciemne tło okienek w menu (broń i wrogowie). */
export const CARD_BG_BASE = 0x0a1119;
/** Ile koloru ramki jest domieszane do tła okienka (rozjaśnia je o ok. 10 pkt jasności). */
const CARD_TINT = 0.2;

/**
 * Tło okienka w menu: ciemna baza z domieszką koloru ramki tego okienka.
 * Domieszka dobrana tak, by najmniejsze szare napisy (#8ea0b6) miały kontrast ≥ 4,8:1.
 */
export function cardBackground(borderColor: number): number {
  const mix = (shift: number) => {
    const a = (CARD_BG_BASE >> shift) & 255;
    const b = (borderColor >> shift) & 255;
    return Math.round(a + (b - a) * CARD_TINT);
  };
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

export const TOTAL_WAVES = 50;
export const TOWER_SCALE = 0.62;
export const START_GOLD = 500;
export const START_LIVES = 30;
export const SPEEDS = [1, 2];
export const SELL_FACTOR = 0.6; // sprzedaż zwraca 60% zainwestowanego złota

export const DEPTH = {
  GRID: 0,
  PATH: 1,
  TOWER: 5,
  ENEMY: 10,
  PROJECTILE: 15,
  FX: 18,
  HEALTH: 20,
  HUD: 50,
  PANEL: 60,
} as const;

/* -----------------------------------------------------------------------------------------
   Plansza: szkic 12x16 bloków (1 blok = 50 px). 0 = trawa, litera = jezdnia.
     A — droga środkowa (wjazd z lewej), B — dolna (wjazd od dołu), C — górna (wjazd z góry)
     P — plac, na którym drogi się łączą, D — jedyne wyjście z planszy (do bazy).
   ----------------------------------------------------------------------------------------- */
const BOARD_SKETCH = [
  '00C0000000000000',
  '00C00CCCCCCCCC00',
  '00CCCC0000000C00',
  '0000000AAAA00C00',
  'AAAAA00A00AABBBD',
  '0000A00A0000B000',
  '0000AAAA00BBB000',
  '0000000000B00000',
  '0BBBB00000BBBB00',
  '0B00B00000000B00',
  '0B00BBBBBBBBBB00',
  '0B00000000000000',
];

const BOARD_ROAD: boolean[][] = BOARD_SKETCH.map((row) =>
  row.split('').map((ch) => ch !== '0'),
);

/** Czy gęsta komórka (25 px) jest jezdnią — decyduje jej blok 2x2. */
export function isPath(col: number, row: number): boolean {
  const br = Math.floor(row / 2);
  const bc = Math.floor(col / 2);
  return Boolean(BOARD_ROAD[br] && BOARD_ROAD[br][bc]);
}

/** Wieżę wolno stawiać tylko na trawie sąsiadującej z drogą (także po skosie). */
export function isAdjacentToPath(col: number, row: number): boolean {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      if (isPath(col + dx, row + dy)) return true;
    }
  }
  return false;
}

/** Środek gęstej komórki we współrzędnych ekranu. */
export function cellCenter(col: number, row: number): { x: number; y: number } {
  return { x: col * CELL + CELL / 2, y: WORLD_Y + row * CELL + CELL / 2 };
}

/** Środek logicznej komórki drogi (50 px). */
function coarseCenter(col: number, row: number): { x: number; y: number } {
  return { x: col * PATH_CELL + PATH_CELL / 2, y: WORLD_Y + row * PATH_CELL + PATH_CELL / 2 };
}

export function pointerCell(x: number, y: number): { col: number; row: number } {
  return { col: Math.floor(x / CELL), row: Math.floor((y - WORLD_Y) / CELL) };
}

export function pointerOnBoard(x: number, y: number): boolean {
  return y >= WORLD_Y && y < PLAY_BOTTOM && x >= 0 && x <= GAME_W;
}

export function onBoard(x: number, y: number): boolean {
  return x >= 0 && x <= GAME_W && y >= WORLD_Y && y <= WORLD_Y + 600;
}

/* -----------------------------------------------------------------------------------------
   Trasy wrogów (współrzędne logiczne 50 px). Każda ma odcinek wstępny poza planszą,
   więc wrogowie „wyłaniają się” zza krawędzi. Wszystkie kończą się wyjściem [16,4].
   ----------------------------------------------------------------------------------------- */
export interface LanePath {
  id: string;
  name: string;
  points: { x: number; y: number }[];
  length: number;
  speedScale: number;
}

function buildPath(id: string, name: string, coords: [number, number][]): LanePath {
  const points = coords.map(([c, r]) => coarseCenter(c, r));
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return { id, name, points, length, speedScale: 1 };
}

export const PATHS: LanePath[] = [
  buildPath('A', 'Środkowa', [
    [-2, 4], [-1, 4],
    [0, 4], [1, 4], [2, 4], [3, 4], [4, 4],
    [4, 5], [4, 6],
    [5, 6], [6, 6], [7, 6],
    [7, 5], [7, 4], [7, 3],
    [8, 3], [9, 3], [10, 3],
    [10, 4], [11, 4],
    [12, 4], [13, 4], [14, 4],
    [15, 4], [16, 4],
  ]),
  buildPath('B', 'Dolna', [
    [1, 12], [1, 11], [1, 10], [1, 9], [1, 8],
    [2, 8], [3, 8], [4, 8],
    [4, 9], [4, 10],
    [5, 10], [6, 10], [7, 10], [8, 10], [9, 10], [10, 10],
    [11, 10], [12, 10], [13, 10],
    [13, 9], [13, 8],
    [12, 8], [11, 8], [10, 8],
    [10, 7], [10, 6],
    [11, 6], [12, 6],
    [12, 5], [12, 4],
    [13, 4], [14, 4],
    [15, 4], [16, 4],
  ]),
  buildPath('C', 'Górna', [
    [2, -2], [2, -1], [2, 0], [2, 1], [2, 2],
    [3, 2], [4, 2], [5, 2], [5, 1],
    [6, 1], [7, 1], [8, 1], [9, 1],
    [10, 1], [11, 1], [12, 1], [13, 1],
    [13, 2], [13, 3], [13, 4],
    [14, 4], [15, 4], [16, 4],
  ]),
];

// Prędkość wrogów jest absolutnie stała na wszystkich drogach (speedScale = 1).
PATHS.forEach((p) => {
  p.speedScale = 1;
});

export function getPathById(id: string): LanePath {
  return PATHS.find((p) => p.id === id) ?? PATHS[0];
}

/* -----------------------------------------------------------------------------------------
   Wieże: 4 typy x 3 poziomy. Mróz nie zadaje obrażeń — tylko spowalnia.
   Poziom 2 ≈ +25% obrażeń, poziom 3 ≈ +50% (wartości całkowite).
   ----------------------------------------------------------------------------------------- */
export type TowerType = 'arrow' | 'cannon' | 'frost' | 'lightning';
export type EnemyType = 'basic' | 'fast' | 'tank' | 'boss' | 'megaboss';

export const TOWER_ORDER: TowerType[] = ['arrow', 'cannon', 'frost', 'lightning'];

export const TOWER_INFO: Record<TowerType, { name: string; hotkey: string; color: number; desc: string }> = {
  arrow: { name: 'Strzała', hotkey: '1', color: 0x2ecc71, desc: 'Szybki, pojedynczy cel' },
  cannon: { name: 'Armata', hotkey: '2', color: 0xe67e22, desc: 'Obrażenia obszarowe' },
  frost: { name: 'Mróz', hotkey: '3', color: 0x3498db, desc: 'Spowalnia wrogów' },
  lightning: { name: 'Błyskawica', hotkey: '4', color: 0x9b59b6, desc: 'Łańcuch celów' },
};

/** Opis działania broni na ekran tytułowy. */
export const MENU_EFFECTS: Record<TowerType, string> = {
  arrow: 'pojedynczy cel',
  cannon: 'mocny strzał',
  frost: 'spowalnia wroga',
  lightning: 'łańcuch 3 cele',
};

export interface TowerLevelStats {
  damage: number;
  range: number;
  fireRate: number; // ms między strzałami
  splash: number;
  slow: number; // ułamek spowolnienia (0..1)
  slowDuration: number; // ms trwania spowolnienia (mróz)
  chain: number; // liczba celów w łańcuchu
  chainDamage: number[]; // obrażenia kolejnych ogniw łańcucha (błyskawica)
  cost: number;
  upgradeCost: number;
}

export const TOWER_STATS: Record<TowerType, TowerLevelStats[]> = {
  arrow: [
    { damage: 10, range: 130, fireRate: 500, splash: 0, slow: 0, slowDuration: 0, chain: 0, chainDamage: [], cost: 50, upgradeCost: 40 },
    { damage: 13, range: 150, fireRate: 400, splash: 0, slow: 0, slowDuration: 0, chain: 0, chainDamage: [], cost: 0, upgradeCost: 70 },
    { damage: 15, range: 170, fireRate: 300, splash: 0, slow: 0, slowDuration: 0, chain: 0, chainDamage: [], cost: 0, upgradeCost: 0 },
  ],
  cannon: [
    { damage: 25, range: 120, fireRate: 1200, splash: 0, slow: 0, slowDuration: 0, chain: 0, chainDamage: [], cost: 90, upgradeCost: 60 },
    { damage: 31, range: 135, fireRate: 1000, splash: 0, slow: 0, slowDuration: 0, chain: 0, chainDamage: [], cost: 0, upgradeCost: 100 },
    { damage: 38, range: 150, fireRate: 850, splash: 0, slow: 0, slowDuration: 0, chain: 0, chainDamage: [], cost: 0, upgradeCost: 0 },
  ],
  frost: [
    { damage: 0, range: 120, fireRate: 800, splash: 0, slow: 0.35, slowDuration: 2000, chain: 0, chainDamage: [], cost: 120, upgradeCost: 50 },
    { damage: 0, range: 140, fireRate: 700, splash: 0, slow: 0.4, slowDuration: 2500, chain: 0, chainDamage: [], cost: 0, upgradeCost: 85 },
    { damage: 0, range: 160, fireRate: 600, splash: 0, slow: 0.45, slowDuration: 3000, chain: 0, chainDamage: [], cost: 0, upgradeCost: 0 },
  ],
  /* BŁYSKAWICA: łańcuch na 3 cele, obrażenia malejące wzdłuż łańcucha.
     Poziom 1: 25 / 10 / 5 = 40 HP łącznie (nikt nie dostaje całych 40).
     Ulepszenia skalują pulę proporcjonalnie (×1,2 i ×1,4). */
  lightning: [
    { damage: 25, range: 140, fireRate: 1000, splash: 0, slow: 0, slowDuration: 0, chain: 3, chainDamage: [25, 10, 5], cost: 150, upgradeCost: 90 },
    { damage: 30, range: 155, fireRate: 850, splash: 0, slow: 0, slowDuration: 0, chain: 3, chainDamage: [30, 12, 6], cost: 0, upgradeCost: 140 },
    { damage: 35, range: 175, fireRate: 700, splash: 0, slow: 0, slowDuration: 0, chain: 3, chainDamage: [35, 14, 7], cost: 0, upgradeCost: 0 },
  ],
};

export const PROJECTILE_SPEED: Record<TowerType, number> = {
  arrow: 460,
  cannon: 280,
  frost: 380,
  lightning: 700,
};

export function damageLabel(stats: TowerLevelStats): string {
  return `${Math.round(stats.damage * 10) / 10} DMG`;
}

/* -----------------------------------------------------------------------------------------
   Wrogowie i macierz skuteczności broni.
     podstawowy : strzała, armata, mróz (prąd nie działa)
     szybki     : strzała, mróz i prąd (ARMATA nie działa — zbyt zwrotny cel)
     czołg      : strzała (25% DMG), armata i mróz (PRĄD nie działa — opancerzony)
     boss/mega  : strzała (50% DMG), armata i prąd (mróz nie działa)
   ----------------------------------------------------------------------------------------- */
export const ENEMY_ORDER: EnemyType[] = ['basic', 'fast', 'tank', 'boss', 'megaboss'];

export const ENEMY_STYLE: Record<EnemyType, { texture: string; color: number; label: string }> = {
  basic: { texture: 'enemy-basic', color: 0xef4444, label: 'Podstawowy' },
  fast: { texture: 'enemy-fast', color: 0xf59e0b, label: 'Szybki' },
  tank: { texture: 'enemy-tank', color: 0x64748b, label: 'Czołg' },
  boss: { texture: 'enemy-boss', color: 0xa855f7, label: 'BOSS' },
  megaboss: { texture: 'enemy-megaboss', color: 0xe11d48, label: 'MEGA BOSS' },
};

/** Ile żyć bazy zabiera wróg, który dotrze do końca drogi. */
export const DAMAGE_BY_TYPE: Record<EnemyType, number> = { basic: 1, fast: 1, tank: 2, boss: 5, megaboss: 10 };

const EFFECTIVENESS: Record<EnemyType, Record<TowerType, boolean>> = {
  basic: { arrow: true, cannon: true, frost: true, lightning: false },
  // armata nie trafia szybkich — wieża nie nadąża za ich tempem
  fast: { arrow: true, cannon: false, frost: true, lightning: true },
  // prąd nie działa na czołg — pancerz izoluje
  tank: { arrow: true, cannon: true, frost: true, lightning: false },
  boss: { arrow: true, cannon: true, frost: false, lightning: true },
  megaboss: { arrow: true, cannon: true, frost: false, lightning: true },
};

export function canAffect(towerType: TowerType, enemyType: EnemyType): boolean {
  const row = EFFECTIVENESS[enemyType];
  return row ? row[towerType] !== false : true;
}

const DAMAGE_MULT: Partial<Record<EnemyType, Partial<Record<TowerType, number>>>> = {
  tank: { arrow: 0.25 },
  boss: { arrow: 0.5 },
  megaboss: { arrow: 0.5 },
};

export function damageFactor(towerType: TowerType, enemyType: EnemyType): number {
  const f = DAMAGE_MULT[enemyType]?.[towerType];
  return f === undefined ? 1 : f;
}

export function isBossType(type: EnemyType): boolean {
  return type === 'boss' || type === 'megaboss';
}

/** Ile strzałów o danych obrażeniach trzeba, by zabić wroga o danym HP (do opisów UI). */
export function hitsToKill(damage: number, hp: number): number | null {
  if (!damage || damage <= 0) return null;
  return Math.ceil(hp / damage);
}

/** Tekst: na jakie typy wrogów broń nie działa / działa słabiej. */
export function towerWeakText(towerType: TowerType): string {
  const weak: string[] = [];
  const reduced: string[] = [];
  for (const et of ENEMY_ORDER) {
    if (!canAffect(towerType, et)) weak.push(ENEMY_STYLE[et].label);
    else {
      const f = damageFactor(towerType, et);
      if (f < 1) reduced.push(`${ENEMY_STYLE[et].label} tylko ${Math.round(f * 100)}%`);
    }
  }
  if (!weak.length && !reduced.length) return 'działa na wszystkie typy';
  const parts: string[] = [];
  if (weak.length) parts.push('nie działa na: ' + weak.join(', '));
  if (reduced.length) parts.push(reduced.join(', '));
  return parts.join(' · ');
}

/** Tekst: na jakie bronie wróg jest odporny. */
export function enemyImmuneText(enemyType: EnemyType): string {
  const weak = TOWER_ORDER.filter((t) => !canAffect(t, enemyType)).map((t) => TOWER_INFO[t].name);
  return weak.length ? 'odporny na: ' + weak.join(' · ') : 'wrażliwy na wszystko';
}

/* -----------------------------------------------------------------------------------------
   Punktacja: maksimum daje zabójstwo wieżą podstawową (poziom 1);
   ulepszenia obniżają punkty (100% / 50% / 20%), a fale skalują je w górę.
   ----------------------------------------------------------------------------------------- */
export const ENEMY_POINTS: Record<EnemyType, number> = { basic: 10, fast: 12, tank: 25, boss: 200, megaboss: 500 };
export const LEVEL_SCORE_FACTOR = [1, 0.5, 0.2];
export const SCORE_WAVE_STEP = 0.15;

/* -----------------------------------------------------------------------------------------
   Generator 50 fal (parametry: BALANCE niżej):
   - budżet HP fali rośnie gładko (waveHpBudget), a liczba wrogów wynika z budżetu i składu,
   - HP każdego typu rośnie do samego końca gry (enemyHpAtWave), bez pułapów,
   - fala wypłaca dokładnie `waveIncome(w)` złota (fala 1: 40 zł, każda następna +19 zł),
   - boss prowadzący (co 10 fal) wchodzi na czele kolumny; MEGA BOSS na 50. fali,
   - od fali 42 (finał) wyłącznie czołgi i bossowie.
   Grupy startują równolegle i wypuszczają wrogów seriami (burst), więc fale się mieszają.
   ----------------------------------------------------------------------------------------- */
export interface EnemyConfig {
  type: EnemyType;
  hp: number;
  speed: number;
  gold: number;
  damage: number;
}

export interface WaveGroup {
  config: EnemyConfig;
  count: number;
  interval: number;
  burst: number;
  delay: number;
  boss?: boolean;
}

export interface Wave {
  number: number;
  groups: WaveGroup[];
  bonus: number;
}

/* -----------------------------------------------------------------------------------------
   BALANS GRY — wszystkie pokrętła w jednym miejscu (strojone symulatorem rozgrywki).
   - HP wrogów rośnie liniowo do samego końca (bez pułapów); przewagę nad nim daje złoto,
     które gracz zamienia w kolejne wieże i ulepszenia,
   - trudność rośnie równomiernie: początek jest łagodny, a nie najtrudniejszy w całej grze,
   - fale 1-41 to mieszanka podstawowych, szybkich, czołgów i (od 15.) bossów,
     fale 42-50 to FINAŁ: wyłącznie czołgi i bossowie.
   ----------------------------------------------------------------------------------------- */
export const BALANCE = {
  incomeW1: 40, // złoto z 1. fali
  incomeStep: 19, // o tyle więcej z każdą kolejną falą
  hp: { basic: 60, fast: 45, tank: 150 } as Record<string, number>, // HP na 1. fali
  hpGrowth: { basic: 0.02151, fast: 0.02151, tank: 0.02151, boss: 0.02151 } as Record<string, number>, // współczynnik wzrostu (HP ×6 na 50. fali)
  hpPower: 1.4, // krzywa wzrostu: 1 = liniowo, >1 = łagodny początek i ostrzejsza końcówka
  bossFirstHp: 500, // boss z 10. fali
  escortBossMult: 0.7, // zwykły boss w eskorcie = tyle × boss prowadzący
  megaHp: 5000, // MEGA BOSS (fala 50)
  // Budżet HP fali = 240 (4 × 60 HP na 1. fali) + L·(w-1) + Q·(w-1)² + K·(w-1)³.
  // Liniowy trzyma łagodny początek, kwadratowy buduje środek gry, sześcienny dociska dopiero finał.
  budgetLinear: 60,
  budgetQuad: 4,
  budgetCubic: 0.6,
  finaleBoost: 0.1, // dodatkowy mnożnik budżetu rosnący od 0 do tej wartości w falach 42-50
  finaleStart: 42, // od tej fali tylko czołgi i bossowie

  /* --- model trudności (liczony statystycznie, nie dobrany na oko) ---
     dmgPerGold: zmierzona efektywna wydajność standardowej obrony (obrażenia na
       wygrane złoto). W symulatorze rozgrywki wychodzi 0,111 DMG/złoto i jest
       praktycznie stałe na falach 1..50, więc to nie jest dopasowanie do jednej fali.
     timeFactor: korekta czasu fali — model policzy (okno spawnu + czas marszu),
       a fala realnie trwa ~1,35x dłużej, bo wrogowie giną w drodze, a nie u bazy.
     difficultyStart/End: jaką część osiągalnej mocy armii wymaga fala.
       0,18 na początku (lekki start), 0,95 na 50. fali.
       Krzywa jest liniowa, więc trudność rośnie równomiernie, a nie skokowo.
       Wartości dobrane pomiarem w symulatorze rozgrywki: gracz, który stawia wieże
       w dobrych miejscach, kończy kampanię z ~22-25 życiami (przy 30 startowych). */
  dmgPerGold: 0.111,
  timeFactor: 1.35,
  /* Trudność fali w trzech punktach kotwiczenia (udział osiągalnej mocy armii):
     1. fala → 0,10 (lekki start), 40. fala → 0,55 (spokojne przejście),
     50. fala → 0,85 (finał napiera). Odcinki są liniowe, więc trudność rośnie
     równomiernie w środku kampanii, a finał dociska. */
  difficultyAnchors: [[1, 0.1], [40, 0.55], [50, 0.85]] as [number, number][],
};

const ENEMY_BASE_HP = BALANCE.hp;

/** HP wroga na fali `w` — liniowy wzrost od wartości startowej, bez pułapu. */
function enemyHpAtWave(type: EnemyType, w: number): number {
  if (type === 'boss') {
    return Math.round((BALANCE.escortBossMult * bossLeaderHp(w)) / 10) * 10;
  }
  const start = ENEMY_BASE_HP[type] ?? ENEMY_BASE_HP.basic;
  return Math.round(start * (1 + BALANCE.hpGrowth[type] * Math.pow(w - 1, BALANCE.hpPower)));
}

/** HP bossa prowadzącego falę (10, 20, 30, 40) — 500 na 10. fali, potem liniowy wzrost. */
function bossLeaderHp(w: number): number {
  const base = BALANCE.bossFirstHp * (1 + BALANCE.hpGrowth.boss * Math.pow(Math.max(w, 10) - 10, BALANCE.hpPower));
  return Math.round(base / 50) * 50;
}

const GOLD_BASE: Record<string, number> = { basic: 10, fast: 12, tank: 30, boss: 120 };
/* Prędkości eskorty w tej samej fali (boss na czele kolumny).
    podstawowy i boss: tak samo (62),
    czołg: trochę wolniej od podstawowego (56),
    szybki: 1,5× szybciej niż wcześniej (90 → 135). */
export const ENEMY_SPEED: Record<EnemyType, number> = { basic: 62, fast: 135, tank: 56, boss: 62, megaboss: 62 };

export function waveIncome(w: number): number {
  return BALANCE.incomeW1 + BALANCE.incomeStep * (w - 1);
}

/** HP bossa z fali 10 i MEGA BOSSA z fali 50 — liczone przy budowaniu fal, używane w menu. */
export let BOSS_HP_WAVE10 = 0;
export let MEGA_BOSS_HP = 0;

/* Udziały procentowe składu fali: [fala, podstawowy%, szybki%, czołg%, zwykli bossowie%].
   Od fali 42 (BALANCE.finaleStart) wyłącznie czołgi i bossowie. */
const WAVE_SHARE_ANCHORS: [number, number, number, number, number][] = [
  [1, 100, 0, 0, 0],   // 4 podstawowych — dokładnie jak przed zmianami
  [2, 100, 0, 0, 0],   // same podstawowe (jeszcze bez szybkich)
  [3, 82, 18, 0, 0],   // pierwsze szybkie
  [5, 72, 28, 0, 0],
  [6, 64, 24, 12, 0],
  [9, 56, 28, 16, 0],
  [14, 48, 28, 24, 0],
  [15, 46, 27, 24, 3],
  [25, 38, 26, 26, 10],
  [32, 32, 22, 30, 16],
  [38, 20, 12, 38, 30],
  [41, 6, 4, 50, 40],
  [42, 0, 0, 58, 42],
  [50, 0, 0, 50, 50],
];

function waveShares(w: number): { basic: number; fast: number; tank: number; boss: number } {
  const A = WAVE_SHARE_ANCHORS;
  if (w <= A[0][0]) return { basic: A[0][1], fast: A[0][2], tank: A[0][3], boss: A[0][4] };
  for (let i = 0; i < A.length - 1; i++) {
    const a = A[i];
    const b = A[i + 1];
    if (w <= b[0]) {
      const t = (w - a[0]) / (b[0] - a[0]);
      return {
        basic: a[1] + (b[1] - a[1]) * t,
        fast: a[2] + (b[2] - a[2]) * t,
        tank: a[3] + (b[3] - a[3]) * t,
        boss: a[4] + (b[4] - a[4]) * t,
      };
    }
  }
  const last = A[A.length - 1];
  return { basic: last[1], fast: last[2], tank: last[3], boss: last[4] };
}

/* --- złoto, jakie gracz ma do dyspozycji po danej fali -------------------------
   START_GOLD + suma wypłat fal (40 + 19·(w-1)) + sumy premii za falę (2·(w-1)). */
export function goldAfterWave(w: number): number {
  let gold = START_GOLD;
  for (let i = 1; i <= w; i++) gold += waveIncome(i) + 2 * (i - 1);
  return gold;
}

/* Średnia długość drogi — wrogowie rozchodzą się po trzech drogach. */
const AVG_PATH_LEN = PATHS.reduce((sum, p) => sum + p.length, 0) / PATHS.length;

/** Trudność wymagana od fali — interpolacja między punktami kotwiczenia. */
function difficultyAt(w: number): number {
  const A = BALANCE.difficultyAnchors;
  if (w <= A[0][0]) return A[0][1];
  for (let i = 0; i < A.length - 1; i++) {
    const [aw, av] = A[i];
    const [bw, bv] = A[i + 1];
    if (w <= bw) return av + ((bv - av) * (w - aw)) / (bw - aw);
  }
  return A[A.length - 1][1];
}

/** Średnie HP jednego wroga w fali (zależy od składu i krzywej HP). */
function averageEnemyHp(w: number): number {
  const sh = waveShares(w);
  return (
    (sh.basic * enemyHpAtWave('basic', w) +
      sh.fast * enemyHpAtWave('fast', w) +
      sh.tank * enemyHpAtWave('tank', w) +
      sh.boss * enemyHpAtWave('boss', w)) /
    100
  );
}

/** Średnia prędkość wroga w fali — z niej liczymy czas marszu do bazy. */
function averageEnemySpeed(w: number): number {
  const sh = waveShares(w);
  const total = sh.basic + sh.fast + sh.tank + sh.boss;
  if (total <= 0) return ENEMY_SPEED.basic;
  return (
    (sh.basic * ENEMY_SPEED.basic +
      sh.fast * ENEMY_SPEED.fast +
      sh.tank * ENEMY_SPEED.tank +
      sh.boss * ENEMY_SPEED.boss) /
    total
  );
}

/**
 * Budżet HP fali wyliczony z ekonomii i realiów broni:
 *
 *   budżet = wymagana trudność × (efektywne DMG na złoto) × (złoto gracza) × (czas fali)
 *
 * Znaczenie: fala ma tyle HP, ile standardowa obrona potrafi w jej trakcie wystrzelić,
 * pomnożone o wymagany udział. Liczba wrogów wynika z budżetu i ze średniego HP,
 * więc fala jest zawsze warta dokładnie tyle, ile wynosi z jej budżetu.
 */
/** Bazowy budżet z modelu ekonomii (bez korekt wczesnej gry). */
function waveHpBudgetModel(w: number): number {
  const leaderHp = w % 10 === 0 ? (w === TOTAL_WAVES ? BALANCE.megaHp : bossLeaderHp(w)) : 0;
  const avgHp = averageEnemyHp(w);
  const travel = AVG_PATH_LEN / Math.max(1, averageEnemySpeed(w));
  const gold = goldAfterWave(w);
  const capacityPerSecond = BALANCE.dmgPerGold * gold;

  // Okno spawnu zależy od liczby wrogów, a liczba wrogów z budżetu — rozwiązujemy
  // to iteracyjnie (wahania tłumimy przez uśrednienie z poprzednim krokiem).
  let count = Math.max(4, Math.round((capacityPerSecond * (travel * BALANCE.timeFactor) * difficultyAt(w)) / Math.max(1, avgHp)));
  let budget = count * avgHp + leaderHp;
  for (let i = 0; i < 4; i++) {
    let spawnWindow = 0;
    const groups = 4;
    const perGroup = count / groups;
    for (let g = 0; g < groups; g++) {
      const interval = g === 0 ? 110 : g === 1 ? 130 : g === 2 ? 340 : 700;
      const delay = g * 200;
      spawnWindow = Math.max(spawnWindow, delay + (perGroup / 2) * interval);
    }
    const duration = (spawnWindow / 1000 + travel) * BALANCE.timeFactor;
    const target = difficultyAt(w) * capacityPerSecond * duration;
    const nextCount = Math.max(4, Math.round((target - leaderHp) / Math.max(1, avgHp)));
    const blended = Math.round((count + nextCount) / 2);
    if (blended === count) break;
    count = blended;
    budget = count * avgHp + leaderHp;
  }
  return Math.max(avgHp * 4 + leaderHp, budget);
}

/* -----------------------------------------------------------------------------------------
   BUDŻET FAL: model + gwarancja WZROSTU od samego początku.
   Sam model ekonomii dawał falom 1-4 niemal identyczne HP (240, 237, 239, 248), przez co
   pierwsze fale były nierozróżnialne. Nakładamy więc na początek kampanii płynny wzrost:
     1. fala = 300 HP (dokładnie 5 podstawowych po 60 HP),
     każda kolejna (do 10.) = co najmniej +18% poprzedniej,
   a od 10. fali obowiązuje już model (jest wyższy od tej rampy).
   Dzięki temu fale zawsze rosną, a nie stoją w miejscu.
   ----------------------------------------------------------------------------------------- */
const WAVE_BUDGETS: number[] = (() => {
  const budgets: number[] = [];
  let previous = 0;
  for (let w = 1; w <= TOTAL_WAVES; w++) {
    const model = waveHpBudgetModel(w);
    // 1. fala: dokładnie 4 podstawowych (4 x 60 = 240 HP). 2. fala jest wyraźnie mocniejsza
    // (+22%: 5 podstawowych), od 3. fali obowiązuje model ekonomii (szybcy wchodzą od 3. fali).
    let value = model;
    if (w === 1) value = 240;
    else if (w === 2) value = Math.max(model, previous * 1.22);
    else if (w <= 10) value = Math.max(model, previous * 1.06);
    // HP fali nigdy nie maleje — kolejne fale są co najmniej równie wymagające.
    value = Math.max(value, previous, model);
    budgets.push(Math.round(value));
    previous = value;
  }
  return budgets;
})();

/** Budżet HP fali: model ekonomii z gwarancją monotonicznego wzrostu (patrz WAVE_BUDGETS). */
export function waveHpBudget(w: number): number {
  return WAVE_BUDGETS[Math.min(TOTAL_WAVES, Math.max(1, Math.round(w))) - 1];
}

/** Liczba wrogów w fali — wynika z budżetu HP i ze średniego HP wroga.
    Wczesne fale mają dodatkowo gwarantowany wzrost liczebności (4, 5, 6, 7...), bo przy
    zaokrągleniach sam budżet potrafił dać falę 3 mniejszą od fali 2. */
function waveEnemyTotal(w: number, leaderHp: number): number {
  const avgHp = averageEnemyHp(w);
  const fromBudget = Math.max(4, Math.round((waveHpBudget(w) - leaderHp) / avgHp));
  const earlyMinimum = w <= 12 ? 3 + w : 0;
  return Math.max(4, fromBudget, Math.min(earlyMinimum, 15));
}

function buildWave(w: number): Wave {
  const groups: WaveGroup[] = [];

  const add = (type: EnemyType, count: number, interval: number, burst: number, delay: number) => {
    const c = Math.round(count);
    if (c < 1) return;
    groups.push({
      config: {
        type,
        hp: 0,
        speed: ENEMY_SPEED[type] ?? ENEMY_SPEED.basic,
        gold: 1,
        damage: DAMAGE_BY_TYPE[type],
      },
      count: c,
      interval,
      burst: burst || 1,
      delay: delay || 0,
    });
  };

  /* --- skład fali: w finale nie ma podstawowych ani szybkich --- */
  const finale = w >= BALANCE.finaleStart;
  const shares = waveShares(w);
  const leaderHp = w % 10 === 0 ? (w === TOTAL_WAVES ? BALANCE.megaHp : bossLeaderHp(w)) : 0;
  const total = waveEnemyTotal(w, leaderHp);
  const countFor = (pct: number, min = 0) => Math.max(min, Math.round((total * pct) / 100));
  if (!finale) {
    // Fale 1-4 idą pojedynczo i wolniej (burst 1): przy burstcie 2 wrogowie wchodzą
    // niemal naraz i wieże nie nadążają ich ostrzeliwać — powstają przecieki
    // na samym początku gry, gdzie gracz ma dopiero kilka wież.
    const early = w <= 4;
    add('basic', countFor(shares.basic, 2), early ? 240 : 110, early ? 1 : 2, 0);
    if (shares.fast > 0.5) add('fast', countFor(shares.fast, 1), early ? 260 : 130, early ? 1 : 2, 260);
  }
  if (shares.tank > 0.5) add('tank', countFor(shares.tank, 1), 340, 1, 520);
  if (shares.boss > 0.5) add('boss', countFor(shares.boss, 1), 700, 1, 1100);

  /* --- wypłaty: suma złota z fali to dokładnie waveIncome(w) --- */
  const bonus = Math.round(2 * (w - 1));
  const killBudget = Math.max(1, waveIncome(w) - bonus);
  let weightSum = 0;
  groups.forEach((g) => {
    weightSum += g.count * GOLD_BASE[g.config.type];
  });
  groups.forEach((g) => {
    g.config.gold = Math.max(1, Math.round((killBudget * GOLD_BASE[g.config.type]) / weightSum));
  });

  /* --- HP: liniowy wzrost do końca gry --- */
  const isBossWave = w % 10 === 0;
  const isMega = w === TOTAL_WAVES;
  groups.forEach((g) => {
    g.config.hp = enemyHpAtWave(g.config.type, w);
  });

  /* --- boss prowadzący: 10. fala = 500 HP, potem liniowo; MEGA BOSS = BALANCE.megaHp --- */
  let bossHp = 0;
  if (isBossWave) {
    bossHp = isMega ? BALANCE.megaHp : bossLeaderHp(w);
    if (w === 10) BOSS_HP_WAVE10 = bossHp;
    if (isMega) MEGA_BOSS_HP = bossHp;
  }

  /* --- boss wychodzi na czele kolumny, eskorta startuje niemal równocześnie --- */
  if (isBossWave) {
    groups.forEach((g, gi) => {
      g.delay = 60 + gi * 40;
    });
    groups.push({
      config: {
        type: isMega ? 'megaboss' : 'boss',
        hp: bossHp,
        speed: ENEMY_SPEED.boss,
        gold: Math.round(killBudget * 0.25),
        damage: DAMAGE_BY_TYPE[isMega ? 'megaboss' : 'boss'],
      },
      count: 1,
      interval: 1000,
      burst: 1,
      delay: 0,
      boss: true,
    });
  }

  return { number: w, groups, bonus };
}

/** Buduje komplet fal od zera (bez pamięci podręcznej) — używane też przez symulator balansu. */
export function buildAllWaves(): Wave[] {
  const waves: Wave[] = [];
  let previousHp = 0;
  for (let w = 1; w <= TOTAL_WAVES; w++) {
    const wave = buildWave(w);
    let totalHp = 0;
    for (const g of wave.groups) totalHp += g.count * g.config.hp;
    // Gwarancja: żadna fala nie jest słabsza od poprzedniej (+2% zapasu). Zmiana składu
    // (np. wejście bossów) potrafiła wcześniej dać falę o niższej sumie HP niż poprzednia.
    const minimum = Math.round(previousHp * 1.02);
    if (totalHp < minimum) {
      const basic = wave.groups.find((g) => g.config.type === 'basic');
      if (basic && basic.config.hp > 0) {
        basic.count += Math.ceil((minimum - totalHp) / basic.config.hp);
        totalHp = 0;
        for (const g of wave.groups) totalHp += g.count * g.config.hp;
      }
    }
    previousHp = totalHp;
    waves.push(wave);
  }
  return waves;
}

let wavesCache: Wave[] | null = null;

/** Fale budujemy raz (są deterministyczne) i trzymamy w pamięci. */
export function makeWaves(): Wave[] {
  if (!wavesCache) wavesCache = buildAllWaves();
  return wavesCache;
}

export function waveTotal(wave: Wave): number {
  return wave.groups.reduce((sum, g) => sum + g.count, 0);
}

export function waveHasBoss(wave: Wave): EnemyType | null {
  for (const g of wave.groups) {
    if (g.config.type === 'boss' || g.config.type === 'megaboss') return g.config.type;
  }
  return null;
}

/* -----------------------------------------------------------------------------------------
   Opisy wrogów na ekran tytułowy (HP zgodne z generatorem fal).
   ----------------------------------------------------------------------------------------- */
export interface MenuEnemy {
  type: EnemyType;
  name: string;
  hp: string;
  scale: number;
  immune: string;
}

function formatHp(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' HP';
}

export function menuEnemies(): MenuEnemy[] {
  makeWaves(); // najpierw fale, żeby HP bossów było już policzone
  const hp: Record<EnemyType, number> = {
    basic: ENEMY_BASE_HP.basic,
    fast: ENEMY_BASE_HP.fast,
    tank: ENEMY_BASE_HP.tank,
    boss: BOSS_HP_WAVE10,
    megaboss: MEGA_BOSS_HP,
  };
  const defs: { type: EnemyType; name: string; scale: number }[] = [
    { type: 'basic', name: 'PODSTAWOWY', scale: 1 },
    { type: 'fast', name: 'SZYBKI', scale: 1 },
    { type: 'tank', name: 'CZOŁG', scale: 1 },
    { type: 'boss', name: 'BOSS', scale: 0.92 },
    { type: 'megaboss', name: 'MEGA BOSS', scale: 0.68 },
  ];
  return defs.map((d) => ({ ...d, hp: formatHp(hp[d.type]), immune: enemyImmuneText(d.type) }));
}

/* -----------------------------------------------------------------------------------------
   Narożniki dróg na poziomie jednej kratki (25 px): zakręty dostają zaokrąglony kafelek,
   żeby jezdnia nie miała ostrych, kwadratowych rogów.
   ----------------------------------------------------------------------------------------- */
const CORNER_RADIUS = 9;
export function cornerRadius(): number {
  return CORNER_RADIUS;
}

const BEND_OPPOSITE: Record<string, string> = { ne: 'sw', sw: 'ne', nw: 'se', se: 'nw' };

function bendCorner(col: number, row: number): string | null {
  let mask = 0;
  if (isPath(col, row - 1)) mask |= 1; // N
  if (isPath(col + 1, row)) mask |= 2; // E
  if (isPath(col, row + 1)) mask |= 4; // S
  if (isPath(col - 1, row)) mask |= 8; // W
  if (mask === 3) return 'ne';
  if (mask === 6) return 'se';
  if (mask === 9) return 'nw';
  if (mask === 12) return 'sw';
  return null;
}

/** Klucz tekstury narożnikowej dla komórki albo null, gdy wystarczy zwykły kafelek. */
export function cornerTextureKey(col: number, row: number): string | null {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
  if (col === 0 || col === COLS - 1 || row === 0 || row === ROWS - 1) return null; // krawędź: pełny kafelek
  const bend = bendCorner(col, row);
  if (!bend) return null;
  const on = isPath(col, row);
  const corner = on ? BEND_OPPOSITE[bend] : bend;
  const suffix = (col + row) % 2 === 0 ? '' : '-b';
  return (on ? 'tile-corner-' : 'tile-inner-') + corner + suffix;
}
