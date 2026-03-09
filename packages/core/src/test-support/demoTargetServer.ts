import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type DemoTargetServer = {
  baseUrl: string;
  close(): Promise<void>;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../../../../apps/demo-target/public');

const demoProducts = [
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

const sendJson = (response: import('node:http').ServerResponse, status: number, payload: unknown) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
};

const sendFile = async (
  response: import('node:http').ServerResponse,
  fileName: string,
  contentType: string,
) => {
  const content = await readFile(join(publicDir, fileName), 'utf8');
  response.writeHead(200, { 'Content-Type': contentType });
  response.end(content);
};

export const startDemoTargetServer = async (): Promise<DemoTargetServer> => {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');

    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/products') {
      const keyword = (url.searchParams.get('keyword') ?? '').toLowerCase();
      const filtered = demoProducts.filter((product) =>
        [product.name, ...(product.keywords ?? [])].some((value) => value.toLowerCase().includes(keyword)),
      );
      sendJson(response, 200, filtered);
      return;
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/products/')) {
      const productId = url.pathname.split('/').pop();
      const product = demoProducts.find((candidate) => candidate.id === productId);
      if (!product) {
        sendJson(response, 404, { message: 'Not found' });
        return;
      }
      sendJson(response, 200, product);
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

  await new Promise<void>((resolveServer) => {
    server.listen(0, '127.0.0.1', () => resolveServer());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to resolve demo target server address.');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => {
          if (error) {
            rejectClose(error);
            return;
          }
          resolveClose();
        });
      });
    },
  };
};
