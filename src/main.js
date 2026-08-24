import './style.css'

const app = document.querySelector('#app')

app.innerHTML = `
  <main>
    <section class="intro-sequence" id="top" aria-labelledby="hero-title">
      <div class="hero">
      <video class="hero__video" autoplay loop playsinline preload="auto" crossorigin="anonymous"></video>
      <div class="hero__veil"></div>
      <div class="grain" aria-hidden="true"></div>
      <div class="grain grain--react" aria-hidden="true"></div>
      <div class="grain-focus" aria-hidden="true"></div>
      <div class="eclipse" aria-hidden="true"></div>
      <canvas class="particles" aria-hidden="true"></canvas>
      <header class="navbar">
        <a class="wordmark" href="#top" aria-label="Auralis home"><span class="wordmark__mark">◌</span>AURALIS</a>
        <button class="menu-button" type="button" aria-label="Open menu"><span></span><span></span><span></span></button>
      </header>
      <div class="hero__content">
        <h1 id="hero-title">Is silence silent?</h1>
        <p class="hero__intro">for a lot it isn&rsquo;t,</p>
      </div>
      <div class="hero__audio">
        <div class="wave-panel">
          <canvas class="wave" aria-hidden="true"></canvas>
        </div>
        <button class="sound-toggle" type="button" aria-pressed="true" aria-label="Mute sound">sound on</button>
      </div>
      <div class="pause-message" aria-live="polite">
        <p class="pause-message__eyebrow">A different kind of silence</p>
        <h2><span class="pause-message__first-line">It was easy for you to pause.</span><em>For most people, it isn&rsquo;t.</em></h2>
        <p class="pause-message__body">For people living with tinnitus, sound can continue long after everything else goes quiet.</p>
      </div>
      </div>
    </section>
  </main>
`

const hero = document.querySelector('.hero')
const introSequence = document.querySelector('.intro-sequence')
const heroVideo = document.querySelector('.hero__video')
const soundToggle = document.querySelector('.sound-toggle')
const canvas = document.querySelector('.wave')
const ctx = canvas.getContext('2d')
const particleCanvas = document.querySelector('.particles')
const particleCtx = particleCanvas.getContext('2d')

heroVideo.src = '/hero.mp4'
heroVideo.volume = 0.32

let audioCtx = null
let analyser = null
let gainNode = null
let soundOn = true
let W = 0
let H = 0
let energy = 0
let particleWidth = 0
let particleHeight = 0
let particles = []
const particlePointer = { x: -1000, y: -1000 }
const timeDomain = new Uint8Array(2048)
const freqDomain = new Uint8Array(1024)

const WAVES = [
  { amp: 1.0, freq: 0.0028, speed: 0.00055, phase: 0.0, alpha: 0.55 },
  { amp: 0.62, freq: 0.0055, speed: 0.00085, phase: 1.2, alpha: 0.28 },
  { amp: 0.4, freq: 0.011, speed: 0.00135, phase: 2.4, alpha: 0.16 },
]

const setMuteUI = (on) => {
  soundOn = on
  soundToggle.textContent = on ? 'sound on' : 'sound off'
  soundToggle.setAttribute('aria-pressed', String(on))
  soundToggle.setAttribute('aria-label', on ? 'Mute sound' : 'Unmute sound')
  soundToggle.classList.toggle('is-muted', !on)
  if (gainNode && audioCtx) {
    gainNode.gain.setTargetAtTime(on ? 1 : 0, audioCtx.currentTime, 0.04)
  }
}

const ensureAudioGraph = async () => {
  if (!audioCtx) {
    audioCtx = new AudioContext()
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.8
    gainNode = audioCtx.createGain()
    gainNode.gain.value = soundOn ? 1 : 0
    const source = audioCtx.createMediaElementSource(heroVideo)
    // Analyse before mute so the wave still reads the signal when gain is 0
    source.connect(analyser)
    analyser.connect(gainNode)
    gainNode.connect(audioCtx.destination)
  }
  if (audioCtx.state === 'suspended') await audioCtx.resume()
}

const unlockPlayback = async () => {
  try {
    await ensureAudioGraph()
    if (heroVideo.paused) await heroVideo.play()
    setMuteUI(true)
  } catch {
    /* wait */
  }
}

heroVideo
  .play()
  .then(() => ensureAudioGraph().then(() => setMuteUI(true)).catch(() => {}))
  .catch(() => {
    setMuteUI(false)
    window.addEventListener('pointerdown', unlockPlayback, { once: true, passive: true })
    window.addEventListener('keydown', unlockPlayback, { once: true })
  })

soundToggle.addEventListener('click', async () => {
  await ensureAudioGraph()
  if (heroVideo.paused) await heroVideo.play()
  setMuteUI(!soundOn)
})

const resize = () => {
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  const cssW = canvas.clientWidth
  const cssH = canvas.clientHeight
  W = cssW
  H = cssH
  canvas.width = Math.round(cssW * ratio)
  canvas.height = Math.round(cssH * ratio)
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)

  particleWidth = window.innerWidth
  particleHeight = window.innerHeight
  particleCanvas.width = Math.round(particleWidth * ratio)
  particleCanvas.height = Math.round(particleHeight * ratio)
  particleCtx.setTransform(ratio, 0, 0, ratio, 0, 0)
  const particleCount = Math.min(180, Math.max(110, Math.round(particleWidth / 11)))
  particles = Array.from({ length: particleCount }, () => ({
    x: particleWidth * (0.04 + Math.random() * 0.92),
    baseY: particleHeight * 0.5 + (Math.random() - 0.5) * 180,
    size: 1.15 + Math.random() * 2.05,
    speedX: 0.16 + Math.random() * 0.24,
    waveAmplitude: 26 + Math.random() * 52,
    wavePhase: Math.random() * Math.PI * 2,
    offsetX: 0,
    offsetY: 0,
    opacity: 0.1 + Math.random() * 0.16,
  }))
}

const readEnergy = () => {
  if (!analyser || !soundOn) return 0

  analyser.getByteTimeDomainData(timeDomain)
  analyser.getByteFrequencyData(freqDomain)

  let sum = 0
  for (let i = 0; i < timeDomain.length; i++) {
    const v = (timeDomain[i] - 128) / 128
    sum += v * v
  }
  const rms = Math.sqrt(sum / timeDomain.length)

  let bass = 0
  const band = Math.floor(freqDomain.length * 0.25)
  for (let i = 0; i < band; i++) bass += freqDomain[i]
  bass = bass / band / 255

  return Math.min(1, rms * 5.5 + bass * 0.85)
}

const draw = (ts) => {
  ctx.clearRect(0, 0, W, H)

  const target = soundOn ? Math.max(0.12, readEnergy()) : 0.08
  energy += (target - energy) * (soundOn ? 0.18 : 0.06)

  const cx = W / 2
  const cy = H / 2
  const lineW = W * 0.92
  const startX = cx - lineW / 2
  const baseAmp = H * (soundOn ? 0.16 + energy * 0.28 : 0.1)
  const speedMul = soundOn ? 1 + energy * 2.4 : 0.55

  // Soft resting hairline
  ctx.beginPath()
  ctx.moveTo(startX, cy)
  ctx.lineTo(startX + lineW, cy)
  ctx.strokeStyle = 'rgba(236, 233, 226, 0.2)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Moving strands — always animated; louder audio = taller + faster
  for (const w of WAVES) {
    ctx.beginPath()
    ctx.lineWidth = 1
    ctx.strokeStyle = `rgba(236, 233, 226, ${w.alpha * (soundOn ? 0.9 + energy * 0.35 : 0.75)})`
    for (let x = 0; x <= lineW; x++) {
      const nx = x / lineW
      const ef = Math.sin(nx * Math.PI)
      const y =
        cy +
        Math.sin(nx * Math.PI * 2 * w.freq * lineW + w.phase + ts * w.speed * 1000 * speedMul) *
          baseAmp *
          w.amp *
          ef
      if (x === 0) ctx.moveTo(startX + x, y)
      else ctx.lineTo(startX + x, y)
    }
    ctx.stroke()
  }

  // Live audio imprint — only when sound is on
  if (soundOn && analyser) {
    analyser.getByteTimeDomainData(timeDomain)
    const samples = timeDomain.length
    ctx.beginPath()
    ctx.lineWidth = 1
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 + energy * 0.4})`
    for (let i = 0; i < samples; i++) {
      const nx = i / (samples - 1)
      const ef = Math.sin(nx * Math.PI)
      const v = timeDomain[i] / 128 - 1
      const y = cy + v * H * 0.32 * ef * (0.35 + energy)
      const x = startX + nx * lineW
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
}

const frame = (ts) => {
  draw(ts)
  requestAnimationFrame(frame)
}

const drawParticles = (timestamp) => {
  particleCtx.clearRect(0, 0, particleWidth, particleHeight)

  for (const particle of particles) {
    const waveY =
      particle.baseY +
      Math.sin(timestamp * 0.00055 + particle.wavePhase + particle.x * 0.009) * particle.waveAmplitude
    const visibleX = particle.x + particle.offsetX
    const visibleY = waveY + particle.offsetY
    const deltaX = visibleX - particlePointer.x
    const deltaY = visibleY - particlePointer.y
    const distance = Math.hypot(deltaX, deltaY)

    if (distance < 130 && distance > 0) {
      const force = (1 - distance / 130) * 1.1
      particle.offsetX += (deltaX / distance) * force
      particle.offsetY += (deltaY / distance) * force
    }

    particle.x += particle.speedX
    particle.offsetX *= 0.94
    particle.offsetY *= 0.94

    if (particle.x < -8) particle.x = particleWidth + 8
    if (particle.x > particleWidth + 8) particle.x = -8

    particleCtx.beginPath()
    particleCtx.arc(visibleX, visibleY, particle.size, 0, Math.PI * 2)
    particleCtx.fillStyle = `rgba(236, 233, 226, ${particle.opacity})`
    particleCtx.fill()
  }

  requestAnimationFrame(drawParticles)
}

resize()
window.addEventListener('resize', resize, { passive: true })
requestAnimationFrame(frame)

const updateScrollTransition = () => {
  const bounds = introSequence.getBoundingClientRect()
  const scrollLength = introSequence.offsetHeight - window.innerHeight
  const progress = Math.min(1, Math.max(0, -bounds.top / scrollLength))
  const eclipseProgress = Math.min(1, progress / 0.5)
  const messageProgress = Math.min(1, Math.max(0, (progress - 0.56) / 0.18))
  const controlsOpacity = 1 - Math.min(1, progress / 0.32)

  hero.style.setProperty('--eclipse-scale', String(eclipseProgress))
  hero.style.setProperty('--message-opacity', String(messageProgress))
  hero.style.setProperty('--message-shift', `${(1 - messageProgress) * 24}px`)
  hero.style.setProperty('--hero-ui-opacity', String(controlsOpacity))
}

updateScrollTransition()
window.addEventListener('scroll', updateScrollTransition, { passive: true })
window.addEventListener('resize', updateScrollTransition, { passive: true })

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const finePointer = window.matchMedia('(pointer: fine)').matches

if (!reduceMotion) requestAnimationFrame(drawParticles)

if (!reduceMotion && finePointer) {
  let targetX = window.innerWidth * 0.5
  let targetY = window.innerHeight * 0.45
  let currentX = targetX
  let currentY = targetY
  let active = false
  let raf = 0

  const paintGrain = () => {
    currentX += (targetX - currentX) * 0.12
    currentY += (targetY - currentY) * 0.12
    hero.style.setProperty('--mx', `${currentX}px`)
    hero.style.setProperty('--my', `${currentY}px`)
    const settled =
      Math.abs(targetX - currentX) < 0.2 && Math.abs(targetY - currentY) < 0.2
    if (!settled || active) raf = requestAnimationFrame(paintGrain)
    else raf = 0
  }

  const kick = () => {
    if (!raf) raf = requestAnimationFrame(paintGrain)
  }

  hero.addEventListener(
    'pointermove',
    (event) => {
      const rect = hero.getBoundingClientRect()
      targetX = event.clientX - rect.left
      targetY = event.clientY - rect.top
      particlePointer.x = targetX
      particlePointer.y = targetY
      if (!active) {
        active = true
        hero.classList.add('hero--grain-active')
      }
      kick()
    },
    { passive: true },
  )

  hero.addEventListener('pointerleave', () => {
    active = false
    particlePointer.x = -1000
    particlePointer.y = -1000
    hero.classList.remove('hero--grain-active')
    kick()
  })
}
