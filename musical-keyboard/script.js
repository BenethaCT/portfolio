const rows = [
    "QWERTYUIOP".split(''),
    "ASDFGHJKL".split(''),
    "ZXCVBNM".split('')
];
const scale = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5'];
let particles = [];
let currentTheme = { glow: '#00f2ff', hue: 180 };

// Audio Engine
const reverb = new Tone.Reverb(4).toDestination();
const synth = new Tone.PolySynth(Tone.Synth, {
    envelope: { attack: 0.05, release: 2 }
}).connect(reverb);

function setTheme(t) {
    if(t === 'neon') currentTheme = { glow: '#00f2ff', hue: 180 };
    if(t === 'fire') currentTheme = { glow: '#ff4500', hue: 0 };
    if(t === 'forest') currentTheme = { glow: '#00ff41', hue: 100 };
    document.documentElement.style.setProperty('--accent-color', currentTheme.glow);
}

// Generate Keyboard Rows
rows.forEach((row, i) => {
    const rowEl = document.getElementById(`row-${i + 1}`);
    row.forEach(char => {
        let div = document.createElement('div');
        div.className = 'key'; 
        div.id = 'key-' + char; 
        div.innerText = char;
        rowEl.appendChild(div);
    });
});

window.addEventListener('keydown', (e) => {
    Tone.start();
    const char = e.key.toUpperCase();
    const el = document.getElementById('key-' + char);
    
    if (el) {
        el.classList.add('active');
        setTimeout(() => el.classList.remove('active'), 200);
        document.getElementById('text-display').innerText = char;
        
        // Audio Logic
        const allKeys = rows.flat();
        const idx = allKeys.indexOf(char) % scale.length;
        synth.triggerAttackRelease(scale[idx], "8n");
        
        // Visual Logic
        particles.push(new Particle(random(width), random(height), idx));
    }
});

// P5.js Animation
function setup() { createCanvas(windowWidth, windowHeight); colorMode(HSB); }
function draw() {
    background(0, 0, 0, 0.1);
    particles.forEach((p, i) => { 
        p.update(); p.show(); 
        if(p.finished) particles.splice(i, 1); 
    });
}

class Particle {
    constructor(x, y, idx) {
        this.pos = createVector(x, y);
        this.vel = p5.Vector.random2D().mult(random(2, 6));
        this.life = 255;
        this.h = currentTheme.hue + (idx * 5);
    }
    update() { this.pos.add(this.vel); this.life -= 5; }
    show() {
        fill(this.h, 200, 255, this.life/255);
        drawingContext.shadowBlur = 20;
        drawingContext.shadowColor = currentTheme.glow;
        ellipse(this.pos.x, this.pos.y, 20);
    }
    get finished() { return this.life < 0; }
}