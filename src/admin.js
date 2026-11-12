// Impact Makers CSC Mart — Admin Control Center Logic
import { 
  auth, 
  db, 
  storage,
  ADMIN_EMAIL,
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  ref, 
  uploadBytes, 
  getDownloadURL 
} from './lib/firebase.js';

import { initialProducts } from './data/products.js';

// DOM Selectors - Auth
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const adminLoginForm = document.getElementById('admin-login-form');
const adminEmailInput = document.getElementById('admin-email');
const adminPasswordInput = document.getElementById('admin-password');
const loginError = document.getElementById('login-error');
const sendResetBtn = document.getElementById('send-reset-btn');
const resetMsg = document.getElementById('reset-msg');
const userInfo = document.getElementById('user-info');
const userEmailDisplay = document.getElementById('user-email-display');
const logoutBtn = document.getElementById('logout-btn');

// Stats
const statTotalProducts = document.getElementById('stat-total-products');
const statUnpricedProducts = document.getElementById('stat-unpriced-products');
const statActiveProducts = document.getElementById('stat-active-products');
const statTotalOrders = document.getElementById('stat-total-orders');
const initCatalogueBanner = document.getElementById('init-catalogue-banner');
const importCatalogueBtn = document.getElementById('import-catalogue-btn');

// Tabs
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Products Table
const adminProductsTableBody = document.getElementById('admin-products-table-body');
const adminSearchProducts = document.getElementById('admin-search-products');
const adminFilterStatus = document.getElementById('admin-filter-status');
const refreshProductsBtn = document.getElementById('refresh-products-btn');

// Orders Table
const adminOrdersTableBody = document.getElementById('admin-orders-table-body');
const adminSearchOrders = document.getElementById('admin-search-orders');
const refreshOrdersBtn = document.getElementById('refresh-orders-btn');

// Add Product Form
const newProductForm = document.getElementById('new-product-form');

// Edit Product Modal
const editProductModal = document.getElementById('edit-product-modal');
const closeEditModalBtn = document.getElementById('close-edit-modal-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const editProductForm = document.getElementById('edit-product-form');

// State
let productsList = [];
let ordersList = [];
let currentUser = null;

// Helpers
function formatNaira(n) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', maximumFractionDigits: 0
  }).format(n || 0);
}

// 1. Authentication Listener
onAuthStateChanged(auth, user => {
  if (user && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    currentUser = user;
    loginSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    userInfo.style.display = 'flex';
    userEmailDisplay.textContent = user.email;
    loadDashboardData();
  } else {
    currentUser = null;
    loginSection.style.display = 'block';
    dashboardSection.style.display = 'none';
    userInfo.style.display = 'none';
    if (user && user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      loginError.textContent = `Access denied. ${user.email} is not authorized for IMCSC Admin Portal.`;
      loginError.style.display = 'block';
      signOut(auth);
    }
  }
});

// Login Form Submit
adminLoginForm.addEventListener('submit', async e => {
  e.preventDefault();
  loginError.style.display = 'none';
  const email = adminEmailInput.value.trim();
  const password = adminPasswordInput.value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    loginError.textContent = err.message || 'Failed to sign in. Please check credentials.';
    loginError.style.display = 'block';
  }
});

// Password setup / reset link
sendResetBtn.addEventListener('click', async () => {
  const email = adminEmailInput.value.trim();
  if (!email) {
    alert('Please provide your admin email address.');
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    resetMsg.textContent = `Password setup/reset email sent to ${email}. Please check your inbox or spam folder.`;
    resetMsg.style.display = 'block';
  } catch (err) {
    resetMsg.textContent = `Error: ${err.message}`;
    resetMsg.style.display = 'block';
  }
});

// Logout
logoutBtn.addEventListener('click', () => {
  signOut(auth);
});

// 2. Tab Navigation
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    const target = document.getElementById(btn.dataset.tab);
    if (target) target.classList.add('active');
  });
});

// 3. Load Products & Orders
async function loadDashboardData() {
  await Promise.all([loadProducts(), loadOrders()]);
  updateStats();
}

async function loadProducts() {
  try {
    const snap = await getDocs(collection(db, 'products'));
    productsList = [];
    snap.forEach(d => {
      productsList.push({ id: d.id, ...d.data() });
    });

    if (productsList.length === 0) {
      initCatalogueBanner.style.display = 'flex';
    } else {
      initCatalogueBanner.style.display = 'none';
    }
  } catch (err) {
    console.error('Failed to load products from Firestore:', err);
    // If Firestore is still unpopulated, show import banner with local fallback
    if (productsList.length === 0) {
      productsList = [...initialProducts];
      initCatalogueBanner.style.display = 'flex';
    }
  }
  renderProductsTable();
}

async function loadOrders() {
  try {
    const snap = await getDocs(collection(db, 'orders'));
    ordersList = [];
    snap.forEach(d => {
      ordersList.push({ id: d.id, ...d.data() });
    });
  } catch (err) {
    console.error('Failed to load orders from Firestore:', err);
    ordersList = [];
  }
  renderOrdersTable();
}

function updateStats() {
  const total = productsList.length;
  const unpriced = productsList.filter(p => !p.price || p.price <= 0 || p.status === 'unpriced').length;
  const active = productsList.filter(p => p.price > 0 && p.status === 'active').length;

  statTotalProducts.textContent = total;
  statUnpricedProducts.textContent = unpriced;
  statActiveProducts.textContent = active;
  statTotalOrders.textContent = ordersList.length;
}

// 4. Render Products Table
function renderProductsTable() {
  const q = adminSearchProducts.value.toLowerCase().trim();
  const filter = adminFilterStatus.value;

  const filtered = productsList.filter(p => {
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    let matchesStatus = true;
    if (filter === 'unpriced') {
      matchesStatus = !p.price || p.price <= 0 || p.status === 'unpriced';
    } else if (filter === 'active') {
      matchesStatus = p.price > 0 && p.status === 'active' && p.stock > 0;
    } else if (filter === 'out-of-stock') {
      matchesStatus = p.stock <= 0;
    }
    return matchesSearch && matchesStatus;
  });

  adminProductsTableBody.innerHTML = filtered.map(p => {
    const isUnpriced = !p.price || p.price <= 0 || p.status === 'unpriced';
    const statusClass = isUnpriced ? 'unpriced' : (p.stock > 0 ? 'active' : 'pending');
    const statusText = isUnpriced ? 'Needs Price' : (p.stock > 0 ? 'Active' : 'Out of Stock');

    return `
      <tr>
        <td>
          <img src="${p.image || '/assets/products/product-01.jpg'}" alt="${p.name}" class="prod-table-thumb" />
        </td>
        <td><strong>${p.sku}</strong></td>
        <td>${p.name}</td>
        <td><span style="text-transform: capitalize;">${p.category || 'General'}</span></td>
        <td><strong>${isUnpriced ? '—' : formatNaira(p.price)}</strong></td>
        <td>${p.stock || 0}</td>
        <td><span class="badge-status ${statusClass}">${statusText}</span></td>
        <td>
          <button class="btn-action-edit" data-id="${p.id || p.sku}">Edit Price & Stock</button>
          <button class="btn-action-delete" data-id="${p.id || p.sku}">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

// 5. Render Orders Table
function renderOrdersTable() {
  const q = adminSearchOrders.value.toLowerCase().trim();
  const filtered = ordersList.filter(o => {
    return !q || 
      (o.orderId && o.orderId.toLowerCase().includes(q)) ||
      (o.customer?.name && o.customer.name.toLowerCase().includes(q)) ||
      (o.customer?.phone && o.customer.phone.includes(q));
  });

  adminOrdersTableBody.innerHTML = filtered.map(o => {
    const dateStr = o.createdAt?.seconds 
      ? new Date(o.createdAt.seconds * 1000).toLocaleDateString() 
      : new Date().toLocaleDateString();

    return `
      <tr>
        <td>${dateStr}</td>
        <td><strong>${o.orderId}</strong></td>
        <td>${o.customer?.name || 'Customer'}</td>
        <td><a href="tel:${o.customer?.phone}">${o.customer?.phone || '—'}</a></td>
        <td>${o.customer?.region || 'Ota'}</td>
        <td><strong>${formatNaira(o.total)}</strong></td>
        <td><span class="badge-status ${o.paymentStatus === 'paid' ? 'paid' : 'pending'}">${o.paymentStatus || 'Pending'}</span></td>
        <td>
          <select class="order-status-select" data-id="${o.id}">
            <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Processing" ${o.status === 'Processing' ? 'selected' : ''}>Processing</option>
            <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
            <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
            <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
        <td>
          <a href="https://wa.me/${(o.customer?.phone || '').replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(o.customer?.name || '')}%2C%20regarding%20your%20IMCSC%20Order%20${o.orderId}" target="_blank" class="btn-action-edit" style="text-decoration:none;">Chat WhatsApp</a>
        </td>
      </tr>
    `;
  }).join('');
}

// 6. Bulk Sync the 43 Initial Items to Firestore
importCatalogueBtn.addEventListener('click', async () => {
  if (!confirm('Sync 43 live products (with photos, prices, and stock) to your Firestore catalogue?')) return;
  importCatalogueBtn.disabled = true;
  importCatalogueBtn.textContent = 'Syncing products...';

  try {
    for (const item of initialProducts) {
      await setDoc(doc(db, 'products', item.sku), {
        sku: item.sku,
        name: item.name,
        description: item.description,
        price: item.price,
        stock: item.stock,
        category: item.category,
        image: item.image,
        status: item.status || 'active',
        featured: item.featured || false,
        updatedAt: new Date()
      });
    }
    alert('Successfully synced 43 products with prices into Firestore!');
    await loadProducts();
    updateStats();
  } catch (err) {
    alert('Sync error: ' + err.message);
  } finally {
    importCatalogueBtn.disabled = false;
    importCatalogueBtn.textContent = 'Sync 43 Live Products';
  }
});

// 7. Add New Product
newProductForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('new-prod-name').value.trim();
  const sku = document.getElementById('new-prod-sku').value.trim();
  const price = parseFloat(document.getElementById('new-prod-price').value);
  const stock = parseInt(document.getElementById('new-prod-stock').value, 10);
  const category = document.getElementById('new-prod-category').value;
  const desc = document.getElementById('new-prod-desc').value.trim();
  const featured = document.getElementById('new-prod-featured').checked;
  const fileInput = document.getElementById('new-prod-image-file');
  let imageUrl = document.getElementById('new-prod-image-url').value.trim() || '/assets/products/product-01.jpg';

  const saveBtn = document.getElementById('save-new-prod-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving Product...';

  try {
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      try {
        const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
        const uploadSnap = await uploadBytes(storageRef, file);
        imageUrl = await getDownloadURL(uploadSnap.ref);
      } catch (storageErr) {
        console.warn('Storage fallback to direct DataURL:', storageErr.message);
        imageUrl = await fileToDataUrl(file);
      }
    }

    await setDoc(doc(db, 'products', sku), {
      sku,
      name,
      price,
      stock,
      category,
      description: desc,
      featured,
      image: imageUrl,
      status: price > 0 ? 'active' : 'unpriced',
      updatedAt: new Date()
    });

    alert(`Product ${name} added successfully!`);
    newProductForm.reset();
    await loadProducts();
    updateStats();

    // Switch to products tab
    document.querySelector('.tab-btn[data-tab="products-tab"]').click();
  } catch (err) {
    alert('Error saving product: ' + err.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Product to Catalogue';
  }
});

// 8. Edit Product Modal Handlers
adminProductsTableBody.addEventListener('click', async e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;
  const product = productsList.find(p => (p.id === id || p.sku === id));
  if (!product) return;

  if (btn.classList.contains('btn-action-edit')) {
    document.getElementById('edit-prod-id').value = product.id || product.sku;
    document.getElementById('edit-prod-name').value = product.name;
    document.getElementById('edit-prod-sku').value = product.sku;
    document.getElementById('edit-prod-price').value = product.price || 0;
    document.getElementById('edit-prod-stock').value = product.stock || 0;
    document.getElementById('edit-prod-category').value = product.category || 'household';
    document.getElementById('edit-prod-status').value = product.status || (product.price > 0 ? 'active' : 'unpriced');
    document.getElementById('edit-prod-desc').value = product.description || '';
    
    // Set image preview
    const imgPreview = document.getElementById('edit-prod-img-preview');
    const imgUrlInput = document.getElementById('edit-prod-image-url');
    const currentImg = product.image || '/assets/products/IMG-01_Plastic_Lunch_Box_Selling_NGN-5864.jpg';
    if (imgPreview) imgPreview.src = currentImg;
    if (imgUrlInput) imgUrlInput.value = currentImg;
    document.getElementById('edit-prod-image-file').value = '';

    editProductModal.style.display = 'flex';
  } else if (btn.classList.contains('btn-action-delete')) {
    if (confirm(`Are you sure you want to delete ${product.name} (${product.sku})?`)) {
      try {
        await deleteDoc(doc(db, 'products', product.id || product.sku));
        await loadProducts();
        updateStats();
      } catch (err) {
        alert('Delete error: ' + err.message);
      }
    }
  }
});

// Helper to convert file to compressed Base64 data URL
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Live preview when file is selected in Edit modal
const editFileEl = document.getElementById('edit-prod-image-file');
if (editFileEl) {
  editFileEl.addEventListener('change', async e => {
    if (e.target.files.length > 0) {
      const dataUrl = await fileToDataUrl(e.target.files[0]);
      document.getElementById('edit-prod-img-preview').src = dataUrl;
    }
  });
}

closeEditModalBtn.addEventListener('click', () => { editProductModal.style.display = 'none'; });
cancelEditBtn.addEventListener('click', () => { editProductModal.style.display = 'none'; });

editProductForm.addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('edit-prod-id').value;
  const name = document.getElementById('edit-prod-name').value.trim();
  const sku = document.getElementById('edit-prod-sku').value.trim();
  const price = parseFloat(document.getElementById('edit-prod-price').value);
  const stock = parseInt(document.getElementById('edit-prod-stock').value, 10);
  const category = document.getElementById('edit-prod-category').value;
  const status = document.getElementById('edit-prod-status').value;
  const desc = document.getElementById('edit-prod-desc').value.trim();
  const fileInput = document.getElementById('edit-prod-image-file');
  let imageUrl = document.getElementById('edit-prod-image-url').value.trim();

  const submitBtn = editProductForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Updating Product...';

  try {
    // If a new image file was picked, try Firebase storage or fallback to Base64
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      try {
        const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
        const uploadSnap = await uploadBytes(storageRef, file);
        imageUrl = await getDownloadURL(uploadSnap.ref);
      } catch (storageErr) {
        console.warn('Storage fallback to direct DataURL:', storageErr.message);
        imageUrl = await fileToDataUrl(file);
      }
    }

    const updatePayload = {
      name,
      sku,
      price,
      stock,
      category,
      status,
      description: desc,
      updatedAt: new Date()
    };
    if (imageUrl) {
      updatePayload.image = imageUrl;
    }

    await updateDoc(doc(db, 'products', id), updatePayload);
    editProductModal.style.display = 'none';
    alert(`Product "${name}" updated successfully!`);
    await loadProducts();
    updateStats();
  } catch (err) {
    alert('Update error: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Changes';
  }
});

// Update order status dropdown
adminOrdersTableBody.addEventListener('change', async e => {
  if (e.target.classList.contains('order-status-select')) {
    const orderDocId = e.target.dataset.id;
    const newStatus = e.target.value;
    try {
      await updateDoc(doc(db, 'orders', orderDocId), { status: newStatus });
    } catch (err) {
      alert('Error updating order: ' + err.message);
    }
  }
});

// Search & Refresh handlers
adminSearchProducts.addEventListener('input', renderProductsTable);
adminFilterStatus.addEventListener('change', renderProductsTable);
refreshProductsBtn.addEventListener('click', loadProducts);

adminSearchOrders.addEventListener('input', renderOrdersTable);
refreshOrdersBtn.addEventListener('click', loadOrders);
