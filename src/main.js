// Impact Makers CSC Mart — Customer Storefront Controller
import { 
  db, 
  collection, 
  getDocs, 
  addDoc, 
  serverTimestamp 
} from './lib/firebase.js';
import { initialProducts } from './data/products.js';
import { openPaystackPayment } from './lib/paystack.js';

// DOM Selectors
const grid = document.getElementById('product-grid');
const emptyState = document.getElementById('empty-state');
const cartBtn = document.getElementById('cart-btn');
const cartCount = document.getElementById('cart-count');
const drawerCartCount = document.getElementById('drawer-cart-count');
const cartDrawerOverlay = document.getElementById('cart-drawer-overlay');
const closeCartBtn = document.getElementById('close-cart-btn');
const cartItemsContainer = document.getElementById('cart-items-container');
const cartSubtotalEl = document.getElementById('cart-subtotal');
const clearCartBtn = document.getElementById('clear-cart-btn');
const openCheckoutModalBtn = document.getElementById('open-checkout-modal-btn');

// Checkout modal
const checkoutModal = document.getElementById('checkout-modal');
const closeCheckoutBtn = document.getElementById('close-checkout-btn');
const checkoutForm = document.getElementById('checkout-form');
const custStateSelect = document.getElementById('cust-state');
const orderSubtotalEl = document.getElementById('order-subtotal');
const orderDeliveryEl = document.getElementById('order-delivery');
const orderTotalEl = document.getElementById('order-total');

// Mobile Bar
const mobileCartBar = document.getElementById('mobile-cart-bar');
const mobileCartCount = document.getElementById('mobile-cart-count');
const mobileCartTotal = document.getElementById('mobile-cart-total');
const mobileCheckoutBtn = document.getElementById('mobile-checkout-btn');

// Search & Filter
const searchInput = document.getElementById('search-input');
const searchClearBtn = document.getElementById('search-clear-btn');
const catPills = document.querySelectorAll('.cat-pill');
const sortSelect = document.getElementById('sort-select');
const catalogTitle = document.getElementById('catalog-title');
const catalogSubtitle = document.getElementById('catalog-subtitle');

// Confirmation modal
const successModal = document.getElementById('success-modal');
const successOrderId = document.getElementById('success-order-id');
const successDoneBtn = document.getElementById('success-done-btn');

// Delivery cost mapping (in Naira)
const DELIVERY_RATES = {
  covenant: 400,
  ota: 1500,
  bells: 1500,
  ogun_other: 2500,
  lagos: 3000,
  nationwide: 4500
};

// State
let allProducts = [...initialProducts];
let currentCategory = 'all';
let searchQuery = '';
let currentSort = 'featured';
let cart = JSON.parse(localStorage.getItem('imcsc_cart') || '[]');

// Utility: format Naira
function formatNaira(n) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(n);
}

// 1. Fetch live products from Firestore (falls back to initial 42 local products)
async function loadProducts() {
  try {
    const querySnapshot = await getDocs(collection(db, 'products'));
    if (!querySnapshot.empty) {
      const fetched = [];
      querySnapshot.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() });
      });
      // Replace or merge with firestore products, keeping local affiliate/partner items intact
      const fetchedSkus = new Set(fetched.map(p => p.sku || p.id));
      const remainingInitial = initialProducts.filter(p => !fetchedSkus.has(p.sku || p.id));
      allProducts = [...fetched, ...remainingInitial];
    }
  } catch (err) {
    console.info('Using local catalogue data:', err.message);
  }
  applyFiltersAndRender();
}

// 2. Filter & Sort Logic
function applyFiltersAndRender() {
  if (catalogTitle && catalogSubtitle) {
    const titles = {
      all: { title: 'All Products', sub: 'Showing available inventory from our Ota store' },
      groceries: { title: 'Groceries & Foodstuffs', sub: 'Fresh, local, and packaged groceries from Covenant University' },
      snacks: { title: 'Snacks & Quick Bites', sub: 'Crunchy kuli-kuli, spiced treats, and energy snacks' },
      beauty: { title: 'Beauty & Personal Care', sub: 'Hair, skin, and wellness essentials' },
      books: { title: 'Books & Literature', sub: 'Educational guides, storybooks, and Kindle publications' },
      fashion: { title: 'Fashion & Accessories', sub: 'Clothing, wear, and lifestyle picks' },
      partners: { title: 'Our Partner Stores', sub: 'Official international & digital partner stores by CCYI Global Enterprise' }
    };
    const current = titles[currentCategory] || { title: 'Products', sub: 'Explore our store inventory' };
    catalogTitle.textContent = current.title;
    catalogSubtitle.textContent = current.sub;
  }

  let filtered = allProducts.filter(p => {
    // If browsing "all" catalogue, omit partner store profile cards unless searching specifically
    if (currentCategory === 'all' && p.category === 'partners' && !searchQuery) {
      return false;
    }
    // category filter
    const matchesCat = currentCategory === 'all' || p.category === currentCategory;
    // search filter
    const term = searchQuery.toLowerCase().trim();
    const matchesSearch = !term || 
      p.name.toLowerCase().includes(term) || 
      p.sku.toLowerCase().includes(term) ||
      (p.author && p.author.toLowerCase().includes(term)) ||
      (p.description && p.description.toLowerCase().includes(term));
    return matchesCat && matchesSearch;
  });

  // Sort
  if (currentSort === 'price-asc') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (currentSort === 'price-desc') {
    filtered.sort((a, b) => b.price - a.price);
  } else if (currentSort === 'name') {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    // featured
    filtered.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  }

  renderProducts(filtered);
}

// 3. Render Product Grid
function renderProducts(items) {
  if (items.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  grid.innerHTML = items.map(p => {
    const isPartner = p.category === 'partners';
    const isExternal = Boolean(p.externalUrl) || isPartner;
    const isUnpriced = !p.price || p.price <= 0;
    const isOutOfStock = p.stock !== undefined && p.stock <= 0 && !isUnpriced && !isExternal;

    let priceHtml = '';
    let btnHtml = '';

    if (isPartner) {
      const badge = p.badgeText || '🌐 Official Partner';
      priceHtml = `
        <span class="stock-status" style="background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1; font-weight:700;">${badge}</span>
      `;
      btnHtml = `
        <a href="${p.externalUrl}" target="_blank" rel="noopener noreferrer" class="add-cart-btn ${p.btnClass || ''}" style="${p.btnStyle || ''} text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px;" title="Visit ${p.name}">
          ${p.btnLabel || 'Visit Store ↗'}
        </a>
      `;
    } else if (isExternal) {
      const priceDisplay = p.priceUsd 
        ? `${p.priceUsd} <span style="font-size:12px; font-weight:normal; color:#64748b;">(~${formatNaira(p.price)})</span>` 
        : formatNaira(p.price);
      priceHtml = `
        <span class="price-tag">${priceDisplay}</span>
        <span class="stock-status" style="background:#fffbeb; color:#b45309; border:1px solid #fde68a;">Amazon Kindle</span>
      `;
      btnHtml = `
        <a href="${p.externalUrl}" target="_blank" rel="noopener noreferrer" class="add-cart-btn btn-amazon" title="Buy on Amazon (Kindle eBook)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/>
          </svg>
          Buy on Amazon ↗
        </a>
      `;
    } else if (isUnpriced) {
      priceHtml = `<span class="unpriced-tag">Contact for Price</span>`;
      btnHtml = `<button class="add-cart-btn btn-inquire" data-sku="${p.sku}" data-action="inquire">💬 Inquire via WhatsApp</button>`;
    } else if (isOutOfStock) {
      priceHtml = `<span class="price-tag">${formatNaira(p.price)}</span>`;
      btnHtml = `<button class="add-cart-btn" disabled>Out of Stock</button>`;
    } else {
      priceHtml = `
        <span class="price-tag">${formatNaira(p.price)}</span>
        <span class="stock-status">In Stock (${p.stock})</span>
      `;
      btnHtml = `<button class="add-cart-btn add-btn" data-sku="${p.sku}">Add to Cart</button>`;
    }

    return `
      <article class="product-card" data-sku="${p.sku}">
        <div class="product-thumb">
          <img src="${p.image || '/assets/products/product-01.jpg'}" alt="${p.name}" loading="lazy" />
          ${p.featured ? '<span class="badge-tag flash">⚡ Flash Deal</span>' : ''}
          ${isPartner ? `<span class="badge-tag" style="background:#0f172a; color:#f8fafc; font-weight:700;">${p.badgeText || '🤝 Partner'}</span>` : ''}
          ${isExternal && !isPartner ? '<span class="badge-tag" style="background:#131921; color:#ff9900; font-weight:700;">📚 Amazon Book</span>' : ''}
          ${isUnpriced && !isExternal ? '<span class="badge-tag unpriced">Catalogue Item</span>' : ''}
        </div>
        <div class="product-details">
          <span class="product-category">${isPartner ? 'Partner Store' : (p.category || 'General')}</span>
          <h3 class="product-title" title="${p.name}">${p.name}</h3>
          ${p.author ? `<p style="font-size:12px; color:#64748b; margin:2px 0 6px 0; font-weight:600;">By ${p.author}</p>` : ''}
          <div class="product-price-row">
            ${priceHtml}
          </div>
          ${btnHtml}
        </div>
      </article>
    `;
  }).join('');
}

// 4. Cart UI & Storage Handlers
function updateCartUI() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const total = cart.reduce((s, i) => s + (i.price || 0) * i.qty, 0);

  cartCount.textContent = count;
  drawerCartCount.textContent = count;
  cartSubtotalEl.textContent = formatNaira(total);

  // Mobile bar
  if (count > 0) {
    mobileCartBar.style.display = 'flex';
    mobileCartCount.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
    mobileCartTotal.textContent = formatNaira(total);
  } else {
    mobileCartBar.style.display = 'none';
  }

  // Render drawer items
  if (cart.length === 0) {
    cartItemsContainer.innerHTML = '<p class="empty-cart-msg">Your shopping cart is currently empty.</p>';
  } else {
    cartItemsContainer.innerHTML = cart.map(item => `
      <div class="cart-item-row">
        <img src="${item.image || '/assets/products/product-01.jpg'}" alt="${item.name}" class="cart-item-img" />
        <div class="cart-item-info">
          <h4>${item.name}</h4>
          <div class="cart-item-price">${formatNaira(item.price)}</div>
          <div class="cart-qty-ctrls">
            <button class="qty-btn" data-sku="${item.sku}" data-delta="-1">−</button>
            <span>${item.qty}</span>
            <button class="qty-btn" data-sku="${item.sku}" data-delta="1">+</button>
            <button class="cart-item-remove" data-sku="${item.sku}">Remove</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  localStorage.setItem('imcsc_cart', JSON.stringify(cart));
}

function addToCart(sku) {
  const product = allProducts.find(p => p.sku === sku);
  if (!product || !product.price || product.price <= 0) return;

  const existing = cart.find(i => i.sku === sku);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      sku: product.sku,
      name: product.name,
      price: product.price,
      image: product.image,
      qty: 1
    });
  }
  updateCartUI();
  // Open drawer so customer sees item added
  cartDrawerOverlay.style.display = 'flex';
}

function updateItemQuantity(sku, delta) {
  const item = cart.find(i => i.sku === sku);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(i => i.sku !== sku);
  }
  updateCartUI();
}

function removeFromCart(sku) {
  cart = cart.filter(i => i.sku !== sku);
  updateCartUI();
}

// 5. Inquire on WhatsApp for unpriced items
function inquireWhatsApp(sku) {
  const product = allProducts.find(p => p.sku === sku);
  const text = encodeURIComponent(
    `Hello Impact Makers CSC Mart! I am interested in ordering: "${product ? product.name : sku}" (SKU: ${sku}). Please share the current price and availability.`
  );
  window.open(`https://wa.me/2347035129387?text=${text}`, '_blank');
}

// 6. Checkout Flow
function openCheckout() {
  if (cart.length === 0) {
    alert('Your cart is empty. Please add items to cart first.');
    return;
  }
  cartDrawerOverlay.style.display = 'none';
  calculateOrderTotals();
  checkoutModal.style.display = 'flex';
}

function calculateOrderTotals() {
  const subtotal = cart.reduce((s, i) => s + (i.price || 0) * i.qty, 0);
  const region = custStateSelect.value || 'ota';
  const delivery = DELIVERY_RATES[region] || 1500;
  const total = subtotal + delivery;

  orderSubtotalEl.textContent = formatNaira(subtotal);
  orderDeliveryEl.textContent = formatNaira(delivery);
  orderTotalEl.textContent = formatNaira(total);
}

// 7. Event Listeners
grid.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const sku = btn.dataset.sku;
  if (btn.classList.contains('add-btn')) {
    addToCart(sku);
  } else if (btn.classList.contains('btn-inquire')) {
    inquireWhatsApp(sku);
  }
});

// Cart drawer actions
cartBtn.addEventListener('click', () => { cartDrawerOverlay.style.display = 'flex'; });
closeCartBtn.addEventListener('click', () => { cartDrawerOverlay.style.display = 'none'; });
cartDrawerOverlay.addEventListener('click', e => {
  if (e.target === cartDrawerOverlay) cartDrawerOverlay.style.display = 'none';
});

cartItemsContainer.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const sku = btn.dataset.sku;
  if (btn.classList.contains('qty-btn')) {
    updateItemQuantity(sku, parseInt(btn.dataset.delta, 10));
  } else if (btn.classList.contains('cart-item-remove')) {
    removeFromCart(sku);
  }
});

clearCartBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear your cart?')) {
    cart = [];
    updateCartUI();
  }
});

openCheckoutModalBtn.addEventListener('click', openCheckout);
mobileCheckoutBtn.addEventListener('click', openCheckout);

// Close checkout modal
closeCheckoutBtn.addEventListener('click', () => { checkoutModal.style.display = 'none'; });
checkoutModal.addEventListener('click', e => {
  if (e.target === checkoutModal) checkoutModal.style.display = 'none';
});

custStateSelect.addEventListener('change', calculateOrderTotals);

// Search & category filters
searchInput.addEventListener('input', e => {
  searchQuery = e.target.value;
  searchClearBtn.style.display = searchQuery ? 'block' : 'none';
  applyFiltersAndRender();
});

searchClearBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  searchClearBtn.style.display = 'none';
  applyFiltersAndRender();
});

catPills.forEach(pill => {
  pill.addEventListener('click', () => {
    catPills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentCategory = pill.dataset.cat;
    applyFiltersAndRender();
  });
});

sortSelect.addEventListener('change', e => {
  currentSort = e.target.value;
  applyFiltersAndRender();
});

// Payment method radio toggle & Copy button handlers
const payMethodRadios = document.querySelectorAll('input[name="pay-method"]');
const bankDetailsBox = document.getElementById('bank-details-box');
const payBtnText = document.getElementById('pay-btn-text');
const secureNote = document.getElementById('secure-note');
const labelPaystack = document.getElementById('label-paystack');
const labelBank = document.getElementById('label-bank');

payMethodRadios.forEach(radio => {
  radio.addEventListener('change', e => {
    if (e.target.value === 'bank') {
      bankDetailsBox.style.display = 'block';
      labelBank.classList.add('active');
      labelPaystack.classList.remove('active');
      payBtnText.textContent = '✅ Submit Order (Pay via Bank Transfer)';
      secureNote.textContent = '💡 Please transfer the order amount to GTBank or UBA above and notify us via WhatsApp.';
    } else {
      bankDetailsBox.style.display = 'none';
      labelPaystack.classList.add('active');
      labelBank.classList.remove('active');
      payBtnText.textContent = '🔒 Pay with Paystack (Cards, Transfer, USSD)';
      secureNote.textContent = '🛡️ Secured via Paystack 256-bit SSL encryption. Price & stock server-verified.';
    }
  });
});

// Copy account number buttons
document.addEventListener('click', e => {
  const copyBtn = e.target.closest('.copy-acc-btn');
  if (copyBtn) {
    const textToCopy = copyBtn.dataset.copy;
    navigator.clipboard.writeText(textToCopy).then(() => {
      const origText = copyBtn.textContent;
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => { copyBtn.textContent = origText; }, 2000);
    }).catch(() => {
      prompt('Copy account number:', textToCopy);
    });
  }
});

// 8. Handle Checkout Form Submit -> Save Order & Handle Selected Payment Mode
checkoutForm.addEventListener('submit', async e => {
  e.preventDefault();

  const submitBtn = document.getElementById('pay-btn');
  const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳ Processing order...</span>';
  }

  try {
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const email = document.getElementById('cust-email').value.trim();
    const address = document.getElementById('cust-address').value.trim();
    const notes = document.getElementById('cust-notes').value.trim();
    const region = custStateSelect.value;
    const delivery = DELIVERY_RATES[region] || 1500;
    const subtotal = cart.reduce((s, i) => s + (i.price || 0) * i.qty, 0);
    const total = subtotal + delivery;

    const orderId = 'IMCSC-' + Math.floor(100000 + Math.random() * 900000);
    const selectedPaymentMethod = document.querySelector('input[name="pay-method"]:checked')?.value || 'paystack';

    const orderData = {
      orderId,
      customer: { name, phone, email, address, region, notes },
      items: [...cart],
      subtotal,
      deliveryFee: delivery,
      total,
      status: 'Pending',
      paymentMethod: selectedPaymentMethod,
      paymentStatus: selectedPaymentMethod === 'bank' ? 'awaiting_bank_transfer' : 'pending',
      createdAt: serverTimestamp ? serverTimestamp() : new Date().toISOString()
    };

    // Save to Firestore with timeout fallback so slow network never freezes the button
    const saveToFirestore = async () => {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 3000));
        await Promise.race([
          addDoc(collection(db, 'orders'), orderData),
          timeoutPromise
        ]);
      } catch (err) {
        console.warn('Firestore order record created locally / error:', err.message);
      }
    };
    saveToFirestore();

    // Trigger Telegram Instant Bot Notification
    const notifyTelegram = (data) => {
      fetch('/api/notify-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(err => console.warn('Telegram notification trigger:', err));
    };

    // Branch based on payment method
    if (selectedPaymentMethod === 'bank') {
      // Notify Telegram right away for Direct Bank Transfer
      notifyTelegram(orderData);

      // Complete Order via Direct Bank Transfer
      cart = [];
      updateCartUI();
      checkoutModal.style.display = 'none';
      successOrderId.textContent = orderId;
      
      // Format WhatsApp confirmation link
      const waText = encodeURIComponent(
        `Hello Impact Makers CSC Mart! I have placed Order ${orderId} for ${formatNaira(total)} via Bank Transfer.\nName: ${name}\nPhone: ${phone}\nAddress: ${address}\nI am sending my proof of payment.`
      );
      
      const nextStepsCard = document.querySelector('.next-steps-card');
      if (nextStepsCard) {
        nextStepsCard.innerHTML = `
          <p><strong>Next Step for Bank Transfer:</strong></p>
          <p>Please send your payment receipt/screenshot on WhatsApp with your Order Reference <strong>${orderId}</strong>.</p>
          <p style="margin-top:10px;">
            <a href="https://wa.me/2347035129387?text=${waText}" target="_blank" class="btn-primary" style="display:inline-block; text-decoration:none; padding:8px 16px; font-size:13px; background:#25d366; border:none;">
              💬 Send Receipt on WhatsApp (+234 703 512 9387)
            </a>
          </p>
        `;
      }
      
      successModal.style.display = 'flex';
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    } else {
      // Trigger Paystack Inline Payment
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
      openPaystackPayment({
        email,
        amount: total,
        orderId,
        metadata: {
          customerName: name,
          customerPhone: phone,
          address: address
        },
        onSuccess: function (response) {
          // Notify Telegram with paid status and Paystack reference
          notifyTelegram({
            ...orderData,
            paymentStatus: 'paid_paystack',
            paystackRef: response.reference
          });

          // Complete Order
          cart = [];
          updateCartUI();
          checkoutModal.style.display = 'none';
          successOrderId.textContent = orderId;
          successModal.style.display = 'flex';
        },
        onClose: function () {
          alert('Payment was not completed. You can re-open checkout whenever you are ready.');
        }
      });
    }
  } catch (err) {
    console.error('Checkout error:', err);
    alert('An unexpected error occurred. Please try again or place your order via WhatsApp.');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    }
  }
});

// Success modal button
successDoneBtn.addEventListener('click', () => {
  successModal.style.display = 'none';
});

// Countdown timer demo
let t = 2 * 3600 + 45 * 60 + 12;
setInterval(() => {
  t = t > 0 ? t - 1 : 0;
  const h = String(Math.floor(t / 3600)).padStart(2, '0');
  const m = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
  const s = String(t % 60).padStart(2, '0');
  const timerEl = document.getElementById('flash-timer');
  if (timerEl) timerEl.textContent = `${h}:${m}:${s}`;
}, 1000);

// Initialize
loadProducts();
updateCartUI();
