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
  video.src = introSrc
  video.loop = false

  // Poster image stacked over the videos until one is genuinely playing.
  // Covers any native blocked-autoplay glyph (iOS Low Power Mode) — the
  // user can never see a play button, only the still frame.
  const posterEl = document.createElement('img')
  posterEl.src = posterSrc
  posterEl.alt = ''
  posterEl.setAttribute('aria-hidden', 'true')
  posterEl.className = 'bg-layer'
  video.parentNode.insertBefore(posterEl, video.nextSibling)

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

  function revealIntro() {
    introStarted = true
    posterEl.style.display = 'none'
    startLoopLoad()
    removeGestureRetries()
  }
  // Swap poster → video on the exact frame the video first renders
  // (requestVideoFrameCallback), not on the earlier 'playing' event —
  // keeps the handoff invisible. 'playing' + timeout is the fallback for
  // browsers without rVFC or where it stalls.
  if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
    video.requestVideoFrameCallback(revealIntro)
    video.addEventListener('playing', () => {
      startLoopLoad()
      setTimeout(() => { if (!introStarted) revealIntro() }, 250)
    })
  } else {
    video.addEventListener('playing', revealIntro)
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
  function tryPlayOnGesture() {
    if (introStarted) { removeGestureRetries(); return }
    video.play().catch(() => {})
  }
  function removeGestureRetries() {
    gestureEvents.forEach(ev => document.removeEventListener(ev, tryPlayOnGesture))
  }
  const firstAttempt = video.play()
  if (firstAttempt && firstAttempt.catch) {
    firstAttempt.catch(() => {
      if (!introStarted) {
        gestureEvents.forEach(ev => document.addEventListener(ev, tryPlayOnGesture, { passive: true }))
      }
    })
  }

  video.addEventListener('ended', () => {
    introDone = true
    loopEl.currentTime = 0
    // If the loop's play() is refused, retry on the next user gesture
    const tryLoop = () => {
      loopEl.play().then(() => {
        gestureEvents.forEach(ev => document.removeEventListener(ev, tryLoop))
      }).catch(() => {})
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

// ─── Cart system ───
const cart = []
// Every price below is verified to match its Stripe payment link exactly
// (checked against the live checkout pages on 2026-07-28). If a price changes,
// remember Stripe prices are immutable — add a new price, make a new payment
// link, and swap BOTH the number and the URL here so they never drift apart.
const products = {
  // Tier IDs map to display names as: basic = website, core = Meta ads,
  // elite = the full package. (The ID is NOT the price tier order — it's just
  // a stable key wired to a fixed Stripe product, so never reassign a link.)
  // Stripe "Website Creation" — $749 one-off.
  basic: { name: 'Basic — Website + SEO', desc: 'Custom-built conversion website with SEO built in', upfront: 749, monthly: 0, available: true, paymentLink: 'https://buy.stripe.com/4gMcN7du69As2km4c4bQY01' },
  // Stripe "Meta Ad Management" — $999/mo recurring, no trial, so the first $999
  // is charged at signup and $999/mo after.
  core: { name: 'Core — Meta Ad Creation & Management', desc: 'Meta ads strategy, creative, scripting & management', upfront: 0, monthly: 999, available: true, paymentLink: 'https://buy.stripe.com/6oU9AV75IcMEe34380bQY05' },
  // Elite BASE — Stripe "ELITE-THE COMPLETE PACKAGE" (link eVqf...): $1,499 due
  // today, NO free trial. DISPLAYED as $1,499 to start, then $999/mo (modeled as
  // upfront $500 + monthly $999 so due-today = $1,499 and ongoing shows $999/mo).
  // NOTE: the Stripe link actually bills $1,000/mo — update the Stripe price to
  // $999/mo (new price + new link) so the charge matches this display.
  elite: { name: 'Elite — The Full Package', desc: 'Website + social media guide + Meta ads set up & run, plus an optional full brand redesign', upfront: 500, monthly: 999, available: true, paymentLink: 'https://buy.stripe.com/eVqfZjahUcME8IK4c4bQY09' },
  // Elite WITH Website Management — Stripe "ELITE - FULL PACKAGE + WEBSITE
  // MANAGEMENT" (link cNid...): $1,499 today, then $1,149/mo after 30 days free.
  // The "+ Website Management" button on the Elite card SWAPS between this and the
  // base above — they're two separate Stripe products, so only ONE is ever in the
  // cart at a time (never both, or checkout would charge the setup twice).
  eliteManaged: { name: 'Elite — The Full Package + Website Management', desc: 'Everything in the full package, plus ongoing website management & domain management', upfront: 1499, monthly: 1149, monthlyTrialDays: 30, available: true, paymentLink: 'https://buy.stripe.com/cNidRbgGiaEw7EGfUMbQY0a' },
  // Stripe "CORE--Website management SEO RECURRING" — $249/mo recurring.
  // Now includes domain management — if the client wants a domain email, we buy
  // the domain and set it up for them. Standalone add-on for non-Elite clients;
  // on Elite it's the "+ Website Management" upgrade (base $1,000/mo → $1,149/mo).
  management: { name: 'Bundle Management', desc: 'Unlimited website edits & domain management', upfront: 0, monthly: 249, available: true, paymentLink: 'https://buy.stripe.com/fZu5kF61E8wof788skbQY06' }
}

const cartItemsEl = document.getElementById('cart-items')
const cartEmptyEl = document.getElementById('cart-empty')
const cartFooterEl = document.getElementById('cart-footer')
const cartCountEl = document.getElementById('cart-count')
const cartTotalEl = document.getElementById('cart-total')
const cartNoteEl = document.getElementById('cart-note')
const cartIconLink = document.querySelector('.nav__link--icon')

function addToCart(productId) {
  if (cart.includes(productId)) return
  cart.push(productId)
  renderCart()
  // Close service panel and go back to services
  closeAllPanels()
  updateCartBadge()
  syncCartButtons()
  resetCheckout()
}

function removeFromCart(productId) {
  const idx = cart.indexOf(productId)
  if (idx !== -1) cart.splice(idx, 1)
  renderCart()
  updateCartBadge()
  syncCartButtons()
  resetCheckout()
}

// Keep every ADD TO CART button in step with the cart — items can also be
// removed from the cart panel, which the buttons otherwise never hear about
function syncCartButtons() {
  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    const pid = btn.dataset.product
    // Elite's button reflects EITHER variant (base or +management) being in cart.
    const inCart = cart.includes(pid) || (pid === 'elite' && cart.includes('eliteManaged'))
    btn.textContent = inCart ? 'REMOVE' : '+ ADD TO CART'
    btn.classList.toggle('added', inCart)
  })
  // Elite's "+ Website Management" pill is ADDED when the managed variant is in
  // the cart; the class toggle keeps its label markup intact.
  document.querySelectorAll('.bundle-mgmt-btn--addon').forEach(btn => {
    btn.classList.toggle('added', cart.includes(btn.dataset.managed))
  })
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
  let totalMonthly = 0        // recurring price after any free trial
  let monthlyDueToday = 0     // recurring charged as part of today's payment (no trial)
  let anyTrial = false
  cart.forEach(id => {
    const p = products[id]
    if (!p) return
    totalUpfront += p.upfront
    totalMonthly += p.monthly
    if (p.monthly > 0 && !p.monthlyTrialDays) monthlyDueToday += p.monthly
    if (p.monthly > 0 && p.monthlyTrialDays) anyTrial = true
    const item = document.createElement('div')
    item.className = 'cart-item'
    let priceHtml = ''
    if (p.upfront > 0 && p.monthly > 0) {
      // Full package + recurring. With a free trial the monthly isn't charged
      // today, so "due now" is just the upfront.
      const startNow = p.monthlyTrialDays ? p.upfront : p.upfront + p.monthly
      const after = p.monthlyTrialDays
        ? `then $${p.monthly.toLocaleString()}/mo after ${p.monthlyTrialDays} days free`
        : `to start, then $${p.monthly.toLocaleString()}/mo`
      priceHtml = `<span class="cart-item__price">$${startNow.toLocaleString()}</span><span class="cart-item__monthly">${after}</span>`
    } else if (p.monthly > 0) {
      priceHtml = `<span class="cart-item__price">$${p.monthly.toLocaleString()}/mo</span>`
    } else {
      priceHtml = `<span class="cart-item__price">$${p.upfront.toLocaleString()}</span>`
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

  const dueToday = totalUpfront + monthlyDueToday
  if (totalMonthly > 0) {
    cartTotalEl.innerHTML = '$' + dueToday.toLocaleString() + ' <span class="cart-total__after">then $' + totalMonthly.toLocaleString() + '/mo</span>'
  } else {
    cartTotalEl.innerHTML = '$' + dueToday.toLocaleString()
  }

  // Note reflects the actual cart: only mention recurring billing when
  // something in the cart is genuinely monthly. A one-time item (e.g. the
  // $1499 Ultimate) must never say "billed monthly." With a free trial the
  // monthly starts later, so today's charge is just setup.
  if (cartNoteEl) {
    if (totalMonthly > 0) {
      cartNoteEl.textContent = anyTrial
        ? 'Today covers your setup. Monthly billing starts after your free trial. Cancel anytime.'
        : 'First payment covers setup + month one. Then billed monthly. Cancel anytime.'
    } else {
      cartNoteEl.textContent = 'One-time payment.'
    }
  }

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
      if (productId === 'elite') {
        // Elite has two variants (base / +management). The ADD TO CART button
        // toggles whichever variant is in the cart, and never adds a second.
        if (cart.includes('elite')) removeFromCart('elite')
        else if (cart.includes('eliteManaged')) removeFromCart('eliteManaged')
        else addToCart('elite')
      } else if (cart.includes(productId)) {
        removeFromCart(productId)
      } else {
        addToCart(productId)
      }
    }
  }

  // Elite's "+ Website Management" pill swaps the Elite line between the base
  // package and the combined "+ Website Management" package. They're two separate
  // Stripe products, so only ONE is ever in the cart (never both, or the setup
  // would be charged twice).
  const addonBtn = e.target.closest('.bundle-mgmt-btn--addon')
  if (addonBtn) {
    e.stopPropagation()
    const base = addonBtn.dataset.base
    const managed = addonBtn.dataset.managed
    if (cart.includes(managed)) {
      removeFromCart(managed)
      addToCart(base)
    } else {
      if (cart.includes(base)) removeFromCart(base)
      addToCart(managed)
    }
  }
})

// ─── Service info overlay ───
const serviceInfo = {
  basic: {
    title: 'BASIC — WEBSITE + SEO',
    price: '$749 one-time',
    sections: [
      { title: 'CUSTOM DESIGN & BUILD', text: 'No templates. No drag-and-drop builders. Your site is designed from scratch to match your business\'s brand, personality, and goals. Every element is intentional — from the layout to the color palette to the call-to-action placement.' },
      { title: 'CONVERSION ENGINEERING', text: 'Beautiful isn\'t enough. Every page is built to convert visitors into customers. Strategic placement of booking buttons, trust signals, testimonials, and contact forms. We study what makes customers click — and we build around that.' },
      { title: 'SEO BUILT INTO THE CODE', text: 'Your site launches with SEO built into the backend code — meta tags, schema markup, Google Business integration, local keywords, and fast load times, so you\'re set up to rank from day one. Built in at launch — not an ongoing service.' },
      { title: 'MOBILE-FIRST & FAST', text: 'Over 60% of local searches happen on phones. Your site loads in under 2 seconds, looks perfect on every device, and passes every Google speed test. Slow sites lose customers — yours won\'t.' },
      { title: 'WANT ONGOING EDITS?', text: 'Basic covers the build. If you want us to keep making changes to your site — copy, photos, pricing, new pages — add Bundle Management — $249/mo.' }
    ]
  },
  core: {
    title: 'CORE — META AD CREATION & MANAGEMENT',
    price: '$999/mo — first month charged today',
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
    price: '$1,499 to start, then $999/mo — or $1,149/mo with Website Management',
    sections: [
      { title: 'CUSTOM WEBSITE', text: 'A custom-built, conversion-ready website — designed from scratch to match your brand, engineered to turn visitors into booked customers, with SEO built in from day one. Your digital storefront, done right.' },
      { title: 'DETAIL PRO — ELITE TIER, FREE FOR A YEAR', text: 'One full year of Detail Pro on the Elite tier — completely free, on us. The top plan of our detailing app: run your whole operation — customers, appointments, scheduling, and more — unlocked for 12 months.' },
      { title: 'META ADS — SET UP & RUN', text: 'We set up your Facebook and Instagram ads and run them for your entire first month — strategy, creative, targeting, and daily optimization. Your campaigns go live and start working while you focus on the work.' },
      { title: 'OPTIONAL FULL BRAND REDESIGN', text: 'Want a fresh look to match? We\'ll redesign your door hangers, logo, A-frame sign, flyers — everything. Print-ready and on-brand, so every touchpoint looks like an established business.' },
      { title: 'ADD WEBSITE MANAGEMENT', text: 'Keep it all running for you — unlimited website edits and domain management. Add it onto Elite for $149/mo more (your Elite goes from $999/mo to $1,149/mo).' }
    ]
  },
  management: {
    title: 'BUNDLE MANAGEMENT',
    price: '$249/mo — or $149/mo bundled with Elite',
    sections: [
      { title: 'UNLIMITED WEBSITE EDITS', text: 'Change anything on your site, whenever you want — copy, photos, pricing, hours, new pages. Just ask, and it\'s done. No per-edit invoices.' },
      { title: 'DOMAIN MANAGEMENT', text: 'Your domain is handled for you. Want a professional domain email (you@yourbusiness.com)? We buy the domain and set the whole thing up — no registrars to wrangle, no DNS headaches.' },
      { title: 'ONE FLAT MONTHLY FEE', text: 'One predictable monthly fee covers website management and domain management — no separate vendors, no surprise bills. Add it onto the Elite package and it\'s $149/mo — $100 off.' }
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
  const isScrollArea = e.target.closest('.scroll-container') && !e.target.closest('.panel') && !e.target.closest('.info-overlay') && !e.target.closest('.review-detail') && !e.target.closest('.pricing-panel') && !e.target.closest('.review-form-overlay')
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

// ─── Checkout — open Stripe payment links ───
// Popup blockers allow one window.open per user gesture, so with multiple
// items we open them one click at a time and turn the button into a stepper.
const checkoutBtn = document.getElementById('cart-checkout')
let checkoutQueue = []

function resetCheckout() {
  checkoutQueue = []
  if (checkoutBtn) checkoutBtn.textContent = 'PROCEED TO CHECKOUT'
}

if (checkoutBtn) {
  checkoutBtn.addEventListener('click', () => {
    if (cart.length === 0) return
    if (checkoutQueue.length === 0) checkoutQueue = [...cart]
    const id = checkoutQueue.shift()
    const p = products[id]
    if (p && p.paymentLink) {
      // Guard against a not-yet-created Stripe link (e.g. the $149/mo Elite
      // bundle price) so we never open a broken tab or charge the wrong amount.
      if (p.paymentLink.startsWith('PENDING_')) {
        alert('This add-on isn’t ready for online checkout yet — reach out via the contact form and we’ll set it up for you.')
      } else {
        window.open(p.paymentLink, '_blank')
      }
    }
    if (checkoutQueue.length > 0) {
      const opened = cart.length - checkoutQueue.length
      checkoutBtn.textContent = `OPEN NEXT PAYMENT (${opened}/${cart.length} OPENED)`
    } else {
      checkoutBtn.textContent = 'PROCEED TO CHECKOUT'
    }
  })
}

// ─── Elite "offer ends in" countdown ───────────────────────────────
// Evergreen 48-hour urgency timer. Each visitor gets their own 48h window
// stored in localStorage, so it keeps ticking across reloads and loops:
// when it reaches zero it rolls straight back to a fresh 48h and counts
// down again (never shows a dead 00:00:00).
;(function initEliteCountdown() {
  const root = document.getElementById('elite-countdown')
  if (!root) return

  const OFFER_MS = 48 * 60 * 60 * 1000
  const KEY = 'apexEliteOfferDeadline'
  const hEl = root.querySelector('[data-cd="h"]')
  const mEl = root.querySelector('[data-cd="m"]')
  const sEl = root.querySelector('[data-cd="s"]')
  const pad = (n) => String(n).padStart(2, '0')

  function getDeadline() {
    let dl = parseInt(localStorage.getItem(KEY) || '', 10)
    if (!dl || isNaN(dl) || dl - Date.now() > OFFER_MS || dl <= Date.now()) {
      dl = Date.now() + OFFER_MS
      try { localStorage.setItem(KEY, String(dl)) } catch (e) { /* private mode */ }
    }
    return dl
  }

  let deadline = getDeadline()

  function tick() {
    let remaining = deadline - Date.now()
    if (remaining <= 0) {            // window elapsed → roll a fresh 44h
      deadline = getDeadline()
      remaining = deadline - Date.now()
    }
    const totalSec = Math.floor(remaining / 1000)
    hEl.textContent = pad(Math.floor(totalSec / 3600))
    mEl.textContent = pad(Math.floor((totalSec % 3600) / 60))
    sEl.textContent = pad(totalSec % 60)
  }

  tick()
  setInterval(tick, 1000)
})()
