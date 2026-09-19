import './styles/main.css'
import { submitReview, loadReviews } from './firebase.js'
import introSrc from './assets/clock_latest.mp4'
import loopSrc from './assets/clock_loop.mp4'
import posterSrc from './assets/clock_poster.jpg'

const video = document.getElementById('bg-video')
if (video) {
  const loopEl = document.createElement('video')
  loopEl.muted = true
  loopEl.defaultMuted = true
  loopEl.loop = true
  loopEl.playsInline = true
  loopEl.setAttribute('muted', '')
  loopEl.setAttribute('playsinline', '')
  loopEl.setAttribute('webkit-playsinline', '')
  // Don't compete with the intro for bandwidth — the loop starts
  // downloading once the intro is actually rendering frames
  loopEl.preload = 'none'
  loopEl.src = loopSrc
  loopEl.className = 'bg-layer'
  video.parentNode.insertBefore(loopEl, video)

  video.muted = true
  video.defaultMuted = true
  video.playsInline = true
  video.setAttribute('webkit-playsinline', '')
  video.preload = 'auto'
  video.loop = false

  // Poster image stacked over the videos until one is genuinely playing.
  // Covers any native blocked-autoplay glyph (iOS Low Power Mode) — the
  // user can never see a play button, only the still frame. It lives in
  // the static HTML (fetched before this script runs); fall back to
  // creating it if the markup ever loses it.
  let posterEl = document.getElementById('bg-poster')
  if (!posterEl) {
    posterEl = document.createElement('img')
    posterEl.id = 'bg-poster'
    posterEl.src = posterSrc
    posterEl.alt = ''
    posterEl.setAttribute('aria-hidden', 'true')
    posterEl.className = 'bg-layer'
    video.parentNode.insertBefore(posterEl, video.nextSibling)
  }

  let introStarted = false
  let loopLoadStarted = false

  function startLoopLoad() {
    if (loopLoadStarted) return
    loopLoadStarted = true
    loopEl.preload = 'auto'
    loopEl.load()
  }

  // Set once the intro is finished (ended or failed) — only then may the
  // loop video take over the screen
  let introDone = false

  const gestureEvents = ['touchstart', 'touchend', 'pointerdown', 'click']

  function activeLayer() { return introDone ? loopEl : video }
  function showPoster() { posterEl.style.display = '' }
  function hidePoster() { posterEl.style.display = 'none' }

  // Any time a layer is exposed but not playing (iOS refused play() in
  // Low Power Mode, or after returning from the background), cover it
  // with the still poster so the native play glyph can never show, and
  // resume on the very next tap. Only acts on a PAUSED layer — never
  // touches a video that is already playing (a second play() mid-intro
  // can stall it on iPhones).
  function resumeOnGesture() {
    const active = activeLayer()
    if (active === video && video.ended) return
    if (!active.paused) return
    active.play().then(hidePoster).catch(() => {})
  }
  gestureEvents.forEach(ev => document.addEventListener(ev, resumeOnGesture, { passive: true }))
  video.addEventListener('playing', () => { if (!introDone) hidePoster() })

  // The poster may ONLY come off once the intro is genuinely running.
  // iOS paints the first frame (and its blocked-autoplay play glyph)
  // while the element is still paused, and requestVideoFrameCallback
  // fires for that paint — so "a frame rendered" is NOT proof of playback.
  let playingFired = false
  function revealIntro() {
    if (video.paused || video.ended || !playingFired) return
    introStarted = true
    posterEl.style.display = 'none'
    startLoopLoad()
    removeGestureRetries()
  }
  // Swap poster → video on the exact frame the video first renders while
  // playing (requestVideoFrameCallback), not on the earlier 'playing'
  // event — keeps the handoff invisible. 'playing' + timeout is the
  // fallback for browsers without rVFC or where it stalls.
  if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
    const onFrame = () => {
      revealIntro()
      if (!introStarted) video.requestVideoFrameCallback(onFrame)
    }
    video.requestVideoFrameCallback(onFrame)
    video.addEventListener('playing', () => {
      playingFired = true
      startLoopLoad()
      setTimeout(() => { if (!introStarted) revealIntro() }, 250)
    })
  } else {
    video.addEventListener('playing', () => { playingFired = true; revealIntro() })
  }
  // An early loop 'playing' must never hide the poster while the intro is
  // still on its way — only after the intro has ended or failed
  loopEl.addEventListener('playing', () => {
    if (introDone) posterEl.style.display = 'none'
  })

  // If the intro can't load or decode, skip straight to the loop
  video.addEventListener('error', () => {
    introDone = true
    video.style.display = 'none'
    startLoopLoad()
    loopEl.play().catch(() => {})
  })

  // Gesture retries exist ONLY for the blocked-autoplay case (iOS Low Power
  // Mode, data saver). On phones where autoplay works — the normal case —
  // no gesture handler is ever registered, so nothing can touch the videos
  // mid-intro. (A second play() during the intro can stall the first video
  // on iPhones, which glitched the intro and skipped to the loop.)
  let loopUnlocked = false
  function tryPlayOnGesture() {
    if (introStarted) { removeGestureRetries(); return }
    video.play().catch(() => {})
    // Autoplay is blocked on this device, so the loop video will be
    // refused too when the intro ends. Use this same gesture to unlock
    // the loop element: a play() inside a user gesture, paused right
    // away, lets iOS accept the later programmatic play().
    if (!loopUnlocked) {
      loopUnlocked = true
      const p = loopEl.play()
      if (p && p.then) p.then(() => { if (!introDone) loopEl.pause() }).catch(() => {})
    }
  }
  function removeGestureRetries() {
    gestureEvents.forEach(ev => document.removeEventListener(ev, tryPlayOnGesture))
  }
  function attemptIntro() {
    video.src = introSrc
    const firstAttempt = video.play()
    if (firstAttempt && firstAttempt.catch) {
      firstAttempt.catch(() => {
        if (!introStarted) {
          showPoster()
          gestureEvents.forEach(ev => document.addEventListener(ev, tryPlayOnGesture, { passive: true }))
        }
      })
    }
  }
  // Give the video element a source only once the poster is on screen —
  // otherwise iOS paints the first frame + play glyph for the few hundred
  // ms before the poster image arrives. Never wait more than 1.5s.
  if (posterEl.complete && posterEl.naturalWidth > 0) {
    attemptIntro()
  } else {
    let started = false
    const go = () => { if (!started) { started = true; attemptIntro() } }
    posterEl.addEventListener('load', go, { once: true })
    posterEl.addEventListener('error', go, { once: true })
    setTimeout(go, 1500)
  }

  video.addEventListener('ended', () => {
    introDone = true
    // Only seek if the loop has actually advanced — a seek forces a
    // rebuffer, and a rebuffering video-only element is exactly what
    // Chromium pauses "to save power" in a background tab
    if (loopEl.currentTime > 0.05) loopEl.currentTime = 0
    // If the loop's play() is refused, retry once shortly after, and
    // again on the next user gesture
    let loopRetried = false
    const tryLoop = () => {
      loopEl.play().then(() => {
        gestureEvents.forEach(ev => document.removeEventListener(ev, tryLoop))
      }).catch(() => {
        showPoster()
        if (!loopRetried) {
          loopRetried = true
          setTimeout(() => { if (loopEl.paused) tryLoop() }, 400)
        }
      })
    }
    tryLoop()
    gestureEvents.forEach(ev => document.addEventListener(ev, tryLoop, { passive: true }))
    // Keep the intro's last frame visible until the loop is actually
    // rendering — avoids a flash if the loop is still buffering
    const hideIntro = () => {
      video.style.display = 'none'
      loopEl.removeEventListener('playing', hideIntro)
    }
    if (!loopEl.paused && loopEl.readyState >= 2) hideIntro()
    else loopEl.addEventListener('playing', hideIntro)
  })

  // The background video must never stay paused: iOS pauses it on app
  // switch / lock and doesn't always resume on return. Restart the active
  // layer on every path back to the foreground, and whenever the OS pauses
  // it for any other reason.
  function reloadLoopAt(t) {
    const onceReady = () => {
      loopEl.removeEventListener('canplay', onceReady)
      try { loopEl.currentTime = t } catch { /* start over */ }
      loopEl.play().then(hidePoster).catch(showPoster)
    }
    loopEl.addEventListener('canplay', onceReady)
    loopEl.load()
  }
  function resumeActiveVideo() {
    if (document.hidden) return
    const active = introDone ? loopEl : video
    if (active === video && video.ended) return // handoff to loop in flight
    if (active.style.display === 'none') return
    const t0 = active.currentTime
    if (active.paused) active.play().then(hidePoster).catch(showPoster)
    // iOS can return from the background with a dead decoder: play() then
    // "succeeds" but no frames advance. Check fast and reload immediately —
    // don't make the user tap or wait for the slow watchdog.
    if (active === loopEl) {
      setTimeout(() => {
        if (document.hidden) return
        if (loopEl.currentTime === t0) reloadLoopAt(t0)
      }, 450)
    }
  }
  document.addEventListener('visibilitychange', resumeActiveVideo)
  window.addEventListener('pageshow', resumeActiveVideo)
  window.addEventListener('focus', resumeActiveVideo)
  video.addEventListener('pause', () => setTimeout(resumeActiveVideo, 150))
  loopEl.addEventListener('pause', () => setTimeout(resumeActiveVideo, 150))

  // Watchdog: play() alone isn't enough after a long stay in another app —
  // iOS can kill the decoder so the element "plays" without advancing.
  // Every 2s while visible, confirm the active video's clock is moving;
  // nudge it first, and on a second consecutive stall reload the source
  // and resume from the same spot (loop layer only — never mid-intro).
  let wdTime = -1
  let wdStalls = 0
  setInterval(() => {
    if (document.hidden) return
    const active = introDone ? loopEl : video
    if (active.style.display === 'none') return
    if (active === video && (video.ended || !introStarted)) return
    const t = active.currentTime
    if (t === wdTime) {
      wdStalls++
      if (wdStalls === 1) {
        active.play().then(hidePoster).catch(showPoster)
      } else if (wdStalls >= 2 && active === loopEl) {
        reloadLoopAt(t)
        wdStalls = 0
      }
    } else {
      wdStalls = 0
    }
    wdTime = t
  }, 2000)

  // Sizing is pure CSS (#bg-video / .bg-layer) — first paint is already at
  // final scale and window resizes are handled without any JS
}

// Panel-based navigation
const sections = Array.from(document.querySelectorAll('.section'))
const navLinks = document.querySelectorAll('.top .nav__link')
const leaveReviewBtnEl = document.getElementById('leave-review-btn')

let currentIndex = 0
let isScrolling = false

function goToSection(index) {
  if (index < 0 || index >= sections.length || isScrolling) return
  if (index === currentIndex) return
  isScrolling = true
  currentIndex = index

  // Stack panels: all sections up to current slide up, rest slide down
  sections.forEach((s, i) => {
    if (i === 0) return
    if (i <= currentIndex) {
      s.classList.add('section--visible')
    } else {
      s.classList.remove('section--visible')
      // Reset entrance animation for sections that slide back down
      s.classList.remove('section--has-shown')
    }
  })

  // Entrance animations — trigger immediately so content animates during slide
  sections.forEach(s => s.classList.remove('section--active'))
  void sections[currentIndex].offsetWidth
  sections[currentIndex].classList.add('section--active')

  // After entrance animation completes, lock content visible so it shows behind next section.
  // Keyed by section id rather than index — index-keyed durations silently break
  // whenever a section is added or removed (removing Reviews shifted contact from
  // 3 to 2, which cut its 8s fade short and snapped it to full brightness).
  // Services cards stagger to 2.1s, contact's slow fade is 8s + 0.3s delay, others ~1.4s.
  const durations = { services: 2100, contact: 8500 }
  const animDuration = durations[sections[currentIndex].id] || 1400
  setTimeout(() => {
    sections[currentIndex].classList.add('section--has-shown')
  }, animDuration)

  updateActiveNav()
  resetAllDividers()
  setTimeout(() => { animateDivider(index) }, 1250)
  setTimeout(() => { isScrolling = false }, 1400)
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
  divider.style.transform = 'scaleX(0)'
  void divider.offsetWidth
  divider.style.transform = ''
  divider.classList.add('section__divider--animate')
}

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
  if (leaveReviewBtnEl) {
    leaveReviewBtnEl.classList.toggle('visible', activeId === 'reviews')
  }
}

// ─── Service info overlay ───
const serviceInfo = {
  basic: {
    title: 'BASIC — PROFESSIONAL WEBSITE CREATION',
    sections: [
      { title: 'CUSTOM DESIGN & BUILD', text: 'No templates. No drag-and-drop builders. Your site is designed from scratch to match your business\'s brand, personality, and goals. Every element is intentional — from the layout to the color palette to the call-to-action placement.' },
      { title: 'CONVERSION ENGINEERING', text: 'Beautiful isn\'t enough. Every page is built to convert visitors into customers. Strategic placement of booking buttons, trust signals, testimonials, and contact forms. We study what makes customers click — and we build around that.' },
      { title: 'GOOGLE BUSINESS, WIRED IN', text: 'Your site launches connected to your Google Business profile — click-to-call, directions, reviews, and booking all in one place, so customers who find you can book you. Built in at launch.' },
      { title: 'MOBILE-FIRST & FAST', text: 'Over 60% of local searches happen on phones. Your site loads in under 2 seconds, looks perfect on every device, and passes every Google speed test. Slow sites lose customers — yours won\'t.' },
      { title: 'WANT ONGOING EDITS?', text: 'Basic covers the build. If you want us to keep making changes to your site — copy, photos, pricing, new pages — add Bundle Management.' }
    ]
  },
  core: {
    title: 'CORE — META AD CREATION & MANAGEMENT',
    sections: [
      { title: 'CAMPAIGN STRATEGY & MANAGEMENT', text: 'We plan, build, launch, and optimize Facebook and Instagram campaigns around your goals. Objectives, budgets, bidding, and placements are managed daily — engineered for return on ad spend, not vanity metrics.' },
      { title: 'CREATIVE SCRIPTING & EDITING', text: 'Every winning ad starts with a script that sells. We write, script, and edit the ads themselves — hooks, angles, copy, and cuts tailored to your brand and offer.' },
      { title: 'LANDING PAGES & FUNNELS', text: 'Dedicated landing pages built for each campaign. When a potential customer clicks your ad, they land on a page designed to do one thing — get them to book. No distractions, no clutter, just conversion.' },
      { title: 'AUDIENCE TARGETING', text: 'Custom audiences built on demographics, interests, and behaviors specific to your ideal customers. Lookalike audiences, retargeting, and local geo-targeting maximize every dollar of ad spend.' },
      { title: 'MONTHLY PERFORMANCE REPORTS', text: 'Full transparency. Every month you get a breakdown of impressions, clicks, leads generated, cost per lead, and booked appointments. You\'ll know exactly what your investment is producing.' }
    ]
  },
  elite: {
    title: 'ELITE — THE FULL PACKAGE',
    sections: [
      { title: 'CUSTOM WEBSITE', text: 'A custom-built, conversion-ready website — designed from scratch to match your brand, engineered to turn visitors into booked customers. Your digital storefront, done right.' },
      { title: 'DETAIL PRO — ELITE TIER, FREE FOR OUR PARTNERSHIP', text: 'Detail Pro on the Elite tier — completely free for the duration of our partnership. The top plan of our detailing app: run your whole operation — customers, appointments, scheduling, and more — unlocked for as long as we work together.' },
      { title: 'META ADS — SET UP & RUN', text: 'We set up your Facebook and Instagram ads and run them for your entire first month — strategy, creative, targeting, and daily optimization. Your campaigns go live and start working while you focus on the work.' },
      { title: 'OPTIONAL FULL BRAND REDESIGN', text: 'Want a fresh look to match? We\'ll redesign your door hangers, logo, A-frame sign, flyers — everything. Print-ready and on-brand, so every touchpoint looks like an established business.' },
      { title: 'ADD WEBSITE MANAGEMENT', text: 'Keep it all running for you — unlimited website edits and domain management. Add it right onto your Elite package.' }
    ]
  },
  management: {
    title: 'BUNDLE MANAGEMENT',
    sections: [
      { title: 'UNLIMITED WEBSITE EDITS', text: 'Change anything on your site, whenever you want — copy, photos, pricing, hours, new pages. Just ask, and it\'s done. No per-edit invoices.' },
      { title: 'DOMAIN MANAGEMENT', text: 'Your domain is handled for you. Want a professional domain email (you@yourbusiness.com)? We buy the domain and set the whole thing up — no registrars to wrangle, no DNS headaches.' },
      { title: 'ONE FLAT MONTHLY FEE', text: 'One predictable monthly fee covers website management and domain management — no separate vendors, no surprise bills. It can be added right onto the Elite package too.' }
    ]
  }
}

const infoOverlay = document.getElementById('info-overlay')
const infoBack = document.getElementById('info-back')

document.addEventListener('click', (e) => {
  const infoBtn = e.target.closest('.more-info-btn')
  if (infoBtn && infoOverlay) {
    const id = infoBtn.dataset.info
    const info = serviceInfo[id]
    if (!info) return
    document.getElementById('info-title').textContent = info.title
    const contentEl = document.getElementById('info-content')
    contentEl.innerHTML = info.sections.map(s =>
      `<div><h3 class="info-section__title">${s.title}</h3><p class="info-section__text">${s.text}</p></div>`
    ).join('')
    infoOverlay.style.display = 'flex'
    requestAnimationFrame(() => infoOverlay.classList.add('info-overlay--open'))
  }
})

if (infoBack) {
  infoBack.addEventListener('click', () => {
    infoOverlay.classList.remove('info-overlay--open')
    setTimeout(() => { infoOverlay.style.display = 'none' }, 400)
  })
}

// Nav clicks
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

// Any open panel/overlay should capture scroll & keys instead of paging sections
function overlayOpen() {
  return !!document.querySelector('.panel--open, .info-overlay--open, .review-detail--open, .review-form-overlay--open')
}

// Wheel — one section at a time
document.addEventListener('wheel', (e) => {
  // Let overlays scroll natively; don't page the background behind them
  if (overlayOpen()) return
  e.preventDefault()
  if (isScrolling) return
  if (e.deltaY > 0) goToSection(currentIndex + 1)
  else if (e.deltaY < 0) goToSection(currentIndex - 1)
}, { passive: false })

// Touch support — swipe to change sections
let touchStartY = 0
let touchMoving = false
document.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY
  touchMoving = false
}, { passive: true })

document.addEventListener('touchmove', (e) => {
  touchMoving = true
  // Only prevent default on the scroll container to stop bounce, not on overlays/panels/buttons
  const isScrollArea = e.target.closest('.scroll-container') && !e.target.closest('.panel') && !e.target.closest('.info-overlay') && !e.target.closest('.review-detail') && !e.target.closest('.review-form-overlay')
  if (isScrollArea) e.preventDefault()
}, { passive: false })

document.addEventListener('touchend', (e) => {
  if (overlayOpen()) return  // swiping inside an overlay shouldn't page the background
  if (isScrolling || !touchMoving) return  // ignore taps (no movement)
  const diff = touchStartY - e.changedTouches[0].clientY
  if (diff > 50) goToSection(currentIndex + 1)
  else if (diff < -50) goToSection(currentIndex - 1)
}, { passive: true })

// ─── Review detail data ───
const reviewData = {
  martinez: {
    name: 'Carlos Martinez',
    practice: 'Sonoran Services Group',
    location: 'Tucson, AZ',
    quote: 'Sam was great. Didn\'t pressure me at all. Really happy with the website.',
    bio: 'Service business in central Tucson.'
  },
  lawson: {
    name: 'Emily Lawson',
    practice: 'Lawson & Co',
    location: 'Tucson, AZ',
    quote: 'Owen helped me set everything up. Super nice guy, very patient. Made the whole process easy.',
    bio: 'Full-service business in northwest Tucson.'
  },
  park: {
    name: 'David Park',
    practice: 'Park Creative Studio',
    location: 'Tucson, AZ',
    quote: 'Honestly didn\'t think I needed a new website but Sam convinced me to give it a shot. Glad I did. Getting way more calls now.',
    bio: 'Creative services on Tucson\'s east side.'
  },
  okafor: {
    name: 'James Okafor',
    practice: 'Desert Smile Co',
    location: 'Phoenix, AZ',
    quote: 'These guys are legit. Sam knows what he\'s talking about.',
    bio: 'Multi-location business in central Phoenix.'
  },
  chen: {
    name: 'Maria Chen',
    practice: 'Bright Growth Group',
    location: 'Scottsdale, AZ',
    quote: 'Was skeptical at first but Sam really came through. The website looks amazing and we\'re already seeing results.',
    bio: 'Three-location business in Scottsdale and North Phoenix.'
  },
  reed: {
    name: 'Marcus Reed',
    practice: 'Reed Family Services',
    location: 'Phoenix, AZ',
    quote: 'Owen walked me through everything. Really easy to talk to. Would recommend.',
    bio: 'Family business in central Phoenix.'
  },
  nguyen: {
    name: 'Rachel Nguyen',
    practice: 'Cactus Creek Co',
    location: 'Gilbert, AZ',
    quote: 'Such a great investment for our business. Sam is super nice and actually cares about getting it right. They\'re awesome. Give them a chance!',
    bio: 'Growing business in Gilbert.'
  },
  torres: {
    name: 'Michael Torres',
    practice: 'Copper Creek Services',
    location: 'Tucson, AZ',
    quote: 'The ad campaigns are unreal. Our phone hasn\'t stopped ringing since we started. Wish I got it sooner.',
    bio: 'Service business in north Tucson.'
  },
  walsh: {
    name: 'Amanda Walsh',
    practice: 'Walsh & Partners',
    location: 'Flagstaff, AZ',
    quote: 'Sam\'s team did a great job on our site. Looks professional, loads fast, clients love it. 10/10.',
    bio: 'Multi-location business in Northern Arizona.'
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
      // Update fill on click too — touch devices never fire mouseenter
      stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.star) <= selectedStars))
    })
  })
  starSelect.addEventListener('mouseleave', () => {
    const stars2 = starSelect.querySelectorAll('.star-btn')
    stars2.forEach(s => s.classList.toggle('active', parseInt(s.dataset.star) <= selectedStars))
  })
}

// Review form submit — saves to Firebase
const reviewForm = document.getElementById('review-form')
if (reviewForm) {
  reviewForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const formData = new FormData(reviewForm)
    // Trim + hard caps — maxlength attributes can be bypassed, and oversized
    // values would render on the live site
    const clean = (v, max) => String(v ?? '').trim().slice(0, max)
    const data = {
      name: clean(formData.get('name'), 60),
      practice: clean(formData.get('practice'), 80),
      location: clean(formData.get('location'), 120),
      review: clean(formData.get('review'), 500),
      stars: Math.min(5, Math.max(1, selectedStars || 5))
    }
    if (!data.name || !data.review) return

    const submitBtn = reviewForm.querySelector('.review-form__submit')
    if (submitBtn) { submitBtn.textContent = 'SUBMITTING...'; submitBtn.disabled = true }

    const result = await submitReview(data)

    if (result.success) {
      // Fire-and-forget Telegram ping — a failed notification shouldn't
      // affect the visitor's experience
      fetch('https://sam-command-center-default-rtdb.firebaseio.com/apexPipeline/inbox.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'website-review', payload: JSON.stringify({ ...data, submittedAtIso: new Date().toISOString() }), created: Date.now() }),
      }).catch(() => {})
      reviewForm.reset()
      selectedStars = 0
      if (starSelect) starSelect.querySelectorAll('.star-btn').forEach(s => s.classList.remove('active'))
      if (submitBtn) { submitBtn.textContent = 'THANK YOU!'; setTimeout(() => { submitBtn.textContent = 'SUBMIT REVIEW'; submitBtn.disabled = false }, 2000) }
      // Reload reviews to show the new one
      renderFirebaseReviews()
    } else {
      if (submitBtn) { submitBtn.textContent = 'ERROR — TRY AGAIN'; submitBtn.disabled = false }
    }
  })
}

// Escape user-submitted text before injecting as HTML (prevents stored XSS)
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// Load and render reviews from Firebase — distribute evenly across 3 rows
async function renderFirebaseReviews() {
  const reviews = await loadReviews()
  if (reviews.length === 0) return

  // Get all 3 row tracks
  const tracks = document.querySelectorAll('.reviews-row__track')
  if (tracks.length === 0) return

  // Round-robin: review 0 → row 0, review 1 → row 1, review 2 → row 2, review 3 → row 0, etc.
  reviews.forEach((r, i) => {
    const trackIdx = i % tracks.length
    const track = tracks[trackIdx]

    // Skip if already rendered
    if (track.querySelector(`[data-firebase-id="${r.id}"]`)) return

    // Clamp stars to 1–5 — bad data would make repeat() throw and kill the render
    const stars = Math.min(5, Math.max(1, parseInt(r.stars, 10) || 5))
    const card = document.createElement('div')
    card.className = 'review'
    card.setAttribute('data-firebase-id', r.id)
    card.innerHTML = `
      <div class="review__stars">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</div>
      <p class="review__text">"${escapeHtml(r.review)}"</p>
      <div class="review__author">
        <span class="review__name">${escapeHtml(r.name)}</span>
        <span class="review__role">${escapeHtml(r.practice)}${r.location ? ' — ' + escapeHtml(r.location) : ''}</span>
      </div>
    `
    
    // Insert before the duplicate section (duplicates are for seamless loop)
    // Find the first duplicate by checking for repeated data-review attributes
    const originals = track.querySelectorAll('.review:not([data-firebase-id])')
    const halfway = Math.ceil(originals.length / 2)
    if (originals[halfway]) {
      track.insertBefore(card, originals[halfway])
    } else {
      track.appendChild(card)
    }
    
    // Also add a duplicate for the seamless scroll loop
    const dupe = card.cloneNode(true)
    dupe.removeAttribute('data-firebase-id')
    dupe.setAttribute('data-firebase-dupe', r.id)
    track.appendChild(dupe)
  })
}

// Load Firebase reviews on page load
renderFirebaseReviews()

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
  if (overlayOpen()) return
  if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); goToSection(currentIndex + 1) }
  if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goToSection(currentIndex - 1) }
})

updateActiveNav()
sections[0].classList.add('section--active')

// Remove loading state and enable transitions — triple rAF to guarantee paint is settled
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.remove('loading')
      document.querySelector('.scroll-container').classList.add('sections-ready')
    })
  })
})

// Service card click → open detail panel
const panels = {
  basic: document.getElementById('basic-panel'),
  core: document.getElementById('core-panel'),
  elite: document.getElementById('elite-panel'),
  management: document.getElementById('management-panel'),
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
          // Sections are fixed/stacked, just update state
          goToSection(idx)
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

// ─── Contact form — Netlify function + Firestore ───
const contactForm = document.getElementById('contact-form')
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const submitBtn = contactForm.querySelector('.contact-form__submit')
    const originalText = submitBtn.textContent
    submitBtn.textContent = 'SENDING...'
    submitBtn.disabled = true

    try {
      const formData = new FormData(contactForm)
      const data = {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone') || '',
        message: formData.get('message'),
      }
      const response = await fetch('https://sam-command-center-default-rtdb.firebaseio.com/apexPipeline/inbox.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'website-contact', payload: JSON.stringify({ ...data, business: data.name, submittedAtIso: new Date().toISOString() }), created: Date.now() }),
      })

      if (response.ok) {
        submitBtn.textContent = 'MESSAGE SENT ✓'
        contactForm.reset()
        setTimeout(() => { submitBtn.textContent = originalText; submitBtn.disabled = false }, 3000)
      } else {
        submitBtn.textContent = 'ERROR — TRY AGAIN'
        submitBtn.disabled = false
      }
    } catch (err) {
      submitBtn.textContent = 'ERROR — TRY AGAIN'
      submitBtn.disabled = false
    }
  })
}
