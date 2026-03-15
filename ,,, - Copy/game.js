const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Setup & Resize ---
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Initial size

// --- World & Camera ---
let WORLD_WIDTH = 1024;
let WORLD_HEIGHT = 1024;
const camera = { x: 0, y: 0 };

let debugMode = false;

// --- Input Handling ---
const keys = {};
const mouse = { x: 0, y: 0, screenX: window.innerWidth / 2, screenY: window.innerHeight / 2, down: false };

window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyH' || e.code === 'Keyh') {
        debugMode = !debugMode;
    }
});
window.addEventListener('keyup', e => keys[e.code] = false);
window.addEventListener('mousemove', e => { 
    mouse.screenX = e.clientX; 
    mouse.screenY = e.clientY; 
});
window.addEventListener('mousedown', e => mouse.down = true);
window.addEventListener('mouseup', e => mouse.down = false);

// Prevent context menu on right click so we can use it later if needed
window.addEventListener('contextmenu', e => e.preventDefault());

// --- Physics Configuration ---
const PHYSICS = {
    GRAVITY: 0.18,      // Lowered gravity for more floating
    FRICTION: 0.82,     // Horizontal ground friction
    AIR_FRICTION: 0.95, // Horizontal air drag
    MAX_FALL_SPEED: 8   // Slower max fall speed
};

// --- Entities ---
const bullets = [];
const particles = [];
const enemies = [];
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 50;
        this.vx = 0;
        this.vy = 0;
        this.speed = 0.8;       // Slower acceleration
        this.maxSpeed = 4.5;    // Lower top speed
        this.jumpForce = -7.5;  // Adjusted jump force for lower gravity
        this.grounded = false;
        this.jumpsLeft = 2;     // Double jump mechanic
        this.spacePressed = false;
        this.color = '#66fcf1'; // Neon teal
        
        // Weapon System
        const pistolImg = new Image();
        pistolImg.src = 'adob.png';
        const rifleImg = new Image();
        rifleImg.src = 'unn.png';
        const shotgunImg = new Image();
        shotgunImg.src = 'shot.png';
        const cannonImg = new Image();
        cannonImg.src = 'sah.png';

        this.weapons = [
            { type: 'Pistol', fireRate: 250, lastFired: 0, bulletSpeed: 30, color: '#66fcf1', spread: 0.02, count: 1, damage: 25, img: pistolImg, imgW: 40, imgH: 30, imgX: 5, imgY: -10 },
            { type: 'Rifle', fireRate: 100, lastFired: 0, bulletSpeed: 44, color: '#ff0055', spread: 0.08, count: 1, damage: 15, img: rifleImg, imgW: 80, imgH: 60, imgX: 10, imgY: -20 },
            { type: 'Shotgun', fireRate: 800, lastFired: 0, bulletSpeed: 24, color: '#ffaa00', spread: 0.25, count: 6, damage: 20, range: 50, img: shotgunImg, imgW: 80, imgH: 60, imgX: 10, imgY: -20 },
            { type: 'Cannon', fireRate: 1428, lastFired: 0, bulletSpeed: 20, color: '#ff3300', spread: 0, count: 1, damage: 80, radius: 15, img: cannonImg, imgW: 90, imgH: 70, imgX: 15, imgY: -25 }
        ];
        this.weaponIndex = 0;
        this.weapon = this.weapons[this.weaponIndex];
    }

    update(platforms) {
        // --- Horizontal Movement ---
        let inputDir = 0;
        if (keys['KeyA'] || keys['ArrowLeft']) inputDir -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) inputDir += 1;
        
        this.vx += inputDir * this.speed;

        // Apply friction
        this.vx *= this.grounded ? PHYSICS.FRICTION : PHYSICS.AIR_FRICTION;

        // Speed limit
        if (this.vx > this.maxSpeed) this.vx = this.maxSpeed;
        if (this.vx < -this.maxSpeed) this.vx = -this.maxSpeed;
        
        // Stop moving if extremely slow to prevent infinite sliding
        if (Math.abs(this.vx) < 0.1) this.vx = 0;

        // Apply X velocity
        this.x += this.vx;

        // --- Jumping ---
        const jumpKey = keys['Space'] || keys['KeyW'] || keys['ArrowUp'];
        if (jumpKey && this.jumpsLeft > 0 && !this.spacePressed) {
            this.vy = this.jumpForce;
            this.jumpsLeft--;
            this.grounded = false;
            this.spacePressed = true;
            
            // Add a little visual kick to double jumps (e.g., spawn particles later)
        }
        if (!jumpKey) {
             this.spacePressed = false;
        }

        // --- Gravity ---
        this.vy += PHYSICS.GRAVITY;
        if (this.vy > PHYSICS.MAX_FALL_SPEED) this.vy = PHYSICS.MAX_FALL_SPEED;
        
        // Apply Y velocity
        this.y += this.vy;

        // --- AABB Collision with Platforms ---
        this.grounded = false;
        for (let p of platforms) {
            // Check bounding box intersection
            if (this.x < p.x + p.width &&
                this.x + this.width > p.x &&
                this.y < p.y + p.height &&
                this.y + this.height > p.y) {
                
                // Determine collision depth on each axis
                const overlapX = (this.x + this.width / 2) - (p.x + p.width / 2);
                const overlapY = (this.y + this.height / 2) - (p.y + p.height / 2);
                const halfWidths = (this.width / 2) + (p.width / 2);
                const halfHeights = (this.height / 2) + (p.height / 2);
                
                const absOverlapX = Math.abs(overlapX);
                const absOverlapY = Math.abs(overlapY);

                const diffX = halfWidths - absOverlapX;
                const diffY = halfHeights - absOverlapY;

                // Resolve collision on the axis with the smallest penetration depth
                if (diffX < diffY) {
                    // Horizontal collision
                    if (overlapX > 0) {
                        this.x += diffX; // Pushed right
                        this.vx = 0;
                    } else {
                        this.x -= diffX; // Pushed left
                        this.vx = 0;
                    }
                } else {
                    // Vertical collision
                    if (overlapY > 0) {
                        this.y += diffY; // Hit head on ceiling
                        this.vy = 0;
                    } else {
                        this.y -= diffY; // Landed on platform
                        this.vy = 0;
                        this.grounded = true;
                        this.jumpsLeft = 2; // Reset double jump
                    }
                }
            }
        }

        // --- World Boundaries ---
        // Top boundary has been removed to allow flying up infinitely
        if (this.x < 0) { this.x = 0; this.vx = 0; }
        if (this.x + this.width > WORLD_WIDTH) { this.x = WORLD_WIDTH - this.width; this.vx = 0; }
        
        // Respawn if falling out of bottom of world
        if (this.y > WORLD_HEIGHT + 200) {
            this.y = 100;
            this.x = WORLD_WIDTH / 2;
            this.vy = 0;
            this.vx = 0;
        }

        // --- Weapon Switching ---
        if (keys['Digit1']) { this.weaponIndex = 0; this.weapon = this.weapons[0]; }
        if (keys['Digit2']) { this.weaponIndex = 1; this.weapon = this.weapons[1]; }
        if (keys['Digit3']) { this.weaponIndex = 2; this.weapon = this.weapons[2]; }
        if (keys['Digit4']) { this.weaponIndex = 3; this.weapon = this.weapons[3]; }

        // --- Shooting ---
        if (mouse.down && Date.now() - this.weapon.lastFired > this.weapon.fireRate) {
            this.shoot();
            this.weapon.lastFired = Date.now();
        }
    }

    shoot() {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        const dx = mouse.x - cx;
        const dy = mouse.y - cy;
        const baseAngle = Math.atan2(dy, dx);
        
        for(let i = 0; i < this.weapon.count; i++) {
            // Apply spread
            const angle = baseAngle + (Math.random() - 0.5) * this.weapon.spread;
            // Slight randomized speed for shotgun
            const speed = this.weapon.bulletSpeed * (1 - Math.random() * (this.weapon.count > 1 ? 0.3 : 0)); 
            const b = new Bullet(cx, cy, angle, speed, this.weapon.color);
            b.damage = this.weapon.damage; // Attach damage to bullet
            if (this.weapon.range) b.life = this.weapon.range; // Halve shotgun's life to shrink range
            if (this.weapon.radius) b.radius = this.weapon.radius; // Apply custom radius (like for Cannon)
            bullets.push(b);
        }
    }

    draw(ctx) {
        // Neon glow effect setup
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        
        // Draw character body
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // --- Draw Eyes based on Aim Direction ---
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 0; // Turn off blur for crisp eyes
        
        // Calculate center of player
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        
        // Facing direction based on mouse
        let facingRight = mouse.x > cx;
        
        if (facingRight) {
            ctx.fillRect(this.x + 18, this.y + 10, 8, 4); // Right eye block
        } else {
            ctx.fillRect(this.x + 4, this.y + 10, 8, 4);  // Left eye block
        }

        // --- Laser Sight / Aiming Line ---
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        
        // Calculate angle and draw a fixed length laser
        const dx = mouse.x - cx;
        const dy = mouse.y - cy;
        const angle = Math.atan2(dy, dx);
        const distance = 80; // Laser pointer length
        
        ctx.lineTo(cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance);
        
        // Styling the laser sight
        ctx.strokeStyle = `rgba(102, 252, 241, 0.4)`; // Semi-transparent glow color
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]); // Dashed line
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash

        ctx.shadowBlur = 0; // Reset

        // --- Draw Weapon Image ---
        if (this.weapon.img && this.weapon.img.complete && this.weapon.img.naturalWidth > 0) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            // Flip the gun visually if aiming to the left so it doesn't appear upside down
            if (!facingRight) {
                ctx.scale(1, -1);
            }
            // Draw using weapon's specific image settings
            const iw = this.weapon.imgW || 60;
            const ih = this.weapon.imgH || 30;
            const ix = this.weapon.imgX || 10;
            const iy = this.weapon.imgY || -15;
            ctx.drawImage(this.weapon.img, ix, iy, iw, ih);
            ctx.restore();
        }
        
        // Draw weapon name
        ctx.fillStyle = this.weapon.color;
        ctx.font = 'bold 12px "Segoe UI"';
        ctx.textAlign = 'center';
        ctx.fillText(this.weapon.type, cx, this.y - 15);
    }
}

class JumpPad {
    constructor(x, y, width, force) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = 10;
        this.force = force;
        this.color = '#00ffcc';
        this.cooldown = 0;
    }

    update(entities) {
        if (this.cooldown > 0) this.cooldown--;
        
        for (let e of entities) {
            // Check collision with player or enemy
            if (e.vy >= 0 && // Moving down or still
                e.x < this.x + this.width &&
                e.x + e.width > this.x &&
                e.y + e.height > this.y &&
                e.y < this.y + this.height) {
                
                e.vy = this.force;
                e.grounded = false;
                if (e instanceof Player) {
                    e.jumpsLeft = 2; // Reset player jumps on bounce
                    e.spacePressed = true;
                }
                this.cooldown = 15; // Visual bounce cooldown
                
                // Spark particles
                for(let i=0; i<5; i++) {
                    particles.push(new Particle(e.x + e.width/2, this.y, this.color));
                }
            }
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.cooldown > 0 ? '#ffffff' : this.color;
        ctx.shadowBlur = this.cooldown > 0 ? 20 : 10;
        ctx.shadowColor = this.color;
        
        // Draw base
        ctx.fillRect(this.x, this.y + 5, this.width, 5);
        
        // Draw spring part
        const springLift = this.cooldown > 0 ? 0 : 5;
        ctx.fillRect(this.x + 5, this.y + springLift, this.width - 10, 5 - springLift);
        
        ctx.shadowBlur = 0;
    }
}

class Bullet {
    constructor(x, y, angle, speed, color) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.radius = 4;
        this.color = color;
        this.life = 100; // frames
        this.markedForDeletion = false;
    }

    update(platforms) {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        if (this.life <= 0) this.markedForDeletion = true;

        // Collision with platforms
        for (let p of platforms) {
            if (this.x > p.x && this.x < p.x + p.width &&
                this.y > p.y && this.y < p.y + p.height) {
                this.markedForDeletion = true;
                // Spark particles
                for(let i=0; i<8; i++) {
                    particles.push(new Particle(this.x, this.y, this.color));
                }
                break;
            }
        }
    }

    draw(ctx) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.decay = Math.random() * 0.05 + 0.02;
        this.color = color;
        this.size = Math.random() * 3 + 1;
    }

    update() {
        this.vy += PHYSICS.GRAVITY * 0.6; // Particles have weight
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1.0;
    }
}

class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 40;
        this.color = '#ff0055'; // Demon red
        this.maxHealth = 100;
        this.health = 100;
        this.markedForDeletion = false;
        // Basic AI movement (patrol limits)
        this.startX = x;
        this.vx = 1.5; 
    }
    
    update(platforms) {
        // Simple patrol
        this.x += this.vx;
        if (Math.abs(this.x - this.startX) > 80) this.vx *= -1;
        
        // Check bullet hit
        for (let b of bullets) {
            if (!b.markedForDeletion && 
                b.x > this.x && b.x < this.x + this.width &&
                b.y > this.y && b.y < this.y + this.height) {
                
                b.markedForDeletion = true;
                this.health -= b.damage || 20; // Take damage
                
                // Blood/Sparks
                for(let i=0; i<8; i++) {
                    particles.push(new Particle(b.x, b.y, this.color));
                }
            }
        }
        
        if (this.health <= 0) {
            this.markedForDeletion = true;
             // Death explosion
            for(let i=0; i<40; i++) {
                particles.push(new Particle(this.x + this.width/2, this.y + this.height/2, this.color));
            }
        }
    }
    
    draw(ctx) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Health bar
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#222';
        ctx.fillRect(this.x, this.y - 10, this.width, 4);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(this.x, this.y - 10, this.width * (this.health/this.maxHealth), 4);
    }
}

class ImagePlatform {
    constructor(x, y, src) {
        this.x = x;
        this.y = y;
        this.img = new Image();
        this.img.src = src;
        this.width = 100; // Default until image loads
        this.height = 100;
        this.img.onload = () => {
            this.width = this.img.width;
            this.height = this.img.height;
        };
    }

    draw(ctx) {
        if (this.img.complete && this.width > 0 && this.img.naturalWidth > 0) {
            ctx.drawImage(this.img, this.x, this.y);
        }
        if (debugMode) {
            ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        }
    }
}

class Hitbox {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    draw(ctx) {
        if (debugMode) {
            ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        }
    }
}

// --- Initialization ---
const player = new Player(canvas.width / 2, 100);

const bgImage = new Image();
bgImage.src = 'mff.png';
bgImage.onload = () => {
    WORLD_WIDTH = bgImage.width;
    WORLD_HEIGHT = bgImage.height;
};

// Configuration array for all hitboxes
// Easily define (x, y, width, height) coordinates for these platforms
const hitboxesConfig = [
    { x: 0, y: 711, width: 1408, height: 10 },    // Green line
    { x: 675, y: 699, width: 733, height: 10 },   // Orange line (bottom right)
    
    // Purple lines from fffm.png
    { x: 175, y: 395, width: 20, height: 10 },
    { x: 455, y: 395, width: 115, height: 10 },
    { x: 165, y: 400, width: 495, height: 10 },
    { x: 900, y: 400, width: 20, height: 10 },
    { x: 160, y: 405, width: 540, height: 10 },
    { x: 870, y: 405, width: 60, height: 10 },
    { x: 155, y: 410, width: 780, height: 10 },
    { x: 155, y: 415, width: 785, height: 10 },
    { x: 150, y: 420, width: 790, height: 10 },
    { x: 150, y: 425, width: 790, height: 10 },
    { x: 150, y: 430, width: 790, height: 10 },
    { x: 155, y: 435, width: 785, height: 10 },
    { x: 155, y: 440, width: 785, height: 10 },
    { x: 160, y: 445, width: 775, height: 10 },
    { x: 170, y: 450, width: 760, height: 10 },
    { x: 185, y: 455, width: 30, height: 10 },
    { x: 640, y: 455, width: 280, height: 10 },
    { x: 680, y: 460, width: 215, height: 10 },
    { x: 1185, y: 575, width: 80, height: 10 },
    { x: 860, y: 580, width: 410, height: 10 },
    { x: 850, y: 585, width: 425, height: 10 },
    { x: 840, y: 590, width: 435, height: 10 },
    { x: 830, y: 595, width: 450, height: 10 },
    { x: 820, y: 600, width: 460, height: 10 },
    { x: 815, y: 605, width: 465, height: 10 },
    { x: 810, y: 610, width: 465, height: 10 },
    { x: 805, y: 615, width: 470, height: 10 },
    { x: 800, y: 620, width: 470, height: 10 },
    { x: 795, y: 625, width: 465, height: 10 },
    { x: 795, y: 630, width: 420, height: 10 },
    { x: 790, y: 635, width: 90, height: 10 },
    { x: 985, y: 635, width: 40, height: 10 },
    { x: 785, y: 640, width: 85, height: 10 },
    { x: 785, y: 645, width: 75, height: 10 },
    { x: 780, y: 650, width: 70, height: 10 },
    { x: 775, y: 655, width: 70, height: 10 },
    { x: 770, y: 660, width: 75, height: 10 },
    { x: 760, y: 665, width: 80, height: 10 },
    { x: 755, y: 670, width: 80, height: 10 },
    { x: 750, y: 675, width: 85, height: 10 },
    { x: 750, y: 680, width: 80, height: 10 },
    { x: 750, y: 685, width: 75, height: 10 },
    { x: 750, y: 690, width: 70, height: 10 },
    { x: 750, y: 695, width: 65, height: 10 },
    { x: 755, y: 700, width: 60, height: 10 },
    { x: 755, y: 705, width: 50, height: 10 },
    { x: 760, y: 710, width: 40, height: 10 }
];

const platforms = []; // We keep the array name 'platforms' so collision logic remains intact
const jumpPads = [];

function createLevel() {
    platforms.length = 0;
    jumpPads.length = 0;
    
    // Create hitboxes from the configuration array
    for (let config of hitboxesConfig) {
        platforms.push(new Hitbox(config.x, config.y, config.width, config.height));
    }
    
    // Add the image platform so we can walk on it
    platforms.push(new ImagePlatform(100, 200, 'unnamed.jpg'));

    // --- Spawn Enemies ---
    enemies.length = 0;
    
    // Place a couple of enemies for testing
    enemies.push(new Enemy(400, 950));
    enemies.push(new Enemy(800, 950));
    
    // Correct Player start safely above ground
    player.x = 200;
    player.y = 30;
}
createLevel();


// --- Main Game Loop ---
function gameLoop() {
    // 1. Clear screen with solid dark background
    ctx.fillStyle = '#0b0c10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- Camera Logic ---
    camera.x = player.x + player.width / 2 - canvas.width / 2;
    camera.y = player.y + player.height / 2 - canvas.height / 2;
    
    // Clamp camera to world bounds
    camera.x = Math.max(0, Math.min(camera.x, WORLD_WIDTH - canvas.width));
    camera.y = Math.max(0, Math.min(camera.y, WORLD_HEIGHT - canvas.height));
    
    // Update mouse world coordinates based on camera offset
    mouse.x = mouse.screenX + camera.x;
    mouse.y = mouse.screenY + camera.y;

    ctx.save();
    ctx.translate(-Math.floor(camera.x), -Math.floor(camera.y));

    // 2. Draw Background image or grid fallback
    if (bgImage.complete && bgImage.naturalWidth > 0) {
        ctx.drawImage(bgImage, 0, 0);
    } else {
        // Draw decorative Sci-Fi Grid covering visible area
        ctx.strokeStyle = 'rgba(69, 162, 158, 0.05)';
        ctx.lineWidth = 1;
        const gridSize = 60;
        
        const startX = Math.floor(camera.x / gridSize) * gridSize;
        const endX = camera.x + canvas.width + gridSize;
        const startY = Math.floor(camera.y / gridSize) * gridSize;
        const endY = camera.y + canvas.height + gridSize;

        for(let i=startX; i<endX; i+=gridSize) {
            ctx.beginPath(); ctx.moveTo(i, startY); ctx.lineTo(i, endY); ctx.stroke();
        }
        for(let i=startY; i<endY; i+=gridSize) {
            ctx.beginPath(); ctx.moveTo(startX, i); ctx.lineTo(endX, i); ctx.stroke();
        }
    }

    // 3. Update game logic
    player.update(platforms);
    jumpPads.forEach(jp => jp.update([player, ...enemies]));

    enemies.forEach(e => e.update(platforms));
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (enemies[i].markedForDeletion) enemies.splice(i, 1);
    }

    bullets.forEach(b => b.update(platforms));
    for (let i = bullets.length - 1; i >= 0; i--) {
        if (bullets[i].markedForDeletion) bullets.splice(i, 1);
    }

    particles.forEach(p => p.update());
    for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i].life <= 0) particles.splice(i, 1);
    }

    // 4. Render everything
    jumpPads.forEach(jp => jp.draw(ctx));
    platforms.forEach(p => p.draw(ctx));
    enemies.forEach(e => e.draw(ctx));
    bullets.forEach(b => b.draw(ctx));
    player.draw(ctx);
    particles.forEach(p => p.draw(ctx));

    ctx.restore();

    // Request next frame
    requestAnimationFrame(gameLoop);
}

// Start
requestAnimationFrame(gameLoop);
