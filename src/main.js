import './styles/main.css'
import introSrc from './assets/clock_latest.mp4'
import loopSrc from './assets/clock_loop.mp4'

const video = document.getElementById('bg-video')
if (video) {
  const loopEl = document.createElement('video')
  loopEl.muted = true
  loopEl.loop = true
  loopEl.playsInline = true
  loopEl.preload = 'auto'
  loopEl.src = loopSrc
  video.parentNode.insertBefore(loopEl, video)

  video.src = introSrc
  video.loop = false
  video.play().catch(() => {})

  video.addEventListener('ended', () => {
    loopEl.currentTime = 0
    loopEl.play().catch(() => {})
    video.style.display = 'none'
  })

  function scaleAll() {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const vRatio = 16 / 9
    const wRatio = vw / vh
    const zoom = 1.47
    let w, h
    if (wRatio > vRatio) {
      w = vw * zoom
      h = w / vRatio
    } else {
      h = vh * zoom
      w = h * vRatio
    }
    const s = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      width: w + 'px',
      height: h + 'px',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none'
    }
    Object.assign(video.style, s)
    video.style.zIndex = '0'
    Object.assign(loopEl.style, s)
    loopEl.style.zIndex = '0'
  }

  scaleAll()
  video.addEventListener('loadedmetadata', scaleAll)
  loopEl.addEventListener('loadedmetadata', scaleAll)
  window.addEventListener('resize', scaleAll)
}

// Single-page panel navigation
const panels = {
  services: document.getElementById('services-panel'),
  voice: document.getElementById('voice-panel'),
  website: document.getElementById('website-panel'),
  leads: document.getElementById('leads-panel'),
  reviews: document.getElementById('reviews-panel'),
  pricing: document.getElementById('pricing-panel'),
  contact: document.getElementById('contact-panel'),
}

function closeAllPanels() {
  Object.values(panels).forEach(p => p.classList.remove('panel--open'))
}

function openPanel(name) {
  closeAllPanels()
  if (panels[name]) panels[name].classList.add('panel--open')
}

document.addEventListener('click', (e) => {
  // Handle data-section links
  const link = e.target.closest('[data-section]')
  if (link) {
    e.preventDefault()
    const section = link.dataset.section

    if (section === 'home') {
      closeAllPanels()
    } else if (section === 'services') {
      openPanel('services')
    } else if (section === 'reviews') {
      openPanel('reviews')
    } else if (section === 'pricing') {
      openPanel('pricing')
    } else if (section === 'contact') {
      openPanel('contact')
    }
    return
  }

  // Handle clicking service cards
  const card = e.target.closest('[data-service]')
  if (card) {
    const service = card.dataset.service
    if (service === 'voice') openPanel('voice')
    if (service === 'website') openPanel('website')
    if (service === 'leads') openPanel('leads')
  }
})

// Prevent brand link from reloading if on homepage
document.querySelectorAll('.brand').forEach(link => {
  link.addEventListener('click', (e) => {
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
      e.preventDefault()
    }
  })
})
