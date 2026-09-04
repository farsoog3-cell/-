export const soundFiles = {
    menuBgm: 'sounds/menu_bgm.mp3',
    battleBgm: 'sounds/battle_bgm.mp3',
    click: 'sounds/click.mp3',
    attack: 'sounds/attack.mp3',
    danger: 'sounds/danger.mp3',
    victory: 'sounds/victory_sound.mp3',
    defeat: 'sounds/defeat_sound.mp3',
    shoot: 'sounds/shoot.mp3',
    rocket: 'sounds/rocket.mp3',
    explosion: 'sounds/explosion.mp3',
    buy: 'sounds/buy.mp3',
    idle: 'sounds/tank_idle.mp3',
    move: 'sounds/tank_move.mp3'
};

export let scene, camera, renderer, dirLight;
export let playerFlagType = 'green';
export let enemyFlagType = 'red';

export let cameraRadius = 280, targetCameraRadius = 280;
export let cameraTheta = Math.PI / 4;
export let cameraPhi = Math.PI / 3.5;
export let targetLookAt = new THREE.Vector3(0, 0, 0);

export let shakeTimer = 0;
export let shakeIntensity = 0;
export const camInputs = { up: false, down: false, left: false, right: false, zi: false, zo: false };

export let isDragging = false;
export let previousTouchX = 0;
export let previousTouchY = 0;
export let touchStartX = 0;
export let touchStartY = 0;
export let hasMoved = false;

export let playerTanks = [];
export let enemyTanks = [];
export let bullets = [];
export let tacticalMissiles = [];
export let shockwaves = [];
export let smokeParticles = [];
export let obstacles = []; 
export let rotatingRadars = [];
export let tankTracks = [];
export let treadTextureCache = null;
export let animatedRigs = [];

export let selectionMode = 'all';
export let selectedTank = null;
export let playerTargetPos = null;

export let targetMarkerMesh;
export const raycaster = new THREE.Raycaster();
export const mouse = new THREE.Vector2();
export let terrainMesh;

export let enemyPoleFlagMesh, playerPoleFlagMesh;
export let enemyFlagDataRef, playerFlagDataRef;
export let enemyFlagHeight = 38.5;
export let playerFlagHeight = 38.5;

export let captureProgress = 0;
export let enemyCaptureProgress = 0;
export let gameOver = false;
export let isCinematicEnding = false;
export let cinematicTargetLook = null;

export const CORNER_OFFSET = 380; 
export const MAP_LIMIT = 460;
export const CAPTURE_RADIUS = 38;
export const TANK_RADIUS = 4.5; 

export let playerMoney = 500;
export let enemyMoney = 500;
export let totalMoneySpent = 0;
export let totalTanksLost = 0;
export let enemyTanksLost = 0;
export let oilRigs = [];
export let gameTick = 0;
export let flagWaveTime = 0;
export const activeFlagMeshes = [];

export let playerBuildCooldown = 0;
export let enemyBuildCooldown = 0;

export function setPlayerFlagType(val) { playerFlagType = val; }
export function setEnemyFlagType(val) { enemyFlagType = val; }
export function setScene(val) { scene = val; }
export function setCamera(val) { camera = val; }
export function setRenderer(val) { renderer = val; }
export function setTerrainMesh(val) { terrainMesh = val; }
export function setTargetMarkerMesh(val) { targetMarkerMesh = val; }
export function setGameOver(val) { gameOver = val; }
export function setIsCinematicEnding(val) { isCinematicEnding = val; }
export function setCinematicTargetLook(val) { cinematicTargetLook = val; }
export function setPlayerTargetPos(val) { playerTargetPos = val; }
export function setSelectedTank(val) { selectedTank = val; }
export function setSelectionModeVal(val) { selectionMode = val; }
export function setCameraRadius(val) { cameraRadius = val; }
export function setTargetCameraRadius(val) { targetCameraRadius = val; }
export function setCameraTheta(val) { cameraTheta = val; }
export function setCameraPhi(val) { cameraPhi = val; }
export function setShakeTimer(val) { shakeTimer = val; }
export function setShakeIntensity(val) { shakeIntensity = val; }
export function setIsDragging(val) { isDragging = val; }
export function setPreviousTouchX(val) { previousTouchX = val; }
export function setPreviousTouchY(val) { previousTouchY = val; }
export function setTouchStartX(val) { touchStartX = val; }
export function setTouchStartY(val) { touchStartY = val; }
export function setHasMoved(val) { hasMoved = val; }
export function setPlayerMoney(val) { playerMoney = val; }
export function setEnemyMoney(val) { enemyMoney = val; }
export function setTotalMoneySpent(val) { totalMoneySpent = val; }
export function setTotalTanksLost(val) { totalTanksLost = val; }
export function setEnemyTanksLost(val) { enemyTanksLost = val; }
export function setGameTick(val) { gameTick = val; }
export function setPlayerBuildCooldown(val) { playerBuildCooldown = val; }
export function setEnemyBuildCooldown(val) { enemyBuildCooldown = val; }
export function setCaptureProgress(val) { captureProgress = val; }
export function setEnemyCaptureProgress(val) { enemyCaptureProgress = val; }
export function setEnemyPoleFlagMesh(val) { enemyPoleFlagMesh = val; }
export function setPlayerPoleFlagMesh(val) { playerPoleFlagMesh = val; }
export function setEnemyFlagDataRef(val) { enemyFlagDataRef = val; }
export function setPlayerFlagDataRef(val) { playerFlagDataRef = val; }