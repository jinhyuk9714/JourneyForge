const appRoot = document.getElementById('app');

const state = {
  auth: false,
  keyword: '',
  products: [],
  posts: [
    {
      id: '99',
      title: 'JourneyForge roadmap',
      content: 'Initial roadmap for JourneyForge write flows.',
    },
  ],
  selectedProduct: null,
  selectedPost: null,
};

const routes = {
  login: /^\/login$/,
  products: /^\/products$/,
  productDetail: /^\/products\/(?<id>[^/]+)$/,
  postNew: /^\/posts\/new$/,
  postDetail: /^\/posts\/(?<id>[^/]+)$/,
  postEdit: /^\/posts\/(?<id>[^/]+)\/edit$/,
};

const syncPost = (post) => {
  const existingIndex = state.posts.findIndex((candidate) => candidate.id === post.id);
  if (existingIndex >= 0) {
    state.posts.splice(existingIndex, 1, post);
    return;
  }
  state.posts.push(post);
};

const loadPost = async (postId) => {
  const response = await fetch(`/api/posts/${postId}`);
  const post = await response.json();
  state.selectedPost = post;
  syncPost(post);
  return post;
};

const render = async () => {
  const path = window.location.pathname;

  if (routes.login.test(path)) {
    renderLogin();
    return;
  }

  if (routes.products.test(path)) {
    renderProducts();
    return;
  }

  const postEditMatch = path.match(routes.postEdit);
  if (postEditMatch?.groups?.id) {
    if (state.selectedPost?.id !== postEditMatch.groups.id) {
      await loadPost(postEditMatch.groups.id);
    }
    renderPostForm('update');
    return;
  }

  if (routes.postNew.test(path)) {
    renderPostForm('create');
    return;
  }

  const postDetailMatch = path.match(routes.postDetail);
  if (postDetailMatch?.groups?.id) {
    if (state.selectedPost?.id !== postDetailMatch.groups.id) {
      await loadPost(postDetailMatch.groups.id);
    }
    renderPostDetail();
    return;
  }

  const productDetailMatch = path.match(routes.productDetail);
  if (productDetailMatch?.groups?.id) {
    if (state.selectedProduct?.id !== productDetailMatch.groups.id) {
      const response = await fetch(`/api/products/${productDetailMatch.groups.id}`);
      state.selectedProduct = await response.json();
    }
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
  const postMarkup = state.posts
    .map(
      (post) => `
        <article class="product-card">
          <div>
            <strong>${post.title}</strong>
            <div class="muted">Post</div>
          </div>
          <a class="button-link primary" href="/posts/${post.id}">${post.title}</a>
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
      <div class="stack">
        <div class="stack">
          <p class="muted">Post flows for write-path validation.</p>
          <a class="button-link primary" href="/posts/new">게시글 작성</a>
        </div>
        <div class="results">${postMarkup}</div>
      </div>
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

  appRoot.querySelector('a[href="/posts/new"]').addEventListener('click', (event) => {
    event.preventDefault();
    state.selectedPost = null;
    window.history.pushState({}, '', '/posts/new');
    renderPostForm('create');
  });

  for (const link of appRoot.querySelectorAll('a[href^="/posts/"]:not([href="/posts/new"])')) {
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      const href = link.getAttribute('href');
      const response = await fetch(`/api${href}`);
      state.selectedPost = await response.json();
      syncPost(state.selectedPost);
      window.history.pushState({}, '', href);
      renderPostDetail();
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

const renderPostForm = (mode) => {
  const current = state.selectedPost ?? { title: '', content: '' };
  appRoot.innerHTML = `
    <div class="stack">
      <p class="muted">${mode === 'create' ? 'Create a new post.' : 'Edit the current post.'}</p>
      <label>
        <span>Title</span>
        <input aria-label="Title" name="title" type="text" value="${current.title ?? ''}" />
      </label>
      <label>
        <span>Content</span>
        <textarea aria-label="Content" name="content">${current.content ?? ''}</textarea>
      </label>
      <button class="primary" type="button">${mode === 'create' ? '등록' : '저장'}</button>
      <a class="button-link" href="/products">목록으로</a>
    </div>
  `;

  appRoot.querySelector('button').addEventListener('click', async () => {
    const title = appRoot.querySelector('[name="title"]').value;
    const content = appRoot.querySelector('[name="content"]').value;
    const targetPath = mode === 'create' ? '/api/posts' : `/api/posts/${state.selectedPost.id}`;
    const response = await fetch(targetPath, {
      method: mode === 'create' ? 'POST' : 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, content }),
    });
    const mutated = await response.json();
    syncPost(mutated);
    state.selectedPost = await loadPost(mutated.id);
    window.history.pushState({}, '', `/posts/${mutated.id}`);
    renderPostDetail();
  });

  appRoot.querySelector('a[href="/products"]').addEventListener('click', (event) => {
    event.preventDefault();
    window.history.pushState({}, '', '/products');
    renderProducts();
  });
};

const renderPostDetail = () => {
  const post = state.selectedPost;
  if (!post) {
    appRoot.innerHTML = '<p class="muted">No post selected.</p>';
    return;
  }

  appRoot.innerHTML = `
    <div class="stack">
      <p class="muted">Post detail</p>
      <h2>${post.title}</h2>
      <p>${post.content}</p>
      <a class="button-link primary" href="/posts/${post.id}/edit">수정하기</a>
      <a class="button-link" href="/products">목록으로</a>
    </div>
  `;

  appRoot.querySelector(`a[href="/posts/${post.id}/edit"]`).addEventListener('click', (event) => {
    event.preventDefault();
    window.history.pushState({}, '', `/posts/${post.id}/edit`);
    renderPostForm('update');
  });

  appRoot.querySelector('a[href="/products"]').addEventListener('click', (event) => {
    event.preventDefault();
    window.history.pushState({}, '', '/products');
    renderProducts();
  });
};

window.addEventListener('popstate', () => {
  void render();
});

void render();
