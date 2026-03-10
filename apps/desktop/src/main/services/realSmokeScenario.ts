type ScenarioLocator = {
  click(): Promise<void>;
  fill(value: string): Promise<void>;
};

export type RealSmokePage = {
  waitForURL(url: string): Promise<void>;
  getByLabel(label: string): ScenarioLocator;
  getByPlaceholder(placeholder: string): ScenarioLocator;
  getByRole(role: 'button' | 'link', options: { name: string }): ScenarioLocator;
};

export type RealDesktopSmokeScenario = 'login-search-detail' | 'create-post';

type RunRealSmokeScenarioInput = {
  page: RealSmokePage;
  baseUrl: string;
  scenario: RealDesktopSmokeScenario;
};

const completeLogin = async (page: RealSmokePage, baseUrl: string) => {
  const { origin } = new URL(baseUrl);

  await page.waitForURL(baseUrl);
  await page.getByLabel('Email').fill('qa@example.com');
  await page.getByLabel('Password').fill('super-secret');
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL(`${origin}/products`);

  return {
    origin,
  };
};

const runLoginSearchDetail = async (page: RealSmokePage, baseUrl: string) => {
  const { origin } = await completeLogin(page, baseUrl);

  await page.getByPlaceholder('검색어').fill('맥북');
  await page.getByRole('button', { name: '검색' }).click();
  await page.getByRole('link', { name: 'MacBook Pro 14' }).click();
  await page.waitForURL(`${origin}/products/42`);
};

const runCreatePost = async (page: RealSmokePage, baseUrl: string) => {
  const { origin } = await completeLogin(page, baseUrl);

  await page.getByRole('link', { name: '게시글 작성' }).click();
  await page.waitForURL(`${origin}/posts/new`);
  await page.getByLabel('Title').fill('Launch checklist');
  await page.getByLabel('Content').fill('Write flow support is ready for review.');
  await page.getByRole('button', { name: '등록' }).click();
  await page.waitForURL(`${origin}/posts/101`);
};

export const runRealSmokeScenario = async ({ page, baseUrl, scenario }: RunRealSmokeScenarioInput) => {
  if (scenario === 'create-post') {
    await runCreatePost(page, baseUrl);
    return;
  }

  await runLoginSearchDetail(page, baseUrl);
};
