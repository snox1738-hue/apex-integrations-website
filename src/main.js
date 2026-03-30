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

// Smooth scroll with custom duration
function smoothScrollTo(container, targetY, duration = 1200) {
  const startY = container.scrollTop
  const diff = targetY - startY
  let startTime = null

  function step(time) {
    if (!startTime) startTime = time
    const progress = Math.min((time - startTime) / duration, 1)
    // ease-in-out cubic
    const ease = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2
    container.scrollTop = startY + diff * ease
    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

document.querySelectorAll('.top .nav__link, .top .brand').forEach(link => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href')
    if (href && href.startsWith('#')) {
      e.preventDefault()
      const target = document.querySelector(href)
      if (target) {
        const idx = sections.indexOf(target)
        if (idx !== -1) goToSection(idx)
      }
    }
  })
})

// Controlled page-by-page scroll
const scrollContainer = document.querySelector('.scroll-container')
const sections = Array.from(document.querySelectorAll('.section'))
const navLinks = document.querySelectorAll('.top .nav__link')

let currentIndex = 0
let isScrolling = false

function goToSection(index) {
  if (index < 0 || index >= sections.length || isScrolling) return
  isScrolling = true
  currentIndex = index
  updateActiveNav()
  // Reset all dividers immediately
  resetAllDividers()
  smoothScrollTo(scrollContainer, sections[index].offsetTop, 1200)
  // Draw the line AFTER the scroll finishes
  setTimeout(() => {
    animateDivider(index)
  }, 1250)
  setTimeout(() => { isScrolling = false }, 2700)
}

function resetAllDividers() {
  sections.forEach(s => {
    const d = s.querySelector('.section__divider')
    if (d) {
      d.classList.remove('section__divider--animate')
      d.style.transform = 'scaleX(0)'
    }
  })
}

function animateDivider(index) {
  const section = sections[index]
  const divider = section.querySelector('.section__divider')
  if (!divider) return

  // Force reflow then animate fresh
  divider.style.transform = 'scaleX(0)'
  void divider.offsetWidth
  divider.style.transform = ''
  divider.classList.add('section__divider--animate')
}

const leaveReviewBtnEl = document.getElementById('leave-review-btn')

function updateActiveNav() {
  const activeId = sections[currentIndex].id
  navLinks.forEach(link => {
    const href = link.getAttribute('href')
    if (href === '#' + activeId) {
      link.classList.add('nav__link--active')
    } else {
      link.classList.remove('nav__link--active')
    }
  })
  // Show leave-review button only on reviews section
  if (leaveReviewBtnEl) {
    leaveReviewBtnEl.classList.toggle('visible', activeId === 'reviews')
  }
}

// Wheel scroll — one section at a time, locked until done
scrollContainer.addEventListener('wheel', (e) => {
  e.preventDefault()
  if (isScrolling) return
  if (e.deltaY > 0) {
    goToSection(currentIndex + 1)
  } else if (e.deltaY < 0) {
    goToSection(currentIndex - 1)
  }
}, { passive: false })

// Touch support
let touchStartY = 0
scrollContainer.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY
}, { passive: true })

scrollContainer.addEventListener('touchend', (e) => {
  if (isScrolling) return
  const diff = touchStartY - e.changedTouches[0].clientY
  if (diff > 50) goToSection(currentIndex + 1)
  else if (diff < -50) goToSection(currentIndex - 1)
}, { passive: true })

// ─── Review detail data ───
const reviewData = {
  martinez: {
    name: 'Carlos Martinez',
    practice: 'Sonoran Family Dental',
    location: 'Tucson, AZ',
    quote: 'Sam was great. Didn\'t pressure me at all. Really happy with the website.',
    bio: 'Family dental practice in central Tucson.'
  },
  lawson: {
    name: 'Emily Lawson',
    practice: 'Lawson Dental Care',
    location: 'Tucson, AZ',
    quote: 'John helped me set everything up. Super nice guy, very patient. Made the whole process easy.',
    bio: 'General and cosmetic dentistry in northwest Tucson.'
  },
  park: {
    name: 'David Park',
    practice: 'Park Dental Studio',
    location: 'Tucson, AZ',
    quote: 'Honestly didn\'t think I needed a new website but Sam convinced me to give it a shot. Glad I did. Getting way more calls now.',
    bio: 'Dental implants and cosmetic work on Tucson\'s east side.'
  },
  okafor: {
    name: 'James Okafor',
    practice: 'Desert Smile Dental',
    location: 'Phoenix, AZ',
    quote: 'These guys are legit. Sam knows what he\'s talking about.',
    bio: 'Multi-provider practice in central Phoenix.'
  },
  chen: {
    name: 'Maria Chen',
    practice: 'Bright Dental Group',
    location: 'Scottsdale, AZ',
    quote: 'Was skeptical at first but Sam really came through. The website looks amazing and we\'re already seeing results.',
    bio: 'Three-location dental group in Scottsdale and North Phoenix.'
  },
  reed: {
    name: 'Marcus Reed',
    practice: 'Reed Family Dentistry',
    location: 'Phoenix, AZ',
    quote: 'John walked me through everything. Really easy to talk to. Would recommend.',
    bio: 'Family dentistry in central Phoenix.'
  },
  nguyen: {
    name: 'Rachel Nguyen',
    practice: 'Cactus Dental Care',
    location: 'Gilbert, AZ',
    quote: 'Such a great investment for our practice. Sam is super nice and actually cares about getting it right. They\'re awesome. Give them a chance!',
    bio: 'General and pediatric dentistry in Gilbert.'
  },
  torres: {
    name: 'Michael Torres',
    practice: 'Copper Creek Dental',
    location: 'Tucson, AZ',
    quote: 'The voice receptionist thing is unreal. We don\'t miss calls anymore. Wish I got it sooner.',
    bio: 'Emergency and restorative dental care in north Tucson.'
  },
  walsh: {
    name: 'Amanda Walsh',
    practice: 'Walsh & Partners',
    location: 'Flagstaff, AZ',
    quote: 'Sam\'s team did a great job on our site. Looks professional, loads fast, patients love it. 10/10.',
    bio: 'Multi-location dental group in Northern Arizona.'
  }
}

// Review click → detail overlay
const reviewDetail = document.getElementById('review-detail')
const reviewDetailBack = document.getElementById('review-detail-back')

document.addEventListener('click', (e) => {
  const reviewCard = e.target.closest('[data-review]')
  if (reviewCard && reviewDetail) {
    const key = reviewCard.dataset.review
    const data = reviewData[key]
    if (!data) return
    document.getElementById('review-detail-name').textContent = data.name
    document.getElementById('review-detail-practice').textContent = data.practice
    document.getElementById('review-detail-location').textContent = data.location
    document.getElementById('review-detail-quote').textContent = '"' + data.quote + '"'
    document.getElementById('review-detail-bio').textContent = data.bio
    reviewDetail.style.display = 'flex'
    requestAnimationFrame(() => reviewDetail.classList.add('review-detail--open'))
  }
})

if (reviewDetailBack) {
  reviewDetailBack.addEventListener('click', () => {
    reviewDetail.classList.remove('review-detail--open')
    setTimeout(() => { reviewDetail.style.display = 'none' }, 400)
  })
}

// Star rating interactive
const starSelect = document.getElementById('star-select')
let selectedStars = 0
if (starSelect) {
  const stars = starSelect.querySelectorAll('.star-btn')
  stars.forEach(star => {
    star.addEventListener('mouseenter', () => {
      const val = parseInt(star.dataset.star)
      stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.star) <= val))
    })
    star.addEventListener('click', () => {
      selectedStars = parseInt(star.dataset.star)
    })
  })
  starSelect.addEventListener('mouseleave', () => {
    const stars2 = starSelect.querySelectorAll('.star-btn')
    stars2.forEach(s => s.classList.toggle('active', parseInt(s.dataset.star) <= selectedStars))
  })
}

// Review form submit
const reviewForm = document.getElementById('review-form')
if (reviewForm) {
  reviewForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const formData = new FormData(reviewForm)
    const data = {
      name: formData.get('name'),
      practice: formData.get('practice'),
      location: formData.get('location'),
      review: formData.get('review'),
      stars: selectedStars
    }
    console.log('Review submitted:', data)
    reviewForm.reset()
    selectedStars = 0
    if (starSelect) starSelect.querySelectorAll('.star-btn').forEach(s => s.classList.remove('active'))
    alert('Thank you for your review!')
  })
}

// Leave a Review overlay
const reviewFormOverlay = document.getElementById('review-form-overlay')
const leaveReviewBtn = document.getElementById('leave-review-btn')
const reviewFormBack = document.getElementById('review-form-back')

if (leaveReviewBtn && reviewFormOverlay) {
  leaveReviewBtn.addEventListener('click', () => {
    reviewFormOverlay.style.display = 'flex'
    requestAnimationFrame(() => reviewFormOverlay.classList.add('review-form-overlay--open'))
  })
}

if (reviewFormBack && reviewFormOverlay) {
  reviewFormBack.addEventListener('click', () => {
    reviewFormOverlay.classList.remove('review-form-overlay--open')
    setTimeout(() => { reviewFormOverlay.style.display = 'none' }, 400)
  })
}

// Keyboard support
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); goToSection(currentIndex + 1) }
  if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goToSection(currentIndex - 1) }
})

updateActiveNav()

// Service card click → open detail panel
const panels = {
  voice: document.getElementById('voice-panel'),
  website: document.getElementById('website-panel'),
  leads: document.getElementById('leads-panel'),
}

function closeAllPanels(instant = false) {
  Object.values(panels).forEach(p => {
    if (!p) return
    if (instant) {
      p.style.transition = 'none'
      p.style.visibility = 'hidden'
      p.classList.remove('panel--open')
      // Re-enable after paint
      requestAnimationFrame(() => { p.style.transition = ''; p.style.visibility = '' })
    } else {
      p.classList.remove('panel--open')
    }
  })
}

document.addEventListener('click', (e) => {
  // Panel nav links — jump to target FIRST, then close panel so it reveals the right page
  const panelLink = e.target.closest('.panel .nav__link, .panel .brand')
  if (panelLink) {
    e.preventDefault()
    const href = panelLink.getAttribute('href')
    // Instant: hide panel + jump scroll in same frame
    closeAllPanels(true)
    if (href && href.startsWith('#')) {
      const target = document.querySelector(href)
      if (target) {
        const idx = sections.indexOf(target)
        if (idx !== -1) {
          currentIndex = idx
          scrollContainer.scrollTop = sections[idx].offsetTop
          updateActiveNav()
        }
      }
    }
    return
  }

  // Close panel on back button click
  const back = e.target.closest('.panel__back')
  if (back) {
    e.preventDefault()
    closeAllPanels()
    return
  }

  // Open service detail
  const card = e.target.closest('[data-service]')
  if (card) {
    const service = card.dataset.service
    if (panels[service]) {
      closeAllPanels()
      panels[service].classList.add('panel--open')
    }
  }
})
