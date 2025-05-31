/***************************************************
 1. CONFIG & SCALE GENERATION
 ***************************************************/
const SCALE_CFG = {
    segments: 36,           // total tick steps
    longEvery: 9,           // every 4‑th tick is long + label
    minDb: -50,
    maxDb: 4,
    radiusTick: 92,
    radiusLabel: 114
};

function buildScale(container, cfg = SCALE_CFG) {
    container.innerHTML = '';
    const fullAngle    = 90;
    const angleStep    = fullAngle / cfg.segments;
    const zeroDbIndex  = Math.round((0 - cfg.minDb) / (cfg.maxDb - cfg.minDb) * cfg.segments);

    for (let i = 0; i <= cfg.segments; i++) {
        const angle  = -45 + angleStep * i;
        const isLong = i % cfg.longEvery === 0;

        const t = document.createElement('div');
        t.className = 'tick ' + (isLong ? 'long' : 'short');
        if (i >= zeroDbIndex) t.classList.add('hot');
        t.style.transform = `rotate(${angle}deg) translateY(-${cfg.radiusTick}px)`;
        container.appendChild(t);

        if (isLong) {
            const lbl = document.createElement('div');
            lbl.className = 'label';
            if (i >= zeroDbIndex) lbl.classList.add('hot-label');
            // lbl.textContent = (cfg.minDb + ((cfg.maxDb - cfg.minDb) / (cfg.segments / cfg.longEvery)) * (i / cfg.longEvery)).toFixed(1);
            // 1. Считаем реальное dB-значение:
            const dbValue = cfg.minDb + ((cfg.maxDb - cfg.minDb) / (cfg.segments / cfg.longEvery)) * (i / cfg.longEvery);
            // 2. Определяем знак ('+' для >=0, иначе пустая строка)
            const sign = dbValue >= 0 ? '+' : '';
            // 3. Подставляем вместе с округлением до одного знака после запятой
            lbl.textContent = sign + dbValue.toFixed(1);
            lbl.style.transform =
                `rotate(${angle}deg) translateY(-${cfg.radiusLabel}px) rotate(${-angle}deg)`;
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
 3. ПЕРЕНОС GAIN ЛОГИКИ НА KNOB с конфигом
 ***************************************************/
const KNOB_CFG = {
    gainMin:      1.0,    // минимальное усиление
    gainMax:      7.0,    // максимальное усиление
    defaultGain:  2.0,    // хотим начать с 2.5×
    angleMin:    -135,    // угол (°) для gainMin
    angleMax:     135,    // угол (°) для gainMax
    sensitivity:   0.8    // «чувствительность» (градусы на пиксель ΔY)
};

// Инициализируем gain из дефолта
let gain = KNOB_CFG.defaultGain;

const knobEl       = document.getElementById('knob');
const gainDisplay  = document.getElementById('gain-display');

function gainToAngle(g) {
    const t = (g - KNOB_CFG.gainMin) / (KNOB_CFG.gainMax - KNOB_CFG.gainMin);
    return KNOB_CFG.angleMin + (KNOB_CFG.angleMax - KNOB_CFG.angleMin) * t;
}
function angleToGain(angle) {
    const t = (angle - KNOB_CFG.angleMin) / (KNOB_CFG.angleMax - KNOB_CFG.angleMin);
    return KNOB_CFG.gainMin + (KNOB_CFG.gainMax - KNOB_CFG.gainMin) * t;
}

knobEl.style.transform = `rotate(${gainToAngle(gain)}deg)`;
gainDisplay.textContent = `×${gain.toFixed(1)}`;

// 3.1. Сгенерируем насечки (notches) ровно по окружности Knob
const notchCount = 24;
// Полный размер шайбы (knob) — 60×60px, центр в (30,30), хотим
// поместить ночки на радиус ~26px (чтобы они доходили до края шайбы).
const knobRadius = 32;           // половина ширины/высоты #knob
const notchHalfHeight = 8 / 2;   // половина высоты ночки = 4px
const notchRadius = knobRadius - notchHalfHeight; // ≈ 26px

// Устанавливаем Knob в нужный начальный угол:
knobEl.style.transform = `rotate(${gainToAngle(gain)}deg)`;
// И сразу показываем на дисплее:
gainDisplay.textContent = `×${gain.toFixed(1)}`;

for (let i = 0; i < notchCount; i++) {
    const notch = document.createElement('div');
    notch.className = 'notch';
    // Угол каждой ночки вокруг центра шайбы
    const angle = (360 / notchCount) * i;
    // Сначала поворачиваем notch на этот угол, затем смещаем вверх (по локальной Y) на notchRadius.
    // Порядок: rotate(angle) → translateY(-notchRadius)
    notch.style.transform = `rotate(${angle}deg) translateY(-${notchRadius}px)`;
    knobEl.appendChild(notch);
}

let isDragging  = false;
let startY      = 0;
let startAngle  = 0;

knobEl.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDragging = true;
    startY      = e.clientY;
    const style  = window.getComputedStyle(knobEl);
    const tr     = style.getPropertyValue('transform');
    const values = tr.split('(')[1].split(')')[0].split(',');
    const a = parseFloat(values[0]);
    const b = parseFloat(values[1]);
    startAngle = Math.atan2(b, a) * (180 / Math.PI);
    document.body.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const delta = startY - e.clientY;
    let newAngle = startAngle + delta * KNOB_CFG.sensitivity;
    if (newAngle < KNOB_CFG.angleMin) newAngle = KNOB_CFG.angleMin;
    if (newAngle > KNOB_CFG.angleMax) newAngle = KNOB_CFG.angleMax;
    knobEl.style.transform = `rotate(${newAngle}deg)`;

    gain = angleToGain(newAngle);
    gainDisplay.textContent = `×${gain.toFixed(1)}`;
});

window.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        document.body.style.cursor = 'default';
    }
});

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
 5. ФИЗИЧЕСКАЯ МОДЕЛЬ СТРЕЛОЧНОГО VU-МЕТРА
 ***************************************************/

/**
 * Описание модели:
 *
 * Мы рассматриваем стрелочный VU-метр как механическую систему:
 *   J * θ̈ + b * θ̇ + K * θ = G * I(t)
 *
 * где:
 *   - θ(t)    — угол отклонения стрелки (в радианах);
 *   - θ̇, θ̈   — первая и вторая производные угла (рад/с и рад/с²);
 *   - J       — момент инерции вращающейся части (стрелка + рамка);
 *   - b       — коэффициент демпфирования (Н·м·с/рад);
 *   - K       — жесткость пружины (Н·м/рад);
 *   - G       — электромеханический коэффициент: момент на 1 А тока (Н·м/А);
 *   - I(t)    — ток через катушку (А), пропорционален аудио-сигналу.
 *
 * Простейшая численная схема интегрирования:
 *   θ̈ = (G*I(t) - b*θ̇ - K*θ) / J
 *   θ̇_new = θ̇_old + θ̈ * Δt
 *   θ_new = θ_old + θ̇_new * Δt
 *
 * После вычисления θ(t) (в радианах) конвертируем его в градусы:
 *   θ_deg = θ_rad * (180 / Math.PI)
 * и применяем к CSS-transform стрелки.
 *
 * Чтобы эти Уравнения соответствовали реальному VU-метру, нужно подобрать
 * J, b, K, G и связь I ↔ rms-сигнал. Ниже приведены ориентировочные
 * параметры, основанные на реальных измерителях:
 *
 *   - 0 VU соответствует +4 dBu ≈ 1.228 В RMS на входе,
 *     что через сопротивление ~3.9 кΩ даёт ~0.000315 А (~0.315 мА) в катушке.
 *   - Максимум шкалы +4 dB (от minDb = -50 dB) задаёт угол +45°.
 *   - Минимум шкалы -50 dB задаёт угол -45°.
 *
 * Мы введём:
 *   I0_VU = 0.000315  // ток, соответствующий 0 dBU (0 VU)
 *   maxDb  = SCALE_CFG.maxDb   // +4 dB
 *   minDb  = SCALE_CFG.minDb   // -50 dB
 *
 *   I_max = I0_VU * 10^(maxDb / 20)  // ток для +4 dB
 *
 * Расчёты параметров:
 *   K выбираем так, чтобы при I_max стрелка была под углом +45° = π/4 рад:
 *     K = (G * I_max) / (π/4) = 4 * G * I_max / π
 *
 *   Далее момент инерции J можно взять из измерений (~6.4е-6 кг·м²).
 *   Для демпфирования b задаём желаемый коэффициент демпфирования ζ ≈ 0.8–0.9:
 *     b = 2 * ζ * sqrt(K * J)
 *
 *   Эти параметры создают «баллистику» ~300 мс до 99% и overshoot ~1%.
 *
 * После этого на каждом кадре (Δt ≈ 1/60 с) мы:
 *   1) считываем rms (0..1),
 *   2) вычисляем текущий уровень dB = 20*log10(rms * gain),
 *   3) вычисляем I(t) линейно: I = I0_VU * 10^(dB / 20),
 *      или проще I = I0_VU * (rms * gain), если считать «0 dB» рівным rms*gain=1.
 *      Здесь мы используем эквивалент: I = I0_VU * (rms * gain), при этом
 *      в расчетах K участвовал I_max = I0_VU * 10^(maxDb/20), что гарантирует,
 *      что при rms*gain = 10^(maxDb/20) стрелка ≈ +45°.
 *
 *   4) находим θ̈, обновляем θ̇, обновляем θ,
 *   5) конвертируем θ (рад) → θ_deg и ограничиваем диапазон [-45°, +45°],
 *   6) применяем transform к needles[ch].
 *   7) обновляем текст статуса дБ.
 *
 * Ниже — реализация.
 */

// 5.1. ФИЗИЧЕСКИЕ КОНСТАНТЫ (ориентировочные)

const PHYS = {
    // Момент инерции (стрелка + рамка), кг·м² (прим. 6.4е-6 — реальное значение из измерений)
    // J: 6.4e-6            init value
    J: 8.0e-4,

    // Электромеханический коэффициент катушки (Н·м/А), зависит от числа витков и магнита.
    // Пример: G ≈ 0.08 Н·м/А (подбиралось экспериментально для реальных VU-метров)
    // G: 0.08              init value
    G: 0.12,

    // Жесткость пружины K (Н·м/рад). Будет пересчитана ниже на основе G и I_max.
    // K: null              init value
    K: null,

    // Коэффициент демпфирования b (Н·м·с/рад). Будет рассчитан ниже.
    // b: null              init value
    b: null,

    // Желаемый коэффициент демпфирования (доля критического), ζ ≈0.8…0.9
    // zeta: 0.85           init value
    zeta: 0.85, //init value

    // Максимальный уровень шкалы, дБ (SCALE_CFG.maxDb = +4 dB, например)
    dB_max: SCALE_CFG.maxDb, //init value

    // Минимальный уровень шкалы, дБ (SCALE_CFG.minDb = -50 dB, например)
    dB_min: SCALE_CFG.minDb //init value
};

// Рассчитаем K, чтобы при токе I_max стрелка отклонялась на π/4 рад (+45°):
//    G * I_max = K * (π/4)  ⇒  K = 4 * G * I_max / π
PHYS.K = (2 * PHYS.G) / Math.PI;

// Рассчитаем критическое демпфирование: b_crit = 2 * sqrt(K * J)
const b_crit = 2 * Math.sqrt(PHYS.K * PHYS.J);

// А теперь задаем фактический b = ζ * b_crit
PHYS.b = PHYS.zeta * b_crit;

// Удобно вычислить некоторые вспомогательные константы:
PHYS.invJ = 1 / PHYS.J;               // чтобы быстрее делить в цикле
PHYS.rad2deg = 180 / Math.PI;         // преобразование радиан → градусы
PHYS.maxAngleRad = Math.PI / 4;       // максимальный угол +π/4 рад (+45°)
PHYS.minAngleRad = -Math.PI / 4;      // минимальный угол –π/4 рад (–45°)


/***************************************************
 6. СОСТОЯНИЕ СТРЕЛОК (θ и θ̇)
 ***************************************************/
// Для каждого канала храним:
//   θ_rad   — текущий угол стрелки (в радианах)
//   omega   — текущая угловая скорость θ̇ (в рад/с)
const needleStatePhys = {
    L: { theta: PHYS.minAngleRad, omega: 0 },
    R: { theta: PHYS.minAngleRad, omega: 0 }
};


/***************************************************
 7. ФУНКЦИЯ ОБНОВЛЕНИЯ ФИЗИКИ СТРЕЛКИ
 ***************************************************/

/**
 * Обновляем физическую модель для одной стрелки:
 *
 * @param {string} ch      — 'L' или 'R'
 * @param {number} rms     — текущее RMS-среднее (от 0 до 1) для канала
 * @param {number} dt      — шаг по времени (с), обычно ~1/60
 */
function updateNeedlePhysics(ch, rms, dt) {
    // 1) Вычисляем уровень в dB (относительно Unity-сигнала).
    //    Если rms*gain < 1e-6, чтобы не логарифмировать 0, используем маленькое значение.
    const linVal = rms * gain;
    const eps = 1e-6;
    const db = 20 * Math.log10(Math.max(linVal, eps));

    // 2) Вычисляем ток I через катушку.
    //    Мы используем линейную связь: I = I0_VU * (rms * gain).
    //    При rms*gain = 1 ток = I0_VU (0 dB). При rms*gain = 10^(dB_max/20) ток = I_max.
    const rawDb = 20 * Math.log10(Math.max(rms * gain, 1e-6));
    let nt = (rawDb - PHYS.dB_min) / (PHYS.dB_max - PHYS.dB_min);
    if (nt < 0) nt = 0;
    if (nt > 1) nt = 1;
    const I_t = nt;


    // 3) Вычисляем угловое ускорение (θ̈) по уравнению:
    //       θ̈ = ( G * I_t - b * θ̇ - K * θ ) / J
    const state = needleStatePhys[ch];
    const torque   = PHYS.G * I_t;              // М_e = G * I
    const springM = PHYS.K * (state.theta - PHYS.minAngleRad);
    const dampM    = PHYS.b * state.omega;      // M_damp = b * θ̇
    const alpha    = (torque - springM - dampM) * PHYS.invJ;  // θ̈ (рад/с²)

    // 4) Численно интегрируем:
    state.omega += alpha * dt;          // θ̇_new = θ̇_old + θ̈ * dt
    state.theta += state.omega * dt;    // θ_new = θ_old + θ̇_new * dt

    // 5) Ограничиваем угол работы стрелки (rad):
    if (state.theta > PHYS.maxAngleRad) {
        state.theta = PHYS.maxAngleRad;
        state.omega = 0;  // «жесткая» граница: сбрасываем скорость
    }
    if (state.theta < PHYS.minAngleRad) {
        state.theta = PHYS.minAngleRad;
        state.omega = 0;
    }

    // 6) Перевод в градусы и применяем CSS-трансформ к стрелке:
    const thetaDeg = state.theta * PHYS.rad2deg;
    needles[ch].style.transform = `rotate(${thetaDeg}deg)`;

    // 7) Обновляем текстовый индикатор dB (округляя до одной цифры после запятой):
    statuses[ch].textContent = db.toFixed(1) + ' dB';
}

/**
 * Обновляем физическую модель стрелки:
 *
 * @param {string} ch      — 'L' или 'R'
 * @param {number} rms     — текущее RMS-среднее (0…1) для канала
 * @param {number} dt      — шаг по времени (с), обычно ~1/60
 */

/***************************************************
 8. MAIN LOOP ДЛЯ ОТРИСОВКИ И ФИЗИКИ
 ***************************************************/
let lastTimestamp = null;

function loopPhysics(timestamp) {
    if (lastTimestamp === null) {
        lastTimestamp = timestamp;
    }
    // dt в секундах (ограничиваем, чтобы не было «скачков» при больших задержках)
    let dt = (timestamp - lastTimestamp) / 1000;
    if (dt > 0.1) dt = 0.1;
    lastTimestamp = timestamp;

    // Получаем RMS для левого и правого каналов
    const rmsL = getRMS(analyserL);
    const rmsR = getRMS(analyserR);

    // Обновляем физическую модель стрелок
    updateNeedlePhysics('L', rmsL, dt);
    updateNeedlePhysics('R', rmsR, dt);

    // Следующий кадр
    requestAnimationFrame(loopPhysics);
}

/***************************************************
 9. ИНИЦИАЛИЗАЦИЯ АУДИО И СТАРТ ЦИКЛА
 ***************************************************/
(async function initAudio() {
    try {
        // Захватываем системный звук (loop-back) + экран (обязателен video:true)
        const stream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: true
        });

        // Видео нам не нужно, останавливаем треки
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

        // Стартуем главный цикл с физикой
        requestAnimationFrame(loopPhysics);
    } catch (err) {
        console.error('Audio init error:', err);
    }
})();

/***************************************************
 10. УВЕЛИЧЕНИЕ МАСШТАБА ПРИ ВРАЩЕНИИ КОЛЁСИКА МЫШИ
 ***************************************************/
(() => {
    const root = document.getElementById('root'); // или document.querySelector('.wrapper')
    if (!root) return;

    let scale = 1;                   // начальный масштаб
    const minScale = 0.5;            // минимальный
    const maxScale = 3;              // максимальный
    const step = 0.1;                // за один «открут» колеса

    window.addEventListener('wheel', e => {
        // Если хотите масштаб только при зажатом Ctrl:
        // if (!e.ctrlKey) return;

        // предотвращаем скролл
        e.preventDefault();

        // e.deltaY > 0 — прокрутка вниз → уменьшаем
        scale += e.deltaY < 0 ? step : -step;
        scale = Math.min(Math.max(scale, minScale), maxScale);

        root.style.transform = `scale(${scale})`;
    }, { passive: false });
})();