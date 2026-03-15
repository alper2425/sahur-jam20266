import React, { useRef, useEffect, useState } from 'react';

const DevilWithProjectiles = () => {
    const canvasRef = useRef(null);
    const [currentWeapon, setCurrentWeapon] = useState('pistol');
    const [playerHealth, setPlayerHealth] = useState(100);
    
    // Game State Refs (Better for performance in animation loops)
    const gameState = useRef({
        player: { x: 1200, y: 900, width: 30, height: 50, speed: 5 },
        enemies: [],
        projectiles: [],
        particles: [],
        camera: { x: 0, y: 0 },
        mouse: { x: 0, y: 0 },
        lastAutoFire: 0
    });

    const keys = useRef({});
    const WORLD_SIZE = { width: 3000, height: 2000 };
    const VIEWPORT = { width: 800, height: 600 };

    const weapons = {
        pistol: { damage: 15, color: '#66fcf1', speed: 15, size: 4, label: 'Pistol', rate: 200 },
        rifle: { damage: 25, color: '#ff0055', speed: 25, size: 5, label: 'Rifle', rate: 100 },
        shotgun: { damage: 10, color: '#ffaa00', speed: 12, size: 3, label: 'Shotgun', rate: 800 },
        ramazanTopu: { damage: 100, color: '#bd00ff', speed: 8, size: 15, label: 'Ramazan Topu', rate: 600 },
    };

    // Initialize Enemies
    useEffect(() => {
        const initialEnemies = [];
        const pStart = gameState.current.player;
        for (let i = 0; i < 30; i++) {
            // Spawn in a cluster around the player
            initialEnemies.push({
                x: pStart.x + (Math.random() - 0.5) * 1200,
                y: pStart.y + (Math.random() - 0.5) * 1000,
                width: 60,
                height: 60,
                health: 100,
                maxHealth: 100,
                color: 'red'
            });
        }
        gameState.current.enemies = initialEnemies;

        const handleKeyDown = (e) => keys.current[e.code] = true;
        const handleKeyUp = (e) => keys.current[e.code] = false;
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    const spawnParticles = (x, y, color) => {
        for (let i = 0; i < 8; i++) {
            gameState.current.particles.push({
                x, y, color,
                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5,
                life: 1.0,
                decay: 0.02 + Math.random() * 0.03
            });
        }
    };

    const shoot = (typeOverride) => {
        const weaponType = typeOverride || currentWeapon;
        const config = weapons[weaponType];
        const state = gameState.current;
        const p = state.player;
        
        // Calculate angle from player center to mouse world pos
        const dx = state.mouse.x - p.x;
        const dy = state.mouse.y - p.y;
        const angle = Math.atan2(dy, dx);

        if (weaponType === 'shotgun') {
            const spread = [-0.2, -0.1, 0, 0.1, 0.2];
            spread.forEach(s => {
                state.projectiles.push({
                    x: p.x, y: p.y,
                    vx: Math.cos(angle + s) * config.speed,
                    vy: Math.sin(angle + s) * config.speed,
                    ...config,
                    active: true
                });
            });
        } else {
            state.projectiles.push({
                x: p.x, y: p.y,
                vx: Math.cos(angle) * config.speed,
                vy: Math.sin(angle) * config.speed,
                ...config,
                active: true
            });
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        const update = () => {
            const state = gameState.current;
            const p = state.player;

            // 1. Movement
            if (keys.current['KeyW'] || keys.current['ArrowUp']) p.y -= p.speed;
            if (keys.current['KeyS'] || keys.current['ArrowDown']) p.y += p.speed;
            if (keys.current['KeyA'] || keys.current['ArrowLeft']) p.x -= p.speed;
            if (keys.current['KeyD'] || keys.current['ArrowRight']) p.x += p.speed;

            // Constrain Player
            p.x = Math.max(0, Math.min(p.x, WORLD_SIZE.width));
            p.y = Math.max(0, Math.min(p.y, WORLD_SIZE.height));

            // 2. Camera
            state.camera.x = p.x - VIEWPORT.width / 2;
            state.camera.y = p.y - VIEWPORT.height / 2;
            state.camera.x = Math.max(0, Math.min(state.camera.x, WORLD_SIZE.width - VIEWPORT.width));
            state.camera.y = Math.max(0, Math.min(state.camera.y, WORLD_SIZE.height - VIEWPORT.height));

            // 3. Auto-fire Ramazan Topu
            if (Date.now() - state.lastAutoFire > weapons.ramazanTopu.rate) {
                shoot('ramazanTopu');
                state.lastAutoFire = Date.now();
            }

            // 4. Update Projectiles
            state.projectiles = state.projectiles.filter(proj => {
                proj.x += proj.vx;
                proj.y += proj.vy;

                // Collision with enemies
                for (let en of state.enemies) {
                    if (proj.x > en.x && proj.x < en.x + en.width && proj.y > en.y && proj.y < en.y + en.height) {
                        en.health -= proj.damage;
                        spawnParticles(proj.x, proj.y, proj.color);
                        return false; // Remove projectile
                    }
                }

                // Boundary check
                return proj.x > 0 && proj.x < WORLD_SIZE.width && proj.y > 0 && proj.y < WORLD_SIZE.height;
            });

            // 5. Update Particles
            state.particles = state.particles.filter(pt => {
                pt.x += pt.vx;
                pt.y += pt.vy;
                pt.life -= pt.decay;
                return pt.life > 0;
            });

            // 6. Filter Dead Enemies
            state.enemies = state.enemies.filter(en => en.health > 0);
        };

        const draw = () => {
            const state = gameState.current;
            const cam = state.camera;

            ctx.fillStyle = '#0b0c10';
            ctx.fillRect(0, 0, VIEWPORT.width, VIEWPORT.height);

            // Draw Grid
            ctx.strokeStyle = '#1f2833';
            ctx.lineWidth = 1;
            const step = 100;
            for (let x = -(cam.x % step); x <= VIEWPORT.width; x += step) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, VIEWPORT.height); ctx.stroke();
            }
            for (let y = -(cam.y % step); y <= VIEWPORT.height; y += step) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VIEWPORT.width, y); ctx.stroke();
            }

            // Draw Enemies
            state.enemies.forEach(en => {
                const sx = en.x - cam.x;
                const sy = en.y - cam.y;
                if (sx > -100 && sx < VIEWPORT.width + 100 && sy > -100 && sy < VIEWPORT.height + 100) {
                    ctx.save();
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = 'red';
                    ctx.fillStyle = '#c3073f';
                    ctx.fillRect(sx, sy, en.width, en.height);
                    
                    // Health bar
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = '#1a1a1d';
                    ctx.fillRect(sx, sy - 15, en.width, 8);
                    ctx.fillStyle = '#6f2232';
                    ctx.fillRect(sx, sy - 15, en.width * (en.health / en.maxHealth), 8);
                    ctx.restore();
                }
            });

            // Draw Projectiles
            state.projectiles.forEach(proj => {
                ctx.save();
                ctx.shadowBlur = 10;
                ctx.shadowColor = proj.color;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(proj.x - cam.x, proj.y - cam.y, proj.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            // Draw Particles
            state.particles.forEach(pt => {
                ctx.globalAlpha = pt.life;
                ctx.fillStyle = pt.color;
                ctx.fillRect(pt.x - cam.x, pt.y - cam.y, 2, 2);
                ctx.globalAlpha = 1;
            });

            // Draw Player
            const psx = state.player.x - cam.x;
            const psy = state.player.y - cam.y;
            ctx.save();
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#66fcf1';
            ctx.fillStyle = '#66fcf1';
            ctx.fillRect(psx - 15, psy - 25, 30, 50);
            
            // Player Eyes (Aiming indicator)
            const angle = Math.atan2(state.mouse.y - state.player.y, state.mouse.x - state.player.x);
            ctx.fillStyle = 'white';
            ctx.shadowBlur = 0;
            const eyeX = Math.cos(angle) * 10;
            const eyeY = Math.sin(angle) * 10;
            ctx.fillRect(psx + eyeX - 2, psy + eyeY - 10, 4, 4);
            ctx.restore();

            // HUD - Crosshair
            const msx = state.mouse.x - cam.x;
            const msy = state.mouse.y - cam.y;
            ctx.strokeStyle = '#66fcf1';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(msx - 10, msy); ctx.lineTo(msx + 10, msy);
            ctx.moveTo(msx, msy - 10); ctx.lineTo(msx, msy + 10);
            ctx.stroke();
        };

        const engine = () => {
            update();
            draw();
            animationFrameId = requestAnimationFrame(engine);
        };

        engine();
        return () => cancelAnimationFrame(animationFrameId);
    }, [currentWeapon]);

    const handleMouseMove = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const vx = e.clientX - rect.left;
        const vy = e.clientY - rect.top;
        gameState.current.mouse.x = vx + gameState.current.camera.x;
        gameState.current.mouse.y = vy + gameState.current.camera.y;
    };

    const handleMouseDown = (e) => {
        shoot();
    };

    return (
        <div style={{ 
            background: '#0b0c10', 
            color: '#c5c6c7', 
            minHeight: '100vh', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            userSelect: 'none',
            fontFamily: 'system-ui, sans-serif'
        }}>
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <h1 style={{ color: '#66fcf1', margin: 0, letterSpacing: '4px', textShadow: '0 0 10px #66fcf166' }}>DEVIL SLAYER: OPEN WORLD</h1>
                <p style={{ opacity: 0.6, fontSize: '14px' }}>[WASD] Move | [Mouse] Aim & Shoot</p>
            </div>

            <div style={{ position: 'relative', cursor: 'none', border: '2px solid #45a29e', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 0 40px rgba(102, 252, 241, 0.1)' }}>
                <canvas 
                    ref={canvasRef} 
                    width={800} 
                    height={600} 
                    onMouseMove={handleMouseMove}
                    onMouseDown={handleMouseDown}
                />
            </div>

            <div style={{ 
                marginTop: '20px', 
                display: 'flex', 
                gap: '15px', 
                background: 'rgba(31, 40, 51, 0.8)', 
                padding: '15px', 
                borderRadius: '12px',
                border: '1px solid #45a29e'
            }}>
                {Object.keys(weapons).map(w => (
                    <button
                        key={w}
                        onClick={() => setCurrentWeapon(w)}
                        style={{
                            background: currentWeapon === w ? weapons[w].color : 'transparent',
                            border: `1px solid ${weapons[w].color}`,
                            color: currentWeapon === w ? '#000' : weapons[w].color,
                            padding: '8px 16px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            transition: '0.2s',
                            opacity: w === 'ramazanTopu' ? 0.8 : 1
                        }}
                    >
                        {weapons[w].label}
                    </button>
                ))}
            </div>
            <div style={{ color: '#bd00ff', marginTop: '10px', fontSize: '12px', fontWeight: 'bold' }}>
                ⚡ AUTOMATIC FIRE: RAMAZAN TOPU ⚡
            </div>
        </div>
    );
};

export default DevilWithProjectiles;
