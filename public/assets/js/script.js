/***************************************************
 1. CONFIG & SCALE GENERATION
 ***************************************************/
const SCALE_CFG = {
    segments: 40,           // total tick steps
    longEvery: 9,           // every 4‑th tick is long + label
    minDb: -50,
    maxDb: 4,
    radiusTick: 92,
    radiusLabel: 114
};

function buildScale(container, cfg = SCALE_CFG) {
    container.innerHTML = '';
    const fullAngle = 90;
    const angleStep = fullAngle / cfg.segments;
    const groups = cfg.segments / cfg.longEvery;
    const dbStep = (cfg.maxDb - cfg.minDb) / groups;

    for (let i = 0; i <= cfg.segments; i++) {
        const angle = -45 + angleStep * i;
        const isLong = i % cfg.longEvery === 0;

        const t = document.createElement('div');
        t.className = 'tick ' + (isLong ? 'long' : 'short');
        t.style.transform = `rotate(${angle}deg) translateY(-${cfg.radiusTick}px)`;
        container.appendChild(t);

        if (isLong) {
            const lbl = document.createElement('div');
            lbl.className = 'label';
            lbl.textContent = (cfg.minDb + dbStep * (i / cfg.longEvery)).toFixed(1).toString();
            lbl.style.transform = `rotate(${angle}deg) translateY(-${cfg.radiusLabel}px) rotate(${-angle}deg)`;
            container.appendChild(lbl);
        }
    }
}

// Draw scales once DOM ready
buildScale(document.getElementById('ticksL'));
buildScale(document.getElementById('ticksR'));

/***************************************************
 2. NEEDLES & STATUS
 ***************************************************/
const needles = {
    L: document.getElementById('needleL'),
    R: document.getElementById('needleR')
};
const statuses = {
    L: document.getElementById('statusL'),
    R: document.getElementById('statusR')
};

/***************************************************
 3. GAIN SLIDER (global)
 ***************************************************/
let gain = 2;

/***************************************************
 4. AUDIO SET‑UP & LOOP
 ***************************************************/
let audioCtx, analyserL, analyserR;

function getRMS(analyser) {
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const v of data) {
        const x = (v - 128) / 128;
        sum += x * x;
    }
    return Math.sqrt(sum / data.length);
}

const minDb = SCALE_CFG.minDb;   //  –20
const maxDb = SCALE_CFG.maxDb;   //  +10
const dbRange = maxDb - minDb;   //   30

/***************************************************
 5.  РЕАЛЬНАЯ «БАЛЛИСТИКА» СТРЕЛКИ
 ***************************************************/
const NEEDLE_DYNAMICS = {
    attackTime: 0.025,   // 60 мс до 99 % ⇒ «быстро реагирует»
    releaseTime: 0.025    // 400 мс до 36 % ⇒ медленнее падает
};

// внутреннее состояние (угол) — по-отдельности для L/R
const needleState = {L: {angle: -45}, R: {angle: -45}};

// предрасчитанные коэффициенты фильтра IIR
let attackCoeff, releaseCoeff;

function recalcCoeffs() {
    // k = e^(−dt/τ),  dt ≈ 1/60 с (кадр)
    const dt = 1 / 60;
    attackCoeff = Math.exp(-dt / NEEDLE_DYNAMICS.attackTime);
    releaseCoeff = Math.exp(-dt / NEEDLE_DYNAMICS.releaseTime);
}

recalcCoeffs();

/* дБ → угол */

function dbToAngle(db) {
    const p = (db - SCALE_CFG.minDb) / dbRange;
    return -45 + 90 * Math.min(1, Math.max(0, p));
}

function animateNeedle(ch, rms) {
    const db = 20 * Math.log10((rms * gain) || 1e-6);
    const target = dbToAngle(db);

    const state = needleState[ch];
    const coeff = target > state.angle ? attackCoeff : releaseCoeff;
    state.angle = target + (state.angle - target) * coeff;

    // anime.js только для плавного CADR-interpol (80 мс ≈ 5 кадров)
    anime({
        targets: needles[ch],
        rotate: state.angle,
        duration: 80,
        easing: 'linear'
    });

    statuses[ch].textContent = db.toFixed(1) + ' dB';
}

/* Если нужно «на лету» менять плавность — просто меняем
   NEEDLE_DYNAMICS.attackTime / releaseTime и зовём recalcCoeffs() */

/***************************************************
 6. MAIN LOOP
 ***************************************************/

function loop() {
    requestAnimationFrame(loop);
    animateNeedle('L', getRMS(analyserL));
    animateNeedle('R', getRMS(analyserR));
}

/***************************************************
 7. MAIN LOOP & AUDIO INIT
 ***************************************************/

(async function initAudio() {
    try {
        // Захватываем системный звук (loop-back) + любой экран
        const stream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: true    // обязателен в вызове!
        });

        // нам видео не нужно — сразу его отключаем
        stream.getVideoTracks().forEach(t => t.stop());
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        await audioCtx.resume();

        const source = audioCtx.createMediaStreamSource(stream);
        const splitter = audioCtx.createChannelSplitter(2);
        source.connect(splitter);

        analyserL = audioCtx.createAnalyser();
        analyserR = audioCtx.createAnalyser();
        analyserL.fftSize = analyserR.fftSize = 2048;
        splitter.connect(analyserL, 0);
        splitter.connect(analyserR, 1);

        loop();  // ваш существующий цикл animateNeedle/getRMS
    } catch (err) {
        console.error('Audio init error:', err);
    }
})();