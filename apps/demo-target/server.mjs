import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, 'public');

const products = [
  {
    id: '42',
    name: 'MacBook Pro 14',
    category: 'Laptop',
    description: 'Portable workstation for the JourneyForge smoke path.',
    keywords: ['macbook', '맥북'],
  },
  {
    id: '7',
    name: 'Mechanical Keyboard',
    category: 'Accessory',
    description: 'A distractor item to verify search filtering.',
    keywords: ['keyboard', '키보드'],
  },
];

const posts = [
  {
    id: '99',
    title: 'JourneyForge roadmap',
    content: 'Initial roadmap for JourneyForge write flows.',
  },
];
let nextPostId = 101;

const sendJson = (response, status, payload) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
};

const sendFile = async (response, fileName, contentType) => {
  const content = await readFile(join(publicDir, fileName), 'utf8');
  response.writeHead(200, { 'Content-Type': contentType });
  response.end(content);
};

const readJsonBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const payload = Buffer.concat(chunks).toString('utf8');
  return payload ? JSON.parse(payload) : {};
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');

  if (request.method === 'POST' && url.pathname === '/api/auth/login') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/products') {
    const keyword = (url.searchParams.get('keyword') ?? '').toLowerCase();
    const filtered = products.filter((product) =>
      [product.name, ...(product.keywords ?? [])].some((value) => value.toLowerCase().includes(keyword)),
    );
    sendJson(response, 200, filtered);
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/products/')) {
    const productId = url.pathname.split('/').pop();
    const product = products.find((candidate) => candidate.id === productId);
    if (!product) {
      sendJson(response, 404, { message: 'Not found' });
      return;
    }
    sendJson(response, 200, product);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/posts') {
    const body = await readJsonBody(request);
    const created = {
      id: String(nextPostId),
      title: body.title ?? '',
      content: body.content ?? '',
    };
    nextPostId += 1;
    posts.push(created);
    sendJson(response, 201, created);
    return;
  }

  if (request.method === 'PATCH' && url.pathname.startsWith('/api/posts/')) {
    const postId = url.pathname.split('/').pop();
    const body = await readJsonBody(request);
    const post = posts.find((candidate) => candidate.id === postId);
    if (!post) {
      sendJson(response, 404, { message: 'Not found' });
      return;
    }
    post.title = body.title ?? '';
    post.content = body.content ?? '';
    sendJson(response, 200, post);
    return;
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/posts/')) {
    const postId = url.pathname.split('/').pop();
    const post = posts.find((candidate) => candidate.id === postId);
    if (!post) {
      sendJson(response, 404, { message: 'Not found' });
      return;
    }
    sendJson(response, 200, post);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/app.js') {
    await sendFile(response, 'app.js', 'application/javascript; charset=utf-8');
    return;
  }

  if (request.method === 'GET') {
    await sendFile(response, 'index.html', 'text/html; charset=utf-8');
    return;
  }

  response.writeHead(404);
  response.end();
});

server.listen(4173, '127.0.0.1', () => {
  console.log('JourneyForge demo target running at http://127.0.0.1:4173/login');
});
