(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const uiCoins = document.getElementById("coins");
  const uiLives = document.getElementById("lives");
  const uiLevel = document.getElementById("level");
  const help = document.getElementById("help");
  const startBtn = document.getElementById("startBtn");
  const touchEl = document.getElementById("touch");

  /** @param {number} v */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /** @param {{x:number,y:number,w:number,h:number}} a @param {{x:number,y:number,w:number,h:number}} b */
  const aabb = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  const Keys = {
    left: false,
    right: false,
    up: false,
    jump: false,
  };

  const TouchKeys = {
    left: false,
    right: false,
    jump: false,
  };

  const touchHoldCount = {
    left: 0,
    right: 0,
    jump: 0,
  };

  const settings = {
    tile: 48,
    gravity: 2250,
    moveAccel: 3200,
    maxSpeed: 380,
    friction: 3200,
    jumpSpeed: 1080,
    jumpHoldGravityScale: 0.70, // hold jump -> higher
    jumpCutGravityScale: 1.45, // release early -> shorter
    coyoteMs: 110,
    jumpBufferMs: 140,
    stompBounce: 640,
  };

  const GROUND_Y = 980;

  /** Small helper for crisp pixels */
  function setupPixelScale() {
    // canvas internal resolution stays fixed; CSS scales it.
    ctx.imageSmoothingEnabled = false;
  }

  const world = {
    w: 3600,
    h: 1200,
    level: 1,
  };

  const camera = {
    x: 0,
    y: 0,
    w: canvas.width,
    h: canvas.height,
  };

  function makeLevel1() {
    const worldW = 3600;
    const worldH = 1200;
    /** @type {{x:number,y:number,w:number,h:number,type:'solid'|'oneway'}} */
    const platforms = [];
    /** @type {{x:number,y:number,r:number,collected:boolean}} */
    const coins = [];
    /** @type {{x:number,y:number,w:number,h:number,dir:number,vx:number,alive:boolean,stompedMs:number}} */
    const enemies = [];

    // Ground
    platforms.push({ x: 0, y: GROUND_Y, w: worldW, h: 220, type: "solid" });

    // Blocks / platforms
    platforms.push({ x: 260, y: 820, w: 360, h: 34, type: "solid" });
    platforms.push({ x: 720, y: 740, w: 290, h: 34, type: "solid" });
    platforms.push({ x: 1120, y: 650, w: 360, h: 34, type: "solid" });
    platforms.push({ x: 1660, y: 780, w: 420, h: 34, type: "solid" });
    platforms.push({ x: 2190, y: 700, w: 330, h: 34, type: "solid" });
    platforms.push({ x: 2650, y: 820, w: 320, h: 34, type: "solid" });
    platforms.push({ x: 3100, y: 720, w: 330, h: 34, type: "solid" });

    // Oneway clouds-ish
    platforms.push({ x: 520, y: 620, w: 220, h: 18, type: "oneway" });
    platforms.push({ x: 2060, y: 560, w: 260, h: 18, type: "oneway" });

    // Coins
    const coinPositions = [
      [330, 770],
      [390, 770],
      [450, 770],
      [820, 690],
      [900, 690],
      [1200, 600],
      [1280, 600],
      [1750, 730],
      [1830, 730],
      [2270, 650],
      [2360, 650],
      [2720, 770],
      [2800, 770],
      [3180, 670],
      [3260, 670],
      [3340, 670],
    ];
    for (const [x, y] of coinPositions) coins.push({ x, y, r: 12, collected: false });

    // Enemies (patrol)
    // Keep early area friendlier: first enemy patrols away from spawn.
    enemies.push({ x: 1220, y: GROUND_Y - 40, w: 46, h: 40, dir: 1, vx: 85, alive: true, stompedMs: 0 });
    enemies.push({ x: 1500, y: GROUND_Y - 40, w: 46, h: 40, dir: 1, vx: 90, alive: true, stompedMs: 0 });
    enemies.push({ x: 2400, y: GROUND_Y - 40, w: 46, h: 40, dir: 1, vx: 110, alive: true, stompedMs: 0 });
    enemies.push({ x: 3180, y: 720 - 40, w: 46, h: 40, dir: -1, vx: 95, alive: true, stompedMs: 0 });

    const goal = { x: worldW - 220, y: 790, w: 28, h: 190 };

    const spawn = { x: 140, y: GROUND_Y - player.h };
    return { worldW, worldH, spawn, platforms, coins, enemies, goal };
  }

  function makeLevel2() {
    const worldW = 4200;
    const worldH = 1200;
    const platforms = [];
    const coins = [];
    const enemies = [];

    platforms.push({ x: 0, y: GROUND_Y, w: worldW, h: 220, type: "solid" });

    // Staircase + gaps
    platforms.push({ x: 340, y: 860, w: 240, h: 34, type: "solid" });
    platforms.push({ x: 660, y: 780, w: 240, h: 34, type: "solid" });
    platforms.push({ x: 980, y: 700, w: 260, h: 34, type: "solid" });
    platforms.push({ x: 1320, y: 620, w: 280, h: 34, type: "solid" });

    // long mid platform
    platforms.push({ x: 1780, y: 760, w: 520, h: 34, type: "solid" });
    platforms.push({ x: 2440, y: 680, w: 380, h: 34, type: "solid" });
    platforms.push({ x: 2940, y: 600, w: 320, h: 34, type: "solid" });

    // oneway "cloud bridge"
    platforms.push({ x: 2140, y: 560, w: 320, h: 18, type: "oneway" });
    platforms.push({ x: 2540, y: 520, w: 320, h: 18, type: "oneway" });
    platforms.push({ x: 2940, y: 480, w: 320, h: 18, type: "oneway" });

    // end area
    platforms.push({ x: 3380, y: 740, w: 420, h: 34, type: "solid" });
    platforms.push({ x: 3820, y: 660, w: 260, h: 34, type: "solid" });

    const coinPositions = [
      [430, 810],
      [510, 810],
      [750, 730],
      [830, 730],
      [1060, 650],
      [1140, 650],
      [1400, 570],
      [1480, 570],
      [1920, 710],
      [2000, 710],
      [2600, 630],
      [2680, 630],
      [3040, 550],
      [3120, 550],
      [2220, 510],
      [2620, 470],
      [3020, 430],
      [3500, 690],
      [3580, 690],
      [3920, 610],
      [4000, 610],
    ];
    for (const [x, y] of coinPositions) coins.push({ x, y, r: 12, collected: false });

    enemies.push({ x: 920, y: GROUND_Y - 40, w: 46, h: 40, dir: 1, vx: 110, alive: true, stompedMs: 0 });
    enemies.push({ x: 1900, y: 760 - 40, w: 46, h: 40, dir: -1, vx: 90, alive: true, stompedMs: 0 });
    enemies.push({ x: 2620, y: 680 - 40, w: 46, h: 40, dir: 1, vx: 110, alive: true, stompedMs: 0 });
    enemies.push({ x: 3500, y: 740 - 40, w: 46, h: 40, dir: -1, vx: 95, alive: true, stompedMs: 0 });

    const goal = { x: worldW - 220, y: 790, w: 28, h: 190 };
    const spawn = { x: 140, y: GROUND_Y - player.h };
    return { worldW, worldH, spawn, platforms, coins, enemies, goal };
  }

  function makeLevel3() {
    const worldW = 5200;
    const worldH = 1200;
    const platforms = [];
    const coins = [];
    const enemies = [];

    platforms.push({ x: 0, y: GROUND_Y, w: worldW, h: 220, type: "solid" });

    // tighter platforming
    platforms.push({ x: 280, y: 820, w: 260, h: 34, type: "solid" });
    platforms.push({ x: 620, y: 720, w: 240, h: 34, type: "solid" });
    platforms.push({ x: 960, y: 640, w: 240, h: 34, type: "solid" });
    platforms.push({ x: 1300, y: 560, w: 260, h: 34, type: "solid" });

    // suspended oneway chain
    platforms.push({ x: 1760, y: 520, w: 240, h: 18, type: "oneway" });
    platforms.push({ x: 2080, y: 480, w: 240, h: 18, type: "oneway" });
    platforms.push({ x: 2400, y: 440, w: 240, h: 18, type: "oneway" });
    platforms.push({ x: 2720, y: 400, w: 240, h: 18, type: "oneway" });

    // recovery platforms
    platforms.push({ x: 3080, y: 760, w: 520, h: 34, type: "solid" });
    platforms.push({ x: 3720, y: 680, w: 420, h: 34, type: "solid" });
    platforms.push({ x: 4220, y: 600, w: 420, h: 34, type: "solid" });
    platforms.push({ x: 4760, y: 740, w: 260, h: 34, type: "solid" });

    const coinPositions = [
      [360, 770],
      [440, 770],
      [700, 670],
      [780, 670],
      [1040, 590],
      [1120, 590],
      [1380, 510],
      [1460, 510],
      [1860, 470],
      [2180, 430],
      [2500, 390],
      [2820, 350],
      [3200, 710],
      [3280, 710],
      [3900, 630],
      [3980, 630],
      [4400, 550],
      [4480, 550],
      [4860, 690],
      [4940, 690],
    ];
    for (const [x, y] of coinPositions) coins.push({ x, y, r: 12, collected: false });

    enemies.push({ x: 760, y: 720 - 40, w: 46, h: 40, dir: 1, vx: 115, alive: true, stompedMs: 0 });
    enemies.push({ x: 1120, y: 640 - 40, w: 46, h: 40, dir: -1, vx: 95, alive: true, stompedMs: 0 });
    enemies.push({ x: 1960, y: 480 - 40, w: 46, h: 40, dir: 1, vx: 105, alive: true, stompedMs: 0 });
    enemies.push({ x: 3320, y: 760 - 40, w: 46, h: 40, dir: -1, vx: 120, alive: true, stompedMs: 0 });
    enemies.push({ x: 4380, y: 600 - 40, w: 46, h: 40, dir: 1, vx: 115, alive: true, stompedMs: 0 });

    const goal = { x: worldW - 220, y: 790, w: 28, h: 190 };
    const spawn = { x: 140, y: GROUND_Y - player.h };
    return { worldW, worldH, spawn, platforms, coins, enemies, goal };
  }

  function makeLevel4() {
    const worldW = 5200;
    const worldH = 1200;
    const platforms = [];
    const coins = [];
    const enemies = [];

    platforms.push({ x: 0, y: GROUND_Y, w: worldW, h: 220, type: "solid" });

    // alternating mid-height platforms
    const blocks = [
      [360, 820, 320],
      [820, 680, 320],
      [1260, 820, 320],
      [1720, 680, 320],
      [2160, 820, 320],
      [2620, 680, 320],
      [3060, 820, 320],
      [3520, 680, 320],
      [3960, 820, 360],
      [4440, 700, 380],
    ];
    for (const [x, y, w] of blocks) platforms.push({ x, y, w, h: 34, type: "solid" });

    // oneway "clouds" above some blocks
    platforms.push({ x: 980, y: 560, w: 260, h: 18, type: "oneway" });
    platforms.push({ x: 2340, y: 560, w: 260, h: 18, type: "oneway" });
    platforms.push({ x: 3820, y: 560, w: 300, h: 18, type: "oneway" });

    const coinPositions = [];
    for (const [x, y, w] of blocks) {
      coinPositions.push([x + w / 2 - 40, y - 50]);
      coinPositions.push([x + w / 2, y - 60]);
      coinPositions.push([x + w / 2 + 40, y - 50]);
    }
    for (const [x, y] of coinPositions) coins.push({ x, y, r: 12, collected: false });

    enemies.push({ x: 980, y: 680 - 40, w: 46, h: 40, dir: 1, vx: 115, alive: true, stompedMs: 0 });
    enemies.push({ x: 1780, y: 680 - 40, w: 46, h: 40, dir: -1, vx: 105, alive: true, stompedMs: 0 });
    enemies.push({ x: 2700, y: 680 - 40, w: 46, h: 40, dir: 1, vx: 120, alive: true, stompedMs: 0 });
    enemies.push({ x: 3600, y: 680 - 40, w: 46, h: 40, dir: -1, vx: 110, alive: true, stompedMs: 0 });
    enemies.push({ x: 4520, y: 700 - 40, w: 46, h: 40, dir: 1, vx: 125, alive: true, stompedMs: 0 });

    const goal = { x: worldW - 220, y: 790, w: 28, h: 190 };
    const spawn = { x: 140, y: GROUND_Y - player.h };
    return { worldW, worldH, spawn, platforms, coins, enemies, goal };
  }

  function makeLevel5() {
    const worldW = 5600;
    const worldH = 1200;
    const platforms = [];
    const coins = [];
    const enemies = [];

    platforms.push({ x: 0, y: GROUND_Y, w: worldW, h: 220, type: "solid" });

    // "river" of short platforms
    for (let i = 0; i < 14; i++) {
      const x = 360 + i * 340;
      const y = (i % 2 === 0) ? 820 : 760;
      platforms.push({ x, y, w: 220, h: 34, type: "solid" });
      coins.push({ x: x + 60, y: y - 56, r: 12, collected: false });
      coins.push({ x: x + 120, y: y - 70, r: 12, collected: false });
      coins.push({ x: x + 180, y: y - 56, r: 12, collected: false });
    }

    // extra high oneway
    for (let i = 0; i < 5; i++) {
      const x = 1240 + i * 820;
      platforms.push({ x, y: 540, w: 280, h: 18, type: "oneway" });
      coins.push({ x: x + 60, y: 500, r: 12, collected: false });
      coins.push({ x: x + 140, y: 470, r: 12, collected: false });
      coins.push({ x: x + 220, y: 500, r: 12, collected: false });
    }

    // enemy parade (avoid spawn)
    for (let i = 0; i < 9; i++) {
      const x = 920 + i * 540;
      enemies.push({ x, y: GROUND_Y - 40, w: 46, h: 40, dir: i % 2 ? -1 : 1, vx: 120, alive: true, stompedMs: 0 });
    }

    const goal = { x: worldW - 220, y: 790, w: 28, h: 190 };
    const spawn = { x: 140, y: GROUND_Y - player.h };
    return { worldW, worldH, spawn, platforms, coins, enemies, goal };
  }

  function makeLevel6() {
    const worldW = 4800;
    const worldH = 1200;
    const platforms = [];
    const coins = [];
    const enemies = [];

    platforms.push({ x: 0, y: GROUND_Y, w: worldW, h: 220, type: "solid" });

    // vertical climb with small ledges
    const ledges = [
      [420, 840],
      [760, 740],
      [1100, 640],
      [1460, 560],
      [1820, 480],
      [2180, 560],
      [2540, 640],
      [2900, 560],
      [3260, 480],
      [3620, 560],
      [3980, 640],
      [4320, 740],
    ];
    for (const [x, y] of ledges) {
      platforms.push({ x, y, w: 180, h: 34, type: "solid" });
      coins.push({ x: x + 40, y: y - 58, r: 12, collected: false });
      coins.push({ x: x + 90, y: y - 72, r: 12, collected: false });
      coins.push({ x: x + 140, y: y - 58, r: 12, collected: false });
    }

    // occasional oneway safety
    platforms.push({ x: 2060, y: 700, w: 260, h: 18, type: "oneway" });
    platforms.push({ x: 3180, y: 700, w: 260, h: 18, type: "oneway" });

    enemies.push({ x: 770, y: 740 - 40, w: 46, h: 40, dir: 1, vx: 95, alive: true, stompedMs: 0 });
    enemies.push({ x: 2180, y: 560 - 40, w: 46, h: 40, dir: -1, vx: 110, alive: true, stompedMs: 0 });
    enemies.push({ x: 3620, y: 560 - 40, w: 46, h: 40, dir: 1, vx: 120, alive: true, stompedMs: 0 });

    const goal = { x: worldW - 220, y: 790, w: 28, h: 190 };
    const spawn = { x: 140, y: GROUND_Y - player.h };
    return { worldW, worldH, spawn, platforms, coins, enemies, goal };
  }

  function makeLevel7() {
    const worldW = 6000;
    const worldH = 1200;
    const platforms = [];
    const coins = [];
    const enemies = [];

    platforms.push({ x: 0, y: GROUND_Y, w: worldW, h: 220, type: "solid" });

    // long oneway bridges
    for (let i = 0; i < 10; i++) {
      const x = 420 + i * 520;
      const y = 560 + (i % 3) * 40;
      platforms.push({ x, y, w: 360, h: 18, type: "oneway" });
      coins.push({ x: x + 90, y: y - 42, r: 12, collected: false });
      coins.push({ x: x + 180, y: y - 56, r: 12, collected: false });
      coins.push({ x: x + 270, y: y - 42, r: 12, collected: false });
    }

    // ground checkpoints
    platforms.push({ x: 1200, y: 820, w: 520, h: 34, type: "solid" });
    platforms.push({ x: 2920, y: 820, w: 520, h: 34, type: "solid" });
    platforms.push({ x: 4640, y: 820, w: 520, h: 34, type: "solid" });

    // enemies mostly on ground so bridges are playable
    for (let i = 0; i < 8; i++) {
      const x = 980 + i * 620;
      enemies.push({ x, y: GROUND_Y - 40, w: 46, h: 40, dir: i % 2 ? -1 : 1, vx: 130, alive: true, stompedMs: 0 });
    }

    const goal = { x: worldW - 220, y: 790, w: 28, h: 190 };
    const spawn = { x: 140, y: GROUND_Y - player.h };
    return { worldW, worldH, spawn, platforms, coins, enemies, goal };
  }

  function makeLevel8() {
    const worldW = 5400;
    const worldH = 1200;
    const platforms = [];
    const coins = [];
    const enemies = [];

    platforms.push({ x: 0, y: GROUND_Y, w: worldW, h: 220, type: "solid" });

    // zigzag solids
    for (let i = 0; i < 12; i++) {
      const x = 360 + i * 380;
      const y = (i % 2 === 0) ? 700 : 820;
      platforms.push({ x, y, w: 300, h: 34, type: "solid" });
      coins.push({ x: x + 90, y: y - 56, r: 12, collected: false });
      coins.push({ x: x + 150, y: y - 72, r: 12, collected: false });
      coins.push({ x: x + 210, y: y - 56, r: 12, collected: false });
    }

    // a few oneway shortcuts
    platforms.push({ x: 1560, y: 580, w: 260, h: 18, type: "oneway" });
    platforms.push({ x: 2960, y: 580, w: 260, h: 18, type: "oneway" });
    platforms.push({ x: 4360, y: 580, w: 260, h: 18, type: "oneway" });

    enemies.push({ x: 1220, y: 700 - 40, w: 46, h: 40, dir: 1, vx: 120, alive: true, stompedMs: 0 });
    enemies.push({ x: 2360, y: 820 - 40, w: 46, h: 40, dir: -1, vx: 110, alive: true, stompedMs: 0 });
    enemies.push({ x: 3520, y: 700 - 40, w: 46, h: 40, dir: 1, vx: 125, alive: true, stompedMs: 0 });
    enemies.push({ x: 4660, y: 820 - 40, w: 46, h: 40, dir: -1, vx: 115, alive: true, stompedMs: 0 });

    const goal = { x: worldW - 220, y: 790, w: 28, h: 190 };
    const spawn = { x: 140, y: GROUND_Y - player.h };
    return { worldW, worldH, spawn, platforms, coins, enemies, goal };
  }

  function makeLevel9() {
    const worldW = 4600;
    const worldH = 1200;
    const platforms = [];
    const coins = [];
    const enemies = [];

    platforms.push({ x: 0, y: GROUND_Y, w: worldW, h: 220, type: "solid" });

    // big bonus room style platforms
    platforms.push({ x: 480, y: 820, w: 520, h: 34, type: "solid" });
    platforms.push({ x: 1180, y: 700, w: 520, h: 34, type: "solid" });
    platforms.push({ x: 1880, y: 580, w: 520, h: 34, type: "solid" });
    platforms.push({ x: 2580, y: 700, w: 520, h: 34, type: "solid" });
    platforms.push({ x: 3280, y: 820, w: 520, h: 34, type: "solid" });

    // coin arcs
    for (let i = 0; i < 28; i++) {
      const x = 520 + i * 130;
      const phase = (i % 7) / 7;
      const y = 520 + Math.sin(phase * Math.PI) * 150;
      coins.push({ x, y, r: 12, collected: false });
    }

    // fewer enemies for a "reward" level
    enemies.push({ x: 1320, y: 700 - 40, w: 46, h: 40, dir: 1, vx: 105, alive: true, stompedMs: 0 });
    enemies.push({ x: 2700, y: 700 - 40, w: 46, h: 40, dir: -1, vx: 105, alive: true, stompedMs: 0 });

    const goal = { x: worldW - 220, y: 790, w: 28, h: 190 };
    const spawn = { x: 140, y: GROUND_Y - player.h };
    return { worldW, worldH, spawn, platforms, coins, enemies, goal };
  }

  function makeLevel10() {
    const worldW = 6800;
    const worldH = 1200;
    const platforms = [];
    const coins = [];
    const enemies = [];

    platforms.push({ x: 0, y: GROUND_Y, w: worldW, h: 220, type: "solid" });

    // final gauntlet: mixed heights + some oneway
    for (let i = 0; i < 16; i++) {
      const x = 420 + i * 380;
      const y = (i % 4 === 0) ? 820 : (i % 4 === 1) ? 720 : (i % 4 === 2) ? 620 : 760;
      platforms.push({ x, y, w: 280, h: 34, type: "solid" });
      coins.push({ x: x + 80, y: y - 56, r: 12, collected: false });
      coins.push({ x: x + 140, y: y - 72, r: 12, collected: false });
      coins.push({ x: x + 200, y: y - 56, r: 12, collected: false });
    }

    platforms.push({ x: 1680, y: 520, w: 320, h: 18, type: "oneway" });
    platforms.push({ x: 3160, y: 520, w: 320, h: 18, type: "oneway" });
    platforms.push({ x: 4640, y: 520, w: 320, h: 18, type: "oneway" });
    platforms.push({ x: 6120, y: 520, w: 320, h: 18, type: "oneway" });

    // many enemies, but spaced away from spawn
    for (let i = 0; i < 12; i++) {
      const x = 920 + i * 520;
      const y = (i % 3 === 0) ? (720 - 40) : (GROUND_Y - 40);
      enemies.push({ x, y, w: 46, h: 40, dir: i % 2 ? -1 : 1, vx: 135, alive: true, stompedMs: 0 });
    }

    const goal = { x: worldW - 220, y: 790, w: 28, h: 190 };
    const spawn = { x: 140, y: GROUND_Y - player.h };
    return { worldW, worldH, spawn, platforms, coins, enemies, goal };
  }

  const LEVELS = [
    makeLevel1,
    makeLevel2,
    makeLevel3,
    makeLevel4,
    makeLevel5,
    makeLevel6,
    makeLevel7,
    makeLevel8,
    makeLevel9,
    makeLevel10,
  ];
  let levelIndex = 0;

  const player = {
    x: 140,
    y: GROUND_Y - 52,
    w: 46,
    h: 52,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    coyoteLeft: 0,
    jumpBufferLeft: 0,
    jumpHeld: false,
    jumpConsumed: false,
    invulnLeft: 0,
  };

  const state = {
    running: false,
    paused: false,
    coins: 0,
    lives: 3,
    win: false,
    lose: false,
    debug: false,
    lastHurtReason: "",
    lastHurtAt: -1,
    time: 0,
    lastTs: 0,
  };

  let level = makeLevel1();
  let activeRunId = 0;

  function loadLevel(idx) {
    levelIndex = Math.floor(clamp(idx, 0, LEVELS.length - 1));
    const data = LEVELS[levelIndex]();
    world.w = data.worldW;
    world.h = data.worldH;
    world.level = levelIndex + 1;
    level = data;

    player.x = data.spawn.x;
    player.y = data.spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
    player.facing = 1;
    player.coyoteLeft = settings.coyoteMs / 1000;
    player.jumpBufferLeft = 0;
    player.jumpHeld = false;
    player.jumpConsumed = false;
    player.invulnLeft = 0;
  }

  function resetLevel({ keepStats = true, toLevelIndex = levelIndex } = {}) {
    if (!keepStats) {
      state.coins = 0;
      state.lives = 3;
    }
    loadLevel(toLevelIndex);

    state.win = false;
    state.lose = false;
    state.paused = false;
    state.time = 0;
    state.lastTs = 0;

    uiCoins.textContent = String(state.coins);
    uiLives.textContent = String(state.lives);
    uiLevel.textContent = String(world.level);
  }

  function clearKeys() {
    Keys.left = false;
    Keys.right = false;
    Keys.up = false;
    Keys.jump = false;
    player.jumpHeld = false;
    player.jumpConsumed = false;
  }

  function clearTouch() {
    TouchKeys.left = false;
    TouchKeys.right = false;
    TouchKeys.jump = false;
    touchHoldCount.left = 0;
    touchHoldCount.right = 0;
    touchHoldCount.jump = 0;
  }

  function startLoop() {
    help.hidden = true;
    clearKeys();
    clearTouch();
    state.running = true;
    state.paused = false;
    state.lastTs = 0;
    const runId = ++activeRunId;
    const frame = (ts) => loop(ts, runId, frame);
    requestAnimationFrame(frame);
  }

  function startGame() {
    if (state.running) return;
    resetLevel({ keepStats: false, toLevelIndex: 0 });
    // Prevent stacking multiple RAF loops from repeated "start" clicks/keys.
    startLoop();
  }

  startBtn.addEventListener("click", startGame);

  function setTouchHeld(action, held) {
    if (!(action in touchHoldCount)) return;
    touchHoldCount[action] = clamp(touchHoldCount[action] + (held ? 1 : -1), 0, 99);
    TouchKeys.left = touchHoldCount.left > 0;
    TouchKeys.right = touchHoldCount.right > 0;
    TouchKeys.jump = touchHoldCount.jump > 0;
  }

  function initTouchControls() {
    if (!touchEl) return;
    const btns = [...touchEl.querySelectorAll("[data-action]")];
    if (btns.length === 0) return;

    /** @type {Map<number, string>} */
    const pointers = new Map();

    const onDown = (e) => {
      const t = /** @type {HTMLElement} */ (e.currentTarget);
      const action = t.dataset.action;
      if (!action) return;
      e.preventDefault();
      pointers.set(e.pointerId, action);
      setTouchHeld(action, true);
      if (action === "jump") onJumpPressed();
      t.setPointerCapture?.(e.pointerId);
    };

    const onUp = (e) => {
      const action = pointers.get(e.pointerId);
      if (!action) return;
      e.preventDefault();
      pointers.delete(e.pointerId);
      setTouchHeld(action, false);
      if (action === "jump") {
        player.jumpHeld = false;
        player.jumpConsumed = false;
      }
    };

    for (const b of btns) {
      b.addEventListener("pointerdown", onDown, { passive: false });
      b.addEventListener("pointerup", onUp, { passive: false });
      b.addEventListener("pointercancel", onUp, { passive: false });
      b.addEventListener("pointerleave", onUp, { passive: false });
    }
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "ArrowLeft") Keys.left = true;
    if (e.code === "ArrowRight") Keys.right = true;
    if (e.code === "ArrowUp") {
      Keys.up = true;
      onJumpPressed();
    }
    if (e.code === "Space") {
      Keys.jump = true;
      onJumpPressed();
    }

    if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(e.code)) {
      e.preventDefault();
    }

    if (e.code === "KeyR") {
      resetLevel({ keepStats: false, toLevelIndex: 0 });
      clearKeys();
      startLoop();
    }
    if (e.code === "KeyP") {
      state.paused = !state.paused;
    }
    if (e.code === "KeyD") {
      state.debug = !state.debug;
    }
    // Debug convenience: Shift+N skip to next level (only when debug enabled)
    if (e.code === "KeyN" && e.shiftKey && state.debug) {
      const next = (levelIndex + 1) % LEVELS.length;
      resetLevel({ keepStats: true, toLevelIndex: next });
      clearKeys();
      startLoop();
    }
    if (e.code === "KeyN" && state.win) {
      if (levelIndex + 1 < LEVELS.length) {
        resetLevel({ keepStats: true, toLevelIndex: levelIndex + 1 });
        clearKeys();
        startLoop();
      } else {
        // all cleared -> restart at level 1 with stats kept (like looped world)
        resetLevel({ keepStats: true, toLevelIndex: 0 });
        clearKeys();
        startLoop();
      }
    }
    if (!help.hidden && (e.code === "Enter" || e.code === "NumpadEnter")) {
      startGame();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft") Keys.left = false;
    if (e.code === "ArrowRight") Keys.right = false;
    if (e.code === "ArrowUp") Keys.up = false;
    if (e.code === "Space") Keys.jump = false;
    if (!Keys.up && !Keys.jump && !TouchKeys.jump) {
      player.jumpHeld = false;
      player.jumpConsumed = false;
    }
  });

  window.addEventListener("blur", () => {
    clearKeys();
    clearTouch();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearKeys();
      clearTouch();
    }
  });

  function pushJumpBuffer(ms) {
    player.jumpBufferLeft = Math.max(player.jumpBufferLeft, ms);
  }

  function doJump() {
    player.vy = -settings.jumpSpeed;
    player.onGround = false;
    player.coyoteLeft = 0;
    player.jumpBufferLeft = 0;
  }

  function tryConsumeJump() {
    if (player.jumpConsumed) return;
    if (player.jumpBufferLeft <= 0) return;
    if (!(player.onGround || player.coyoteLeft > 0)) return;
    doJump();
    player.jumpConsumed = true;
  }

  function onJumpPressed() {
    // keydown can happen between frames; keep buffer here so taps never get lost.
    pushJumpBuffer(settings.jumpBufferMs / 1000);
    if (!player.jumpHeld) player.jumpHeld = true;
    tryConsumeJump();
  }

  /** Collision move (axis-separated) with solids + one-way platforms */
  function moveAndCollide(dt) {
    // X axis
    player.x += player.vx * dt;
    const pbx = { x: player.x, y: player.y, w: player.w, h: player.h };
    for (const p of level.platforms) {
      if (p.type !== "solid") continue;
      if (!aabb(pbx, p)) continue;
      if (player.vx > 0) player.x = p.x - player.w;
      else if (player.vx < 0) player.x = p.x + p.w;
      player.vx = 0;
      pbx.x = player.x;
    }

    // Y axis
    player.y += player.vy * dt;
    const pby = { x: player.x, y: player.y, w: player.w, h: player.h };
    player.onGround = false;

    for (const p of level.platforms) {
      if (!aabb(pby, p)) continue;

      if (p.type === "oneway") {
        // Only collide when falling onto top
        const prevBottom = player.y - player.vy * dt + player.h;
        const nowBottom = player.y + player.h;
        const top = p.y;
        const withinX = player.x + player.w > p.x && player.x < p.x + p.w;
        if (withinX && player.vy >= 0 && prevBottom <= top && nowBottom >= top) {
          player.y = p.y - player.h;
          player.vy = 0;
          player.onGround = true;
          pby.y = player.y;
        }
        continue;
      }

      // solid
      if (player.vy > 0) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.onGround = true;
        pby.y = player.y;
      } else if (player.vy < 0) {
        player.y = p.y + p.h;
        player.vy = 0;
        pby.y = player.y;
      }
    }

    // World bounds
    player.x = clamp(player.x, 0, world.w - player.w);
    if (player.y > world.h + 200) {
      // fell off
      hurt("fell");
    }
  }

  function updateCamera(dt) {
    const targetX = player.x + player.w / 2 - camera.w / 2;
    const targetY = player.y + player.h / 2 - camera.h / 2;
    camera.x += (targetX - camera.x) * (1 - Math.pow(0.0005, dt * 1000));
    camera.y += (targetY - camera.y) * (1 - Math.pow(0.0005, dt * 1000));

    camera.x = clamp(camera.x, 0, world.w - camera.w);
    camera.y = clamp(camera.y, 0, world.h - camera.h);
  }

  function collectCoins() {
    const pr = { x: player.x, y: player.y, w: player.w, h: player.h };
    for (const c of level.coins) {
      if (c.collected) continue;
      const cr = { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 };
      if (aabb(pr, cr)) {
        c.collected = true;
        state.coins += 1;
        uiCoins.textContent = String(state.coins);
      }
    }
  }

  function updateEnemies(dt) {
    for (const e of level.enemies) {
      if (!e.alive) continue;

      // Patrol horizontally; simple platform/edge logic
      e.x += e.dir * e.vx * dt;

      // Turn around at world bounds
      if (e.x < 0) {
        e.x = 0;
        e.dir = 1;
      }
      if (e.x + e.w > world.w) {
        e.x = world.w - e.w;
        e.dir = -1;
      }

      // Turn around if colliding with solid platform side
      const er = { x: e.x, y: e.y, w: e.w, h: e.h };
      for (const p of level.platforms) {
        if (p.type !== "solid") continue;
        if (!aabb(er, p)) continue;
        if (e.dir > 0) e.x = p.x - e.w;
        else e.x = p.x + p.w;
        e.dir *= -1;
        er.x = e.x;
      }

      // Edge detect: check tile under front foot using "ground" platform only (solid at y>=980)
      const footX = e.dir > 0 ? e.x + e.w + 6 : e.x - 6;
      const footY = e.y + e.h + 2;
      let supported = false;
      for (const p of level.platforms) {
        if (p.type !== "solid" && p.type !== "oneway") continue;
        if (footX >= p.x && footX <= p.x + p.w && footY >= p.y && footY <= p.y + p.h + 6) {
          supported = true;
          break;
        }
      }
      if (!supported) e.dir *= -1;
    }
  }

  function stompOrHurtEnemy() {
    if (player.invulnLeft > 0) return;
    const pr = { x: player.x, y: player.y, w: player.w, h: player.h };

    for (const e of level.enemies) {
      if (!e.alive) continue;
      const er = { x: e.x, y: e.y, w: e.w, h: e.h };
      if (!aabb(pr, er)) continue;

      // Determine if player is coming from above (stomp)
      const playerBottom = player.y + player.h;
      const enemyTop = e.y;
      const vy = player.vy;

      const stomp = vy > 120 && playerBottom - enemyTop < 22;
      if (stomp) {
        e.alive = false;
        e.stompedMs = 0;
        player.vy = -settings.stompBounce;
        state.coins += 2; // reward
        uiCoins.textContent = String(state.coins);
      } else {
        hurt("enemy");
      }
    }
  }

  function hurt(reason) {
    if (player.invulnLeft > 0) return;
    state.lives -= 1;
    uiLives.textContent = String(state.lives);
    player.invulnLeft = 1.2;
    state.lastHurtReason = String(reason || "unknown");
    state.lastHurtAt = state.time;
    // knockback
    player.vx = -player.facing * 280;
    player.vy = -560;
    if (state.lives <= 0) {
      state.lose = true;
      state.paused = true;
    } else {
      // soft reset position if fell too far
      if (player.y > world.h) {
        player.x = 140;
        player.y = GROUND_Y - player.h;
        player.vx = 0;
        player.vy = 0;
        player.onGround = true;
        player.coyoteLeft = settings.coyoteMs / 1000;
      }
    }
  }

  function checkGoal() {
    const pr = { x: player.x, y: player.y, w: player.w, h: player.h };
    if (aabb(pr, level.goal)) {
      state.win = true;
      state.paused = true;
    }
  }

  function update(dt) {
    state.time += dt;

    if (player.invulnLeft > 0) player.invulnLeft = Math.max(0, player.invulnLeft - dt);

    // Jump buffer & coyote time
    if (player.onGround) player.coyoteLeft = settings.coyoteMs / 1000;
    else player.coyoteLeft = Math.max(0, player.coyoteLeft - dt);

    if (player.jumpBufferLeft > 0) player.jumpBufferLeft = Math.max(0, player.jumpBufferLeft - dt);

    // Horizontal accel
    const wantLeft = Keys.left || TouchKeys.left;
    const wantRight = Keys.right || TouchKeys.right;
    const wantJumpHold = Keys.up || Keys.jump || TouchKeys.jump;
    const input = (wantRight ? 1 : 0) - (wantLeft ? 1 : 0);
    if (input !== 0) {
      player.facing = input;
      player.vx += input * settings.moveAccel * dt;
    } else {
      // friction
      const f = settings.friction * dt;
      if (player.vx > 0) player.vx = Math.max(0, player.vx - f);
      else if (player.vx < 0) player.vx = Math.min(0, player.vx + f);
    }
    player.vx = clamp(player.vx, -settings.maxSpeed, settings.maxSpeed);

    // Jump trigger (buffered)
    tryConsumeJump();

    // Gravity with variable jump height:
    // - hold jump while rising -> reduced gravity -> higher
    // - release early while rising -> increased gravity -> shorter
    let g = settings.gravity;
    if (player.vy < 0) {
      g *= wantJumpHold ? settings.jumpHoldGravityScale : settings.jumpCutGravityScale;
    }
    player.vy += g * dt;
    player.vy = Math.min(player.vy, 1800);

    moveAndCollide(dt);

    updateEnemies(dt);
    collectCoins();
    stompOrHurtEnemy();
    checkGoal();
    updateCamera(dt);
  }

  // --- Rendering ---

  function drawBackground() {
    // Parallax hills
    const sky = { x: 0, y: 0, w: camera.w, h: camera.h };
    ctx.save();
    ctx.translate(0, 0);
    ctx.globalAlpha = 1;
    // Clouds
    for (let i = 0; i < 7; i++) {
      const cx = (i * 220 + (state.time * 24) % 2200) - 250;
      const cy = 70 + (i % 3) * 30;
      drawCloud(cx, cy);
    }
    // Hills
    for (let i = 0; i < 8; i++) {
      const hx = i * 380 - (camera.x * 0.25) % 380;
      const hy = 360 + (i % 2) * 30;
      drawHill(hx, hy, 220, 120);
    }
    ctx.restore();

    function drawCloud(x, y) {
      ctx.save();
      ctx.translate(x - (camera.x * 0.15), y - (camera.y * 0.05));
      ctx.fillStyle = "rgba(255,255,255,.85)";
      roundRectFill(0, 0, 84, 22, 10);
      roundRectFill(14, -10, 44, 22, 10);
      roundRectFill(46, -6, 46, 22, 10);
      ctx.restore();
    }
    function drawHill(x, y, w, h) {
      ctx.save();
      ctx.translate(x, y - (camera.y * 0.05));
      ctx.fillStyle = "rgba(29,160,76,.35)";
      roundRectFill(0, 0, w, h, 28);
      ctx.fillStyle = "rgba(20,120,58,.22)";
      roundRectFill(16, 18, w - 32, h - 30, 24);
      ctx.restore();
    }
  }

  function roundRectFill(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    ctx.fill();
  }

  function drawPlatforms() {
    for (const p of level.platforms) {
      const x = Math.floor(p.x - camera.x);
      const y = Math.floor(p.y - camera.y);

      if (p.type === "oneway") {
        ctx.fillStyle = "rgba(255,255,255,.75)";
        ctx.fillRect(x, y, p.w, p.h);
        ctx.fillStyle = "rgba(255,255,255,.35)";
        ctx.fillRect(x, y + p.h, p.w, 6);
        continue;
      }

      // Brick-ish
      ctx.fillStyle = "#6b3f23";
      ctx.fillRect(x, y, p.w, p.h);
      ctx.fillStyle = "#8a5430";
      for (let bx = 0; bx < p.w; bx += 48) {
        ctx.fillRect(x + bx + 4, y + 5, 36, 10);
      }
      ctx.fillStyle = "rgba(0,0,0,.12)";
      ctx.fillRect(x, y + p.h - 6, p.w, 6);
    }
  }

  function drawCoins() {
    for (const c of level.coins) {
      if (c.collected) continue;
      const t = state.time * 6 + c.x * 0.01;
      const bob = Math.sin(t) * 3;
      const x = Math.floor(c.x - camera.x);
      const y = Math.floor(c.y - camera.y + bob);
      const r = c.r;

      ctx.save();
      ctx.translate(x, y);
      const squeeze = 0.6 + 0.4 * Math.abs(Math.sin(t));
      ctx.scale(squeeze, 1);
      ctx.fillStyle = "#ffd24a";
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.45)";
      ctx.beginPath();
      ctx.arc(-4, -5, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawGoal() {
    const g = level.goal;
    const x = Math.floor(g.x - camera.x);
    const y = Math.floor(g.y - camera.y);
    // pole
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.fillRect(x, y, g.w, g.h);
    // flag
    ctx.fillStyle = "#ff5f7a";
    ctx.fillRect(x + g.w, y + 24, 92, 44);
    ctx.fillStyle = "rgba(0,0,0,.12)";
    ctx.fillRect(x + g.w, y + 24 + 38, 92, 6);
  }

  function drawEnemy(e) {
    const x = Math.floor(e.x - camera.x);
    const y = Math.floor(e.y - camera.y);
    if (!e.alive) {
      // stomp mark
      ctx.fillStyle = "rgba(0,0,0,.25)";
      ctx.fillRect(x, y + e.h - 12, e.w, 12);
      ctx.fillStyle = "#c23b4a";
      ctx.fillRect(x + 2, y + e.h - 16, e.w - 4, 8);
      return;
    }

    // simple "goomba-like" blob with ears
    ctx.fillStyle = "#7a3d1d";
    ctx.fillRect(x, y + 10, e.w, e.h - 10);
    ctx.fillStyle = "#8e4b27";
    ctx.fillRect(x + 6, y + 4, 12, 12);
    ctx.fillRect(x + e.w - 18, y + 4, 12, 12);
    // face
    ctx.fillStyle = "#f2d0a6";
    ctx.fillRect(x + 10, y + 22, e.w - 20, 16);
    ctx.fillStyle = "#101018";
    ctx.fillRect(x + 14, y + 26, 6, 6);
    ctx.fillRect(x + e.w - 20, y + 26, 6, 6);
    // feet
    ctx.fillStyle = "#3b1c0e";
    ctx.fillRect(x + 6, y + e.h - 8, 14, 8);
    ctx.fillRect(x + e.w - 20, y + e.h - 8, 14, 8);
  }

  function drawPlayer() {
    const x = Math.floor(player.x - camera.x);
    const y = Math.floor(player.y - camera.y);

    const blink = (Math.sin(state.time * 7) > 0.98) ? 1 : 0;
    const inv = player.invulnLeft > 0 ? (Math.sin(state.time * 30) > 0 ? 0.45 : 1) : 1;

    ctx.save();
    ctx.globalAlpha = inv;
    ctx.translate(x, y);

    // shadow
    ctx.fillStyle = "rgba(0,0,0,.14)";
    ctx.fillRect(8, player.h - 6, player.w - 16, 6);

    // body
    ctx.fillStyle = "#f3c06d";
    ctx.fillRect(6, 18, 34, 28);

    // head
    ctx.fillStyle = "#f6d39c";
    ctx.fillRect(8, 6, 30, 18);

    // ears
    ctx.fillStyle = "#c78946";
    ctx.fillRect(6, 6, 8, 14);
    ctx.fillRect(32, 6, 8, 14);

    // eyes
    ctx.fillStyle = "#101018";
    if (!blink) {
      ctx.fillRect(16, 12, 4, 4);
      ctx.fillRect(26, 12, 4, 4);
    } else {
      ctx.fillRect(16, 14, 4, 1);
      ctx.fillRect(26, 14, 4, 1);
    }

    // nose
    ctx.fillStyle = "#2b1b14";
    ctx.fillRect(21, 16, 4, 3);

    // carrot hat
    ctx.fillStyle = "#ff7a2f";
    // bigger carrot for clearer character silhouette
    ctx.fillRect(18, -8, 10, 18);
    ctx.fillStyle = "rgba(0,0,0,.12)";
    ctx.fillRect(18, 6, 10, 4);
    ctx.fillStyle = "#ff9a57";
    ctx.fillRect(20, -6, 6, 2);
    ctx.fillRect(19, -2, 8, 2);
    ctx.fillStyle = "#35d07f";
    ctx.fillRect(16, -8, 4, 7);
    ctx.fillRect(26, -8, 4, 7);
    ctx.fillRect(20, -12, 6, 6);

    // feet (animate)
    const step = Math.abs(player.vx) > 20 && player.onGround ? Math.sin(state.time * 14) : 0;
    ctx.fillStyle = "#a9652a";
    ctx.fillRect(10, 46, 10, 6);
    ctx.fillRect(26, 46, 10, 6);
    if (step > 0.4) ctx.fillRect(28, 44, 10, 6);
    if (step < -0.4) ctx.fillRect(8, 44, 10, 6);

    // facing hint (tiny tail)
    ctx.fillStyle = "#c78946";
    if (player.facing > 0) ctx.fillRect(40, 30, 6, 6);
    else ctx.fillRect(0, 30, 6, 6);

    ctx.restore();
  }

  function drawOverlayText(title, sub) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,.94)";
    ctx.font = "900 40px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 10);
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.font = "700 16px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(sub, canvas.width / 2, canvas.height / 2 + 26);
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();

    ctx.save();
    ctx.translate(-Math.floor(camera.x), -Math.floor(camera.y));
    // draw world-space extras (ground decorations)
    drawDoodads();
    ctx.restore();

    drawPlatforms();
    drawCoins();
    drawGoal();
    for (const e of level.enemies) drawEnemy(e);
    drawPlayer();

    if (state.paused && state.win) {
      if (levelIndex === LEVELS.length - 1) {
        drawOverlayText("全部通关！", "按 N 回到第 1 关（或按 R 重开）");
      } else {
        drawOverlayText("通关！", "按 N 下一关（或按 R 重开）");
      }
    } else if (state.paused && state.lose) {
      drawOverlayText("失败了…", "按 R 重新开始");
    } else if (state.paused) {
      drawOverlayText("暂停", "按 P 继续");
    }

    if (state.debug) drawDebug();
  }

  function drawDebug() {
    const e0 = level.enemies[0];
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(12, 12, 420, 96);
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    ctx.textAlign = "left";
    ctx.fillText(`runId=${activeRunId} paused=${state.paused} lives=${state.lives} inv=${player.invulnLeft.toFixed(2)}`, 18, 32);
    ctx.fillText(`player x=${player.x.toFixed(1)} y=${player.y.toFixed(1)} vx=${player.vx.toFixed(1)} vy=${player.vy.toFixed(1)} g=${player.onGround}`, 18, 50);
    if (e0) ctx.fillText(`enemy0 x=${e0.x.toFixed(1)} y=${e0.y.toFixed(1)} dir=${e0.dir} alive=${e0.alive}`, 18, 68);
    const hurtInfo = state.lastHurtAt >= 0 ? `${state.lastHurtReason}@${state.lastHurtAt.toFixed(2)}s` : "none";
    ctx.fillText(`cam x=${camera.x.toFixed(1)} y=${camera.y.toFixed(1)} t=${state.time.toFixed(2)} hurt=${hurtInfo}`, 18, 86);
    ctx.restore();
  }

  function drawDoodads() {
    // draw little bushes along the ground for flavor
    for (let i = 0; i < 36; i++) {
      const bx = i * 110 + 40;
      const by = 940 + (i % 2) * 6;
      ctx.fillStyle = "rgba(18,110,55,.45)";
      roundRectFill(bx, by, 60, 22, 12);
      ctx.fillStyle = "rgba(20,140,65,.35)";
      roundRectFill(bx + 10, by - 10, 40, 18, 10);
    }
  }

  function loop(ts, runId, frame) {
    if (!state.running) return;
    if (runId !== activeRunId) return;

    if (!state.lastTs) state.lastTs = ts;
    const rawDt = (ts - state.lastTs) / 1000;
    state.lastTs = ts;

    // clamp dt to avoid big step on tab switch
    const dt = clamp(rawDt, 0, 1 / 30);

    if (!state.paused) {
      update(dt);
    }
    render();
    requestAnimationFrame(frame);
  }

  // Init
  setupPixelScale();
  resetLevel({ keepStats: false, toLevelIndex: 0 });
  initTouchControls();
})();

