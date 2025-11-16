/* script.js
   - auto opens modal when clicking Book Now
   - auto fills bike + rates
   - calculates optimal total (months/weeks/days)
   - opens WhatsApp with prefilled message on confirm
   - change ADMIN_WHATSAPP to your admin number
*/

// ---------- CONFIG ----------
const ADMIN_WHATSAPP = "+917447869650"; // <-- replace with admin number, international format with no spaces, e.g. +919876543210

// ---------- DOM ----------
const bookButtons = document.querySelectorAll('.card .btn');
const modal = document.getElementById('bookingModal');
const closeModal = document.getElementById('closeModal');
const bikeModelInput = document.getElementById('bikeModel');
const rateDailyEl = document.getElementById('rateDaily');
const rateWeeklyEl = document.getElementById('rateWeekly');
const rateMonthlyEl = document.getElementById('rateMonthly');
const pickupInput = document.getElementById('pickupDate');
const returnInput = document.getElementById('returnDate');
const calcDaysEl = document.getElementById('calcDays');
const calcTotalEl = document.getElementById('calcTotal');
const calcBtn = document.getElementById('calcBtn');
const bookingForm = document.getElementById('bookingForm');
const toast = document.getElementById('toast');

// state for currently selected bike rates
let currentRates = { daily: 0, weekly: 0, monthly: 0 };
let selectedBikeName = "";

// open modal with bike info from data attributes
bookButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    selectedBikeName = btn.dataset.bike || "";
    currentRates.daily = Number(btn.dataset.daily) || 0;
    currentRates.weekly = Number(btn.dataset.weekly) || 0;
    currentRates.monthly = Number(btn.dataset.monthly) || 0;

    // fill UI
    bikeModelInput.value = selectedBikeName;
    rateDailyEl.textContent = `₹ ${currentRates.daily}`;
    rateWeeklyEl.textContent = `₹ ${currentRates.weekly}`;
    rateMonthlyEl.textContent = `₹ ${currentRates.monthly}`;
    calcDaysEl.textContent = '—';
    calcTotalEl.textContent = '—';
    pickupInput.value = '';
    returnInput.value = '';

    // show modal
    modal.setAttribute('aria-hidden', 'false');
  });
});

// close modal
closeModal.addEventListener('click', () => {
  modal.setAttribute('aria-hidden', 'true');
});

// helper: compute day difference inclusive (at least 1)
function daysBetweenInclusive(fromISO, toISO) {
  const f = new Date(fromISO);
  const t = new Date(toISO);
  // normalize to UTC midnight to avoid timezone issues
  const utc1 = Date.UTC(f.getFullYear(), f.getMonth(), f.getDate());
  const utc2 = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Math.round((utc2 - utc1) / msPerDay);
  return diff >= 0 ? diff + 1 : -1; // return -1 if invalid (to > from)
}

// compute best (min cost) breakdown using months(30d), weeks(7d), days(1d)
function computeBestPrice(days, rates) {
  if (days <= 0) return { total: 0, breakdown: [] };
  // Greedy approach: use months, then weeks, then days.
  const breakdown = [];
  let remaining = days;
  let total = 0;

  const months = Math.floor(remaining / 30);
  if (months > 0) {
    total += months * rates.monthly;
    breakdown.push({ type: 'month', count: months, price: months * rates.monthly });
    remaining -= months * 30;
  }

  const weeks = Math.floor(remaining / 7);
  if (weeks > 0) {
    total += weeks * rates.weekly;
    breakdown.push({ type: 'week', count: weeks, price: weeks * rates.weekly });
    remaining -= weeks * 7;
  }

  if (remaining > 0) {
    total += remaining * rates.daily;
    breakdown.push({ type: 'day', count: remaining, price: remaining * rates.daily });
    remaining = 0;
  }

  return { total, breakdown };
}

// show toast
function showToast(msg, ms = 2800) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), ms);
}

// calculate button handler
calcBtn.addEventListener('click', () => {
  const from = pickupInput.value;
  const to = returnInput.value;
  if (!from || !to) { showToast('Please choose pickup and return dates'); return; }
  const days = daysBetweenInclusive(from, to);
  if (days < 0) { showToast('Return date must be same or after pickup date'); return; }

  const res = computeBestPrice(days, { daily: currentRates.daily, weekly: currentRates.weekly, monthly: currentRates.monthly });
  calcDaysEl.textContent = `${days} day${days>1? 's':''}`;
  calcTotalEl.textContent = `₹ ${res.total}`;
  // optionally store breakdown on element for confirm
  bookingForm.dataset.calcTotal = res.total;
  bookingForm.dataset.calcBreakdown = JSON.stringify(res.breakdown);
});

// submit (confirm) handler -> open WhatsApp with prefilled message
bookingForm.addEventListener('submit', (evt) => {
  evt.preventDefault();

  // gather fields
  const name = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  const bike = bikeModelInput.value.trim();
  const pickup = pickupInput.value;
  const ret = returnInput.value;

  // ensure calculated result exists; if not, compute now
  let total = Number(bookingForm.dataset.calcTotal || 0);
  let breakdown = [];
  if (!total) {
    const days = daysBetweenInclusive(pickup, ret);
    if (days < 0) { showToast('Return date must be same or after pickup date'); return; }
    const res = computeBestPrice(days, { daily: currentRates.daily, weekly: currentRates.weekly, monthly: currentRates.monthly });
    total = res.total;
    breakdown = res.breakdown;
  } else {
    try { breakdown = JSON.parse(bookingForm.dataset.calcBreakdown || '[]'); } catch(e){ breakdown = []; }
  }

  if (!name || !phone || !pickup || !ret) {
    showToast('Please fill all required fields');
    return;
  }

  // prepare breakdown text
  let breakdownText = breakdown.map(b => {
    if (b.type === 'month') return `${b.count} × month(s) = ₹${b.price}`;
    if (b.type === 'week') return `${b.count} × week(s) = ₹${b.price}`;
    return `${b.count} × day(s) = ₹${b.price}`;
  }).join('; ');

  if (!breakdownText) breakdownText = 'N/A';

  // WhatsApp message
  const message =
`New Booking Request
Name: ${name}
Phone: ${phone}
Bike: ${bike}
Pickup: ${pickup}
Return: ${ret}
Breakdown: ${breakdownText}
Total: ₹ ${total}
(Please contact customer to confirm)`;

  const encoded = encodeURIComponent(message);

  // open WhatsApp web/mobile
  const waUrl = `https://wa.me/${ADMIN_WHATSAPP.replace(/^\+/, '')}?text=${encoded}`;
  // open in new tab/window
  window.open(waUrl, '_blank');

  // show success toast + close modal after brief delay
  showToast('WhatsApp opened — message ready to send to admin');
  setTimeout(() => {
    modal.setAttribute('aria-hidden', 'true');
    bookingForm.reset();
    calcDaysEl.textContent = '—';
    calcTotalEl.textContent = '—';
  }, 1000);
});
