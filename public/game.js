
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const socket = io();
const game = document.getElementById("game");
const statusText = document.getElementById("status");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9bdcf5);
scene.fog = new THREE.Fog(0x9bdcf5, 25, 65);

const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
game.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x668855, 2));

const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(8, 15, 8);
sun.castShadow = true;
scene.add(sun);

// Island
const island = new THREE.Mesh(
  new THREE.CylinderGeometry(14, 15, 3, 8),
  new THREE.MeshStandardMaterial({ color: 0x72bd55, flatShading: true })
);
island.position.y = -1.5;
island.receiveShadow = true;
scene.add(island);

const grass = new THREE.Mesh(
  new THREE.CircleGeometry(13.7, 8),
  new THREE.MeshStandardMaterial({ color: 0x91d66b, flatShading: true })
);
grass.rotation.x = -Math.PI / 2;
grass.position.y = 0.02;
scene.add(grass);

const water = new THREE.Mesh(
  new THREE.CircleGeometry(100, 32),
  new THREE.MeshStandardMaterial({ color: 0x38b9df })
);
water.rotation.x = -Math.PI / 2;
water.position.y = -3.2;
scene.add(water);

// Trees
for (let i = 0; i < 14; i++) {
  const angle = (i / 14) * Math.PI * 2;
  const x = Math.cos(angle) * 9;
  const z = Math.sin(angle) * 9;

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.3, 1.5, 5),
    new THREE.MeshStandardMaterial({ color: 0x87512f })
  );
  trunk.position.set(x, 0.75, z);
  trunk.castShadow = true;
  scene.add(trunk);

  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(1.3, 2.6, 5),
    new THREE.MeshStandardMaterial({ color: 0x24834a, flatShading: true })
  );
  leaves.position.set(x, 2.4, z);
  leaves.castShadow = true;
  scene.add(leaves);
}

// Player
function makePlayer(color) {
  const player = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.38, 0.65, 4, 8),
    new THREE.MeshStandardMaterial({ color })
  );
  body.position.y = 0.75;
  body.castShadow = true;
  player.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xffd8b5 })
  );
  head.position.y = 1.48;
  head.castShadow = true;
  player.add(head);

  return player;
}

const myPlayer = makePlayer(0xff75a8);
scene.add(myPlayer);

const otherPlayers = {};

const keys = {};
const heldButtons = new Set();

let jumpVelocity = 0;
let onGround = true;

window.addEventListener("keydown", (event) => {
  keys[event.key.toLowerCase()] = true;

  if (event.code === "Space" && onGround) {
    jumpVelocity = 7;
    onGround = false;
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.key.toLowerCase()] = false;
});

// Mobile directional controls
function setupButton(id, direction) {
  const button = document.getElementById(id);
  if (!button) return;

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    heldButtons.add(direction);
  });

  function release() {
    heldButtons.delete(direction);
  }

  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
}

setupButton("forward", "forward");
setupButton("backward", "backward");
setupButton("left", "left");
setupButton("right", "right");

// Jump button
const jumpButton = document.getElementById("jump");

jumpButton?.addEventListener("pointerdown", (event) => {
  event.preventDefault();

  if (onGround) {
    jumpVelocity = 7;
    onGround = false;
  }
});

// Camera
const cameraOffset = new THREE.Vector3(0, 5, 8);
const cameraTarget = new THREE.Vector3();

camera.position.set(0, 5, 8);

// Multiplayer
socket.on("connect", () => {
  statusText.textContent = "Connected! Adventure begins ❤️";
});

socket.on("connect_error", () => {
  statusText.textContent = "Connecting...";
});

function addOtherPlayer(data) {
  if (data.id === socket.id || otherPlayers[data.id]) return;

  const player = makePlayer(0x70aaff);
  player.position.set(data.x || 0, data.y || 0, data.z || 0);
  scene.add(player);
  otherPlayers[data.id] = player;
}

socket.on("currentPlayers", (players) => {
  for (const id in players) {
    addOtherPlayer(players[id]);
  }
});

socket.on("newPlayer", addOtherPlayer);

socket.on("playerMoved", (data) => {
  const player = otherPlayers[data.id];

  if (player) {
    player.position.set(data.x, data.y || 0, data.z);
  }
});

socket.on("playerDisconnected", (id) => {
  if (otherPlayers[id]) {
    scene.remove(otherPlayers[id]);
    delete otherPlayers[id];
  }
});

// Game loop
const clock = new THREE.Clock();
let lastSent = 0;

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);
  const speed = 5 * delta;

  let forward = 0;
  let sideways = 0;

  if (keys["w"] || keys["arrowup"] || heldButtons.has("forward")) forward += 1;
  if (keys["s"] || keys["arrowdown"] || heldButtons.has("backward")) forward -= 1;
  if (keys["a"] || keys["arrowleft"] || heldButtons.has("left")) sideways -= 1;
  if (keys["d"] || keys["arrowright"] || heldButtons.has("right")) sideways += 1;

  const moving = forward !== 0 || sideways !== 0;

  if (moving) {
    const direction = new THREE.Vector3(sideways, 0, -forward).normalize();
    myPlayer.position.addScaledVector(direction, speed);
    myPlayer.rotation.y = Math.atan2(direction.x, direction.z);
  }

  // Jump physics
  if (!onGround) {
    myPlayer.position.y += jumpVelocity * delta;
    jumpVelocity -= 18 * delta;

    if (myPlayer.position.y <= 0) {
      myPlayer.position.y = 0;
      jumpVelocity = 0;
      onGround = true;
    }
  }

  // Island boundary
  const distance = Math.hypot(myPlayer.position.x, myPlayer.position.z);

  if (distance > 11) {
    myPlayer.position.x *= 11 / distance;
    myPlayer.position.z *= 11 / distance;
  }

  // Third-person camera
  const desiredCamera = myPlayer.position.clone().add(cameraOffset);
  camera.position.lerp(desiredCamera, 1 - Math.pow(0.001, delta));

  cameraTarget.set(
    myPlayer.position.x,
    myPlayer.position.y + 1,
    myPlayer.position.z
  );

  camera.lookAt(cameraTarget);

  // Send player position
  if (performance.now() - lastSent > 50) {
    socket.emit("playerMovement", {
      x: myPlayer.position.x,
      y: myPlayer.position.y,
      z: myPlayer.position.z
    });

    lastSent = performance.now();
  }

  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
