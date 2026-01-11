const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const WORLD_SIZE = 2500;
const COLORS = { 2: "#eee4da", 4: "#ede0c8", 8: "#f2b179", 16: "#f59563", 32: "#f67c5f", 64: "#f65e3b", 128: "#edcf72", 256: "#edcc61", 512: "#edc850", 1024: "#edc53f", 2048: "#3c3a32" };

let gameActive = false;
let player, npcs = [], food = [], camera = { x: 0, y: 0 };
let highScore = localStorage.getItem('cubes_high') || 0;
document.getElementById('bestScore').innerText = highScore;

class Cube {
    constructor(x, y, value) { this.x = x; this.y = y; this.value = value; }
    draw(camX, camY, name = null) {
        let sx = this.x - camX, sy = this.y - camY;
        ctx.fillStyle = COLORS[this.value] || "#333";
        ctx.beginPath(); ctx.roundRect(sx - 23, sy - 23, 46, 46, 8); ctx.fill();
        ctx.fillStyle = this.value <= 4 ? "#776e65" : "white";
        ctx.font = "bold 16px Arial"; ctx.textAlign = "center";
        ctx.fillText(this.value, sx, sy + 6);
        if (name) { ctx.fillStyle = "white"; ctx.font = "14px Arial"; ctx.fillText(name, sx, sy - 38); }
    }
}

class Entity {
    constructor(x, y, name, isNPC) { 
        this.segments = [new Cube(x, y, isNPC ? Math.pow(2, Math.floor(Math.random()*4)+1) : 2)];
        this.name = name;
        this.isNPC = isNPC;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = isNPC ? 4.6 : 5.5;
        this.dead = false;
    }
    update(all) {
        let head = this.segments[0];
        if (this.isNPC) this.think(all);
        head.x += Math.cos(this.angle) * this.speed;
        head.y += Math.sin(this.angle) * this.speed;
        if (Math.abs(head.x) > WORLD_SIZE) { head.x = Math.sign(head.x) * WORLD_SIZE; this.angle = Math.PI - this.angle; }
        if (Math.abs(head.y) > WORLD_SIZE) { head.y = Math.sign(head.y) * WORLD_SIZE; this.angle = -this.angle; }
        for (let i = 1; i < this.segments.length; i++) {
            let p = this.segments[i-1], c = this.segments[i];
            let d = Math.hypot(p.x - c.x, p.y - c.y);
            if (d > 48) {
                let a = Math.atan2(p.y - c.y, p.x - c.x);
                c.x = p.x - Math.cos(a) * 48;
                c.y = p.y - Math.sin(a) * 48;
            }
        }
        this.mergeBody();
    }
    think(all) {
        let head = this.segments[0];
        for (let other of all) {
            if (other === this || other.dead) continue;
            let d = Math.hypot(head.x - other.segments[0].x, head.y - other.segments[0].y);
            if (d < 350) {
                let a = Math.atan2(other.segments[0].y - head.y, other.segments[0].x - head.x);
                this.angle = (other.segments[0].value > head.value) ? a + Math.PI : a;
                return;
            }
        }
        if (food.length > 0) {
            let f = food[0];
            this.angle += (Math.atan2(f.y - head.y, f.x - head.x) - this.angle) * 0.1;
        }
    }
    mergeBody() {
        for(let i=0; i<this.segments.length; i++) {
            for(let j=i+1; j<this.segments.length; j++) {
                if(this.segments[i].value === this.segments[j].value) {
                    this.segments[i].value *= 2;
                    this.segments.splice(j, 1);
                }
            }
        }
        this.segments.sort((a,b) => b.value - a.value);
    }
}

player = new Entity(0, 0, "You", false);

function startGame() {
    let n = document.getElementById('nickname').value;
    if(n) player.name = n;
    document.getElementById('overlay').style.display = "none";
    gameActive = true;
}

function handleDeath() {
    gameActive = false;
    let currentScore = player.segments[0].value;
    if(currentScore > highScore) {
        highScore = currentScore;
        localStorage.setItem('cubes_high', highScore);
        document.getElementById('bestScore').innerText = highScore;
    }
    document.getElementById('death-text').style.display = "block";
    document.getElementById('overlay').style.display = "flex";
    player = new Entity(0, 0, player.name, false);
}

function processCollisions() {
    let all = [player, ...npcs];
    let actions = [];
    for (let p1 of all) {
        if (p1.dead) continue;
        let head = p1.segments[0];
        for (let i = food.length - 1; i >= 0; i--) {
            if (Math.hypot(head.x - food[i].x, head.y - food[i].y) < 40) {
                if (head.value >= food[i].value) {
                    p1.segments.push(new Cube(head.x, head.y, food[i].value));
                    food.splice(i, 1);
                } else { p1.dead = true; }
            }
        }
        for (let p2 of all) {
            if (p1 === p2 || p2.dead) continue;
            for (let j = 0; j < p2.segments.length; j++) {
                let seg = p2.segments[j];
                if (Math.hypot(head.x - seg.x, head.y - seg.y) < 42) {
                    if (head.value > seg.value) {
                        actions.push({ thief: p1, victim: p2, idx: j, val: seg.value });
                    } else if (head.value < seg.value) { p1.dead = true; }
                }
            }
        }
    }
    actions.forEach(a => {
        if (!a.victim.dead && a.victim.segments[a.idx]) {
            a.thief.segments.push(new Cube(a.thief.segments[0].x, a.thief.segments[0].y, a.val));
            a.victim.segments.splice(a.idx, 1);
            if (a.victim.segments.length === 0) a.victim.dead = true;
        }
    });
    if (player.dead) handleDeath();
    npcs = npcs.filter(n => !n.dead);
    while(npcs.length < 15) npcs.push(new Entity((Math.random()-0.5)*4000, (Math.random()-0.5)*4000, "Elite_Bot", true));
}

function draw() {
    if(gameActive) {
        camera.x += (player.segments[0].x - canvas.width/2 - camera.x) * 0.1;
        camera.y += (player.segments[0].y - canvas.height/2 - camera.y) * 0.1;
        ctx.fillStyle = "#0b0b0b"; ctx.fillRect(0,0,canvas.width, canvas.height);
        ctx.strokeStyle = "#1a1a1a";
        for(let i=-WORLD_SIZE; i<=WORLD_SIZE; i+=100) {
            ctx.beginPath(); ctx.moveTo(i-camera.x, -WORLD_SIZE-camera.y); ctx.lineTo(i-camera.x, WORLD_SIZE-camera.y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-WORLD_SIZE-camera.x, i-camera.y); ctx.lineTo(WORLD_SIZE-camera.x, i-camera.y); ctx.stroke();
        }
        while(food.length < 250) food.push(new Cube((Math.random()-0.5)*WORLD_SIZE*2, (Math.random()-0.5)*WORLD_SIZE*2, Math.random() > 0.9 ? 8 : 2));
        food.forEach(f => f.draw(camera.x, camera.y));
        let all = [player, ...npcs];
        all.forEach(p => { p.update(all); p.segments.slice().reverse().forEach((s, i) => s.draw(camera.x, camera.y, i === p.segments.length-1 ? p.name : null)); });
        processCollisions();
        let sorted = all.sort((a,b) => b.segments[0].value - a.segments[0].value).slice(0, 10);
        document.getElementById('lb-list').innerHTML = sorted.map(e => `<div class="lb-item ${e === player ? 'lb-me' : ''}"><span>${e.name}</span><span>${e.segments[0].value}</span></div>`).join('');
    }
    requestAnimationFrame(draw);
}

window.addEventListener('mousemove', e => { 
    if(gameActive) player.angle = Math.atan2(e.clientY + camera.y - player.segments[0].y, e.clientX + camera.x - player.segments[0].x);
});

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

canvas.width = window.innerWidth; 
canvas.height = window.innerHeight;
draw();