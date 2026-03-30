import './styles/main.css'
import { submitReview, loadReviews } from './firebase.js'
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

  // iOS needs a user gesture to start video — retry on first touch
  function tryPlayOnTouch() {
    video.play().catch(() => {})
    loopEl.play().catch(() => {})
    document.removeEventListener('touchstart', tryPlayOnTouch)
  }
  document.addEventListener('touchstart', tryPlayOnTouch, { passive: true })

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

  // After entrance animation completes, lock content visible so it shows behind next section
  // Services cards stagger to 2.1s, contact fade is 8.5s, others ~1.4s
  const durations = { 1: 2100, 3: 8500 } // index 1 = services, index 3 = contact
  const animDuration = durations[currentIndex] || 1400
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

// ─── Cart system ───
const cart = []
const products = {
  voice: { name: 'AI Voice Receptionist', desc: 'Automated call handling & booking', upfront: 0, monthly: 299, available: true, paymentLink: 'https://buy.stripe.com/eVq6oA6Xm9JM8EmdII73G03' },
  website: { name: 'Website Creation', desc: 'Custom-built conversion website', upfront: 750, monthly: 249, available: true, paymentLink: 'https://buy.stripe.com/00wbIU95u5tw6we20073G02' },
  leads: { name: 'Lead Generation', desc: 'Meta ads management & strategy', upfront: 0, monthly: 999, available: true, paymentLink: 'https://buy.stripe.com/eVq14g0yYcVYf2KbAA73G04' }
}

const cartItemsEl = document.getElementById('cart-items')
const cartEmptyEl = document.getElementById('cart-empty')
const cartFooterEl = document.getElementById('cart-footer')
const cartCountEl = document.getElementById('cart-count')
const cartTotalEl = document.getElementById('cart-total')
const cartIconLink = document.querySelector('.nav__link--icon')

function addToCart(productId) {
  if (cart.includes(productId)) return
  cart.push(productId)
  renderCart()
  // Close service panel and go back to services
  closeAllPanels()
  updateCartBadge()
}

function removeFromCart(productId) {
  const idx = cart.indexOf(productId)
  if (idx !== -1) cart.splice(idx, 1)
  renderCart()
  updateCartBadge()
}

function updateCartBadge() {
  if (!cartIconLink) return
  let badge = cartIconLink.querySelector('.cart-badge')
  if (cart.length > 0) {
    if (!badge) {
      badge = document.createElement('span')
      badge.className = 'cart-badge'
      cartIconLink.appendChild(badge)
    }
    badge.textContent = cart.length
  } else if (badge) {
    badge.remove()
  }
}

function renderCart() {
  // Clear existing items (not the empty state)
  cartItemsEl.querySelectorAll('.cart-item').forEach(el => el.remove())

  if (cart.length === 0) {
    cartEmptyEl.style.display = 'flex'
    cartFooterEl.style.display = 'none'
    cartCountEl.textContent = '0 items'
    return
  }

  cartEmptyEl.style.display = 'none'
  cartFooterEl.style.display = 'block'
  cartCountEl.textContent = cart.length + (cart.length === 1 ? ' item' : ' items')

  let totalUpfront = 0
  let totalMonthly = 0
  cart.forEach(id => {
    const p = products[id]
    if (!p) return
    totalUpfront += p.upfront
    totalMonthly += p.monthly
    const item = document.createElement('div')
    item.className = 'cart-item'
    let priceHtml = ''
    if (p.upfront > 0 && p.monthly > 0) {
      priceHtml = `<span class="cart-item__price">$${p.upfront}</span><span class="cart-item__monthly">+ $${p.monthly}/mo</span>`
    } else if (p.monthly > 0) {
      priceHtml = `<span class="cart-item__price">$${p.monthly}/mo</span>`
    } else {
      priceHtml = `<span class="cart-item__price">$${p.upfront}</span>`
    }
    item.innerHTML = `
      <div class="cart-item__info" data-open-service="${id}" style="cursor:pointer">
        <span class="cart-item__name">${p.name}</span>
        <span class="cart-item__desc">${p.desc}</span>
      </div>
      <div class="cart-item__right">
        <div class="cart-item__prices">${priceHtml}</div>
        <button class="cart-item__remove" data-remove="${id}">&times;</button>
      </div>
    `
    cartItemsEl.appendChild(item)
  })

  const dueToday = totalUpfront + totalMonthly
  cartTotalEl.innerHTML = '$' + dueToday.toLocaleString() + ' <span class="cart-total__after">then $' + totalMonthly.toLocaleString() + '/mo</span>'

  // Remove button listeners
  cartItemsEl.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(btn.dataset.remove))
  })

  // Click item name → open that service detail
  cartItemsEl.querySelectorAll('[data-open-service]').forEach(el => {
    el.addEventListener('click', () => {
      const serviceId = el.dataset.openService
      closePricing()
      // Make sure we're on services section
      const servicesIdx = sections.findIndex(s => s.id === 'services')
      if (servicesIdx !== -1 && currentIndex !== servicesIdx) {
        currentIndex = servicesIdx
        sections.forEach((s, i) => {
          if (i === 0) return
          if (i <= currentIndex) s.classList.add('section--visible')
          else s.classList.remove('section--visible')
        })
        updateActiveNav()
      }
      // Open the service panel
      if (panels[serviceId]) {
        closeAllPanels()
        panels[serviceId].classList.add('panel--open')
      }
    })
  })
}

// Add to cart button clicks
document.addEventListener('click', (e) => {
  const addBtn = e.target.closest('.add-to-cart-btn')
  if (addBtn) {
    e.stopPropagation()
    const productId = addBtn.dataset.product
    if (productId && products[productId] && products[productId].available) {
      if (cart.includes(productId)) {
        removeFromCart(productId)
        addBtn.textContent = '+ ADD TO CART'
        addBtn.classList.remove('added')
      } else {
        addToCart(productId)
        addBtn.textContent = 'REMOVE'
        addBtn.classList.add('added')
      }
    }
  }
})

// ─── Service info overlay ───
const serviceInfo = {
  voice: {
    title: 'AI VOICE RECEPTIONIST',
    price: '$299/mo',
    sections: [
      { title: '24/7 CALL ANSWERING', text: 'Your AI receptionist picks up every call — nights, weekends, lunch breaks. Customers hear a natural, professional voice that represents your business exactly how you want. No hold music. No voicemail. No missed opportunities.' },
      { title: 'APPOINTMENT SCHEDULING', text: 'Books directly into your calendar in real time. Handles new client intake, rescheduling, and cancellations. Sends confirmation texts automatically. Your team can focus on what matters instead of answering phones.' },
      { title: 'REVENUE RECOVERY', text: 'Missed calls cost you thousands. Our system follows up automatically, converting abandoned inquiries into booked revenue.' },
      { title: 'SMART CALL ROUTING', text: 'Emergencies get routed to the right person immediately. Insurance questions, directions, hours — all handled automatically. Complex cases get flagged and forwarded to your team with full context.' },
      { title: 'MONTHLY REPORTING', text: 'See exactly how many calls were answered, appointments booked, and revenue recovered. Clear ROI tracking so you always know what you\'re getting for your investment.' }
    ]
  },
  website: {
    title: 'WEBSITE CREATION',
    price: '$999 one-time + $249/mo',
    sections: [
      { title: 'CUSTOM DESIGN & BUILD', text: 'No templates. No drag-and-drop builders. Your site is designed from scratch to match your practice\'s brand, personality, and goals. Every element is intentional — from the layout to the color palette to the call-to-action placement.' },
      { title: 'CONVERSION ENGINEERING', text: 'Beautiful isn\'t enough. Every page is built to convert visitors into customers. Strategic placement of booking buttons, trust signals, testimonials, and contact forms. We study what makes customers click — and we build around that.' },
      { title: 'SEO FOUNDATION', text: 'Your site launches with proper on-page SEO — meta tags, schema markup, Google Business integration, local keywords, fast load times. This is the foundation that gets you ranking for your services in your area in your area.' },
      { title: 'MONTHLY SEO & MAINTENANCE ($249/MO)', text: 'Ongoing search engine optimization, content updates, performance monitoring, Google ranking reports, security patches, and hosting. We keep your site fast, secure, and climbing the rankings month over month.' },
      { title: 'MOBILE-FIRST & FAST', text: 'Over 60% of local searches happen on phones. Your site loads in under 2 seconds, looks perfect on every device, and passes every Google speed test. Slow sites lose customers — yours won\'t.' }
    ]
  },
  leads: {
    title: 'LEAD GENERATION',
    price: '$999/mo + ad spend',
    sections: [
      { title: 'META ADS MANAGEMENT', text: 'We create, launch, and optimize Facebook and Instagram ad campaigns targeting potential customers within 10-15 miles of your business. Professionally designed ads that stop the scroll and drive bookings.' },
      { title: 'AUDIENCE TARGETING', text: 'We build custom audiences based on demographics, interests, and behaviors specific to your ideal customers in your area. Lookalike audiences, retargeting, and geo-fencing to maximize every dollar of ad spend.' },
      { title: 'AD CREATIVE & COPYWRITING', text: 'Professional ad copy and visuals designed specifically for your business. Before/after showcases, special offers, new customer campaigns — all A/B tested and optimized for the highest conversion rate.' },
      { title: 'LANDING PAGES & FUNNELS', text: 'Dedicated landing pages built for each campaign. When a potential customer clicks your ad, they land on a page designed to do one thing — get them to book. No distractions, no clutter, just conversion.' },
      { title: 'MONTHLY PERFORMANCE REPORTS', text: 'Full transparency. Every month you get a breakdown of impressions, clicks, leads generated, cost per lead, and booked appointments. You\'ll know exactly what your investment is producing.' }
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
    document.getElementById('info-price').textContent = info.price
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

// Pricing panel
const pricingPanel = document.getElementById('pricing-panel')

function openPricing() {
  if (pricingPanel) pricingPanel.classList.add('panel--open')
}

function closePricing() {
  if (pricingPanel) pricingPanel.classList.remove('panel--open')
}

const pricingBack = document.querySelector('.pricing-back')
if (pricingBack) {
  pricingBack.addEventListener('click', () => closePricing())
}

// Nav clicks
document.querySelectorAll('.top .nav__link, .top .brand').forEach(link => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href')
    if (href && href.startsWith('#')) {
      e.preventDefault()
      if (href === '#pricing') {
        openPricing()
        return
      }
      closePricing()
      const target = document.querySelector(href)
      if (target) {
        const idx = sections.indexOf(target)
        if (idx !== -1) goToSection(idx)
      }
    }
  })
})

// Wheel — one section at a time
document.addEventListener('wheel', (e) => {
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
  const isScrollArea = e.target.closest('.scroll-container') && !e.target.closest('.panel') && !e.target.closest('.info-overlay') && !e.target.closest('.review-detail') && !e.target.closest('.pricing-panel') && !e.target.closest('.review-form-overlay')
  if (isScrollArea) e.preventDefault()
}, { passive: false })

document.addEventListener('touchend', (e) => {
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
    quote: 'John helped me set everything up. Super nice guy, very patient. Made the whole process easy.',
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
    quote: 'John walked me through everything. Really easy to talk to. Would recommend.',
    bio: 'Family business in central Phoenix.'
  },
  nguyen: {
    name: 'Rachel Nguyen',
    practice: 'Cactus Creek Co',
    location: 'Gilbert, AZ',
    quote: 'Such a great investment for our practice. Sam is super nice and actually cares about getting it right. They\'re awesome. Give them a chance!',
    bio: 'Growing business in Gilbert.'
  },
  torres: {
    name: 'Michael Torres',
    practice: 'Copper Creek Services',
    location: 'Tucson, AZ',
    quote: 'The voice receptionist thing is unreal. We don\'t miss calls anymore. Wish I got it sooner.',
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
    const data = {
      name: formData.get('name'),
      practice: formData.get('practice'),
      location: formData.get('location'),
      review: formData.get('review'),
      stars: selectedStars || 5
    }
    
    const submitBtn = reviewForm.querySelector('.review-form__submit')
    if (submitBtn) { submitBtn.textContent = 'SUBMITTING...'; submitBtn.disabled = true }
    
    const result = await submitReview(data)
    
    if (result.success) {
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
    
    const card = document.createElement('div')
    card.className = 'review'
    card.setAttribute('data-firebase-id', r.id)
    card.innerHTML = `
      <div class="review__stars">${'★'.repeat(r.stars || 5)}${'☆'.repeat(5 - (r.stars || 5))}</div>
      <p class="review__text">"${r.review}"</p>
      <div class="review__author">
        <span class="review__name">${r.name}</span>
        <span class="review__role">${r.practice}${r.location ? ' — ' + r.location : ''}</span>
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

// ─── Checkout — open Stripe payment links ───
const checkoutBtn = document.getElementById('cart-checkout')
if (checkoutBtn) {
  checkoutBtn.addEventListener('click', () => {
    if (cart.length === 0) return
    // If one item in cart, go directly to its payment link
    if (cart.length === 1) {
      const p = products[cart[0]]
      if (p && p.paymentLink) {
        window.open(p.paymentLink, '_blank')
      }
      return
    }
    // Multiple items — open each payment link in a new tab
    cart.forEach(id => {
      const p = products[id]
      if (p && p.paymentLink) {
        window.open(p.paymentLink, '_blank')
      }
    })
  })
}
