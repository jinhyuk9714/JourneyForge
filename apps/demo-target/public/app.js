const appRoot = document.getElementById('app');

const state = {
  auth: false,
  keyword: '',
  products: [],
  selectedProduct: null,
};

const routes = {
  login: /^\/login$/,
  products: /^\/products$/,
  productDetail: /^\/products\/(?<id>[^/]+)$/,
};

const render = () => {
  const path = window.location.pathname;

  if (routes.login.test(path)) {
    renderLogin();
    return;
  }

  if (routes.products.test(path)) {
    renderProducts();
    return;
  }

  if (routes.productDetail.test(path)) {
    renderProductDetail();
    return;
  }

  window.history.replaceState({}, '', '/login');
  renderLogin();
};

const renderLogin = () => {
  appRoot.innerHTML = `
    <div class="stack">
      <p class="muted">Sign in to browse products.</p>
      <label>
        <span>Email</span>
        <input aria-label="Email" name="email" type="email" autocomplete="username" />
      </label>
      <label>
        <span>Password</span>
        <input aria-label="Password" name="password" type="password" autocomplete="current-password" />
      </label>
      <button class="primary" type="button">로그인</button>
    </div>
  `;

  const loginButton = appRoot.querySelector('button');
  loginButton.addEventListener('click', async () => {
    const email = appRoot.querySelector('input[name="email"]').value;
    const password = appRoot.querySelector('input[name="password"]').value;

    await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    state.auth = true;
    window.history.pushState({}, '', '/products');
    renderProducts();
  });
};

const renderProducts = () => {
  const resultMarkup = state.products
    .map(
      (product) => `
        <article class="product-card">
          <div>
            <strong>${product.name}</strong>
            <div class="muted">${product.category}</div>
          </div>
          <a class="button-link primary" href="/products/${product.id}">${product.name}</a>
        </article>
      `,
    )
    .join('');

  appRoot.innerHTML = `
    <div class="stack">
      <div class="stack">
        <p class="muted">Search products after login.</p>
        <label>
          <span>검색</span>
          <input aria-label="검색" placeholder="검색어" name="keyword" type="text" value="${state.keyword}" />
        </label>
        <button class="primary" type="button">검색</button>
      </div>
      <p class="muted" data-testid="result-count">${state.products.length} results</p>
      <div class="results">${resultMarkup}</div>
    </div>
  `;

  appRoot.querySelector('button').addEventListener('click', async () => {
    state.keyword = appRoot.querySelector('input[name="keyword"]').value;
    const response = await fetch(`/api/products?keyword=${encodeURIComponent(state.keyword)}&page=0`);
    state.products = await response.json();
    renderProducts();
  });

  for (const link of appRoot.querySelectorAll('a[href^="/products/"]')) {
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      const href = link.getAttribute('href');
      const response = await fetch(`/api${href}`);
      state.selectedProduct = await response.json();
      window.history.pushState({}, '', href);
      renderProductDetail();
    });
  }
};

const renderProductDetail = () => {
  const product = state.selectedProduct;
  if (!product) {
    appRoot.innerHTML = '<p class="muted">No product selected.</p>';
    return;
  }

  appRoot.innerHTML = `
    <div class="stack">
      <p class="muted">Product detail</p>
      <h2>${product.name}</h2>
      <p>${product.description}</p>
      <a class="button-link primary" href="/products">목록으로</a>
    </div>
  `;

  appRoot.querySelector('a[href="/products"]').addEventListener('click', (event) => {
    event.preventDefault();
    window.history.pushState({}, '', '/products');
    renderProducts();
  });
};

window.addEventListener('popstate', async () => {
  const detailMatch = window.location.pathname.match(routes.productDetail);
  if (detailMatch?.groups?.id) {
    const response = await fetch(`/api/products/${detailMatch.groups.id}`);
    state.selectedProduct = await response.json();
  }
  render();
});

render();
