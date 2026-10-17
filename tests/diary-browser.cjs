// 使用本地 Vite 服务；远程请求全部拦截，不读取或修改真实账号和数据。
// node tests/diary-browser.cjs <Playwright 模块目录>，TEST_URL 默认 http://127.0.0.1:8082
const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = process.env.TEST_URL || 'http://127.0.0.1:8082';
const screenshots = process.env.DIARY_SCREENSHOTS || 'dist';
const A = '22222222-2222-4222-8222-222222222222';
const B = '33333333-3333-4333-8333-333333333333';
const C = '44444444-4444-4444-8444-444444444444';
const now = new Date();
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const previousMonth = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
const user = id => ({ id, email: id === A ? 'a@example.com' : id === B ? 'b@example.com' : 'c@example.com', name: id === A ? '甲' : id === B ? '乙' : '丙', username: id === A ? 'bingx' : id === B ? 'nian' : 'ordinary', level: 3, avatar: '👤', role: 'authenticated', aud: 'authenticated', user_metadata: {} });
const make = (n, date, extra = {}) => ({ id: `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`, type: 'diary', title: `旧日记 ${n}`, body: `正文 ${n}`, description: '', author_id: A, visibility: 'public', start_date: null, end_date: null, created_at: `${date}T04:00:${String(n % 60).padStart(2, '0')}.000Z`, ...extra });
let records = [
    ...Array.from({ length: 12 }, (_, i) => make(i + 1, `${month}-10`)),
    make(20, `${month}-16`, { title: '自己的散步', visibility: 'partner' }),
    make(21, `${month}-17`, { title: '自己的私密记录', visibility: 'private' }),
    make(22, `${month}-16`, { title: '对方的散步 ,()%', author_id: B, visibility: 'partner' }),
    make(23, `${month}-18`, { title: '对方的公开记录', author_id: B }),
    make(24, `${month}-19`, { title: '对方的秘密', author_id: B, visibility: 'private' }),
    make(25, `${previousMonth}-20`, { title: '上个月的记录', author_id: B, visibility: 'partner' }),
    make(26, `${month}-18`, { title: '普通文章', type: 'article' })
];
function split(text) {
    const parts = []; let depth = 0, quoted = false, escaped = false, start = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (escaped) { escaped = false; continue; }
        if (quoted && c === '\\') { escaped = true; continue; }
        if (c === '"') quoted = !quoted;
        if (quoted) continue;
        if (c === '(') depth++;
        if (c === ')') depth--;
        if (c === ',' && !depth) { parts.push(text.slice(start, i)); start = i + 1; }
    }
    parts.push(text.slice(start)); return parts;
}
function matches(row, condition) {
    if (condition.startsWith('and(')) return split(condition.slice(4, -1)).every(value => matches(row, value));
    if (condition.startsWith('or(')) return split(condition.slice(3, -1)).some(value => matches(row, value));
    const [, field, operator, raw] = condition.match(/^([\w_]+)\.(eq|neq|in|imatch|gte|lt|is)\.(.*)$/s) || [];
    if (!field) throw new Error('Unsupported test predicate: ' + condition);
    if (operator === 'is') return row[field] == null;
    if (operator === 'imatch') return new RegExp(JSON.parse(raw), 'i').test(row[field] || '');
    if (operator === 'in') return split(raw.slice(1, -1)).map(value => value.startsWith('"') ? JSON.parse(value) : value).includes(row[field]);
    const value = raw.startsWith('"') ? JSON.parse(raw) : raw;
    if (operator === 'gte') return row[field] != null && Date.parse(row[field]) >= Date.parse(value);
    if (operator === 'lt') return row[field] != null && Date.parse(row[field]) < Date.parse(value);
    return operator === 'neq' ? row[field] !== value : row[field] === value;
}
function visible(row, viewer) {
    return row.visibility === 'public' || row.author_id === viewer?.id
        || (row.visibility === 'partner' && viewer?.level >= 3)
        || (row.visibility === 'internal' && viewer?.level >= 2);
}
async function settle(page) {
    await page.waitForFunction(() => !document.querySelector('[aria-label="正在加载内容"]'));
    await page.waitForTimeout(50);
}
async function countRows(page, count) {
    await page.waitForFunction(expected => document.querySelectorAll('.record-row').length === expected, count);
    await settle(page);
}
async function search(page, value) {
    await page.getByRole('searchbox').fill(value);
    await page.waitForTimeout(300);
    await settle(page);
}
async function run() {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const errors = [], forbidden = [];
    const state = { viewer: null, requests: [], saves: [], failIndex: false };
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Shanghai' });
        context.setDefaultTimeout(10000);
        await context.route('**/*', async route => {
            const request = route.request(), url = new URL(request.url());
            if (url.origin === base) return route.continue();
            // 阻止本机杀毒软件注入的脚本联网，它不属于网站的请求。
            if (url.hostname === 'me.kis.v2.scr.kaspersky-labs.com') return route.abort();
            const json = (data, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-expose-headers': 'content-range', ...headers }, body: JSON.stringify(data) });
            state.requests.push({ method: request.method(), path: url.pathname, params: Object.fromEntries(url.searchParams) });
            if (url.pathname === '/auth/v1/token') { const email = request.postDataJSON().email; state.viewer = user(email === 'a@example.com' ? A : email === 'b@example.com' ? B : C); return json({ access_token: 'test-token', refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user: state.viewer }); }
            if (url.pathname === '/auth/v1/user') return json(state.viewer);
            if (url.pathname === '/auth/v1/logout') { state.viewer = null; return json({}); }
            if (url.pathname.endsWith('/rpc/save_content_bundle')) {
                const data = request.postDataJSON(); state.saves.push(data);
                const existing = records.find(row => row.id === data.p_id);
                const { id: ignoredId, authorId: ignoredAuthor, ...content } = data.p_content;
                const fields = { ...content, author_id: state.viewer.id, start_date: data.p_content.startDate, end_date: data.p_content.endDate };
                if (existing) Object.assign(existing, fields);
                else records.push(make(100, `${month}-17`, { ...fields, id: data.p_id, created_at: new Date().toISOString() }));
                return json({ id: data.p_id });
            }
            if (request.method() !== 'GET' && request.method() !== 'HEAD') { forbidden.push(request.method() + ' ' + url.pathname); return route.abort(); }
            if (url.pathname.endsWith('/system_settings')) return json({ id: 1, registration_open: false, daily_post_limit: 10, max_image_size: 10 });
            if (url.pathname.endsWith('/profiles')) {
                const profiles = [user(A), user(B), user(C)];
                if (url.searchParams.has('username')) return json(profiles.find(profile => profile.username === url.searchParams.get('username').slice(3)) || null);
                return json(url.searchParams.has('id') ? state.viewer : profiles);
            }
            if (url.pathname.endsWith('/content_images')) return json([]);
            if (url.pathname.endsWith('/contents')) {
                const isIndex = url.searchParams.get('select') !== '*';
                if (isIndex && state.failIndex) { state.failIndex = false; return json({ message: 'test network error' }, 400); }
                let rows = records.filter(row => visible(row, state.viewer));
                const or = url.searchParams.get('or');
                if (or) rows = rows.filter(row => split(or.slice(1, -1)).some(value => matches(row, value)));
                for (const field of ['id', 'author_id', 'type']) {
                    if (url.searchParams.has(field)) rows = rows.filter(row => matches(row, `${field}.${url.searchParams.get(field)}`));
                }
                rows.sort((a, b) => isIndex ? a.id.localeCompare(b.id) : b.created_at.localeCompare(a.created_at));
                const total = rows.length, offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || Math.max(total, 1));
                rows = rows.slice(offset, offset + limit);
                if (isIndex) rows = rows.map(row => Object.fromEntries(url.searchParams.get('select').split(',').map(key => [key, row[key]])));
                return json(rows, 200, { 'content-range': `${rows.length ? offset + '-' + (offset + rows.length - 1) : '*'}/${total}` });
            }
            forbidden.push(request.method() + ' ' + url.hostname + url.pathname); return route.abort();
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        page.on('dialog', dialog => dialog.accept());
        await page.goto(base);
        await page.locator('#login-account').fill('a@example.com');
        await page.locator('#login-password').fill('test-password');
        await page.getByRole('button', { name: '登录', exact: true }).click();
        await countRows(page, 8);
        assert.equal(await page.getByRole('button', { name: '全部可见', exact: true }).getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('.content-count').innerText(), '16 条');
        assert.equal(await page.locator(`[data-date="${month}-19"]`).getAttribute('aria-label'), `${month}-19，0 篇可见日记`);
        assert.equal(await page.locator(`[data-date="${month}-10"]`).getAttribute('aria-label'), `${month}-10，12 篇可见日记`);
        assert.equal(state.requests.filter(r => r.path.endsWith('/content_images')).length, 1);
        await page.locator(`[data-date="${month}-16"]`).click(); await countRows(page, 2);
        await page.getByRole('button', { name: '我写的', exact: true }).click(); await countRows(page, 1);
        assert.equal(await page.locator('.record-title').innerText(), '自己的散步');
        records.push(make(27, `${month}-16`, { title: '第三人的公开日记', author_id: C }));
        await page.getByRole('button', { name: '对方写的', exact: true }).click(); await countRows(page, 1);
        assert.equal(await page.locator('.record-title').innerText(), '对方的散步 ,()%');
        assert.equal(state.requests.findLast(request => request.path.endsWith('/contents') && request.params.select !== '*').params.author_id, `eq.${B}`);
        records = records.filter(record => record.author_id !== C);
        await page.locator('.record-row').click(); await page.locator('.detail-title').waitFor();
        assert.equal(await page.getByRole('button', { name: '编辑内容', exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: '删除', exact: true }).count(), 0);
        await page.getByRole('button', { name: '← 返回列表', exact: true }).click();
        assert.equal(await page.getByRole('button', { name: '对方写的', exact: true }).getAttribute('aria-pressed'), 'true');
        await search(page, '散步 ,()%'); await countRows(page, 1);
        await search(page, 'x),visibility.eq.private'); await countRows(page, 0);
        assert.equal(await page.locator('.calendar-day.has-diary').count(), 0);
        await search(page, ''); await countRows(page, 1);
        await page.getByRole('button', { name: '查看整月日记', exact: true }).click(); await countRows(page, 2);
        await page.getByRole('button', { name: '上个月', exact: true }).click(); await countRows(page, 1);
        assert.equal(await page.locator('.record-title').innerText(), '上个月的记录');
        await page.getByRole('button', { name: '下个月', exact: true }).click(); await countRows(page, 2);
        await page.getByRole('button', { name: '全部可见', exact: true }).click(); await countRows(page, 8);
        await page.getByRole('button', { name: '下一页', exact: true }).click(); await countRows(page, 8);
        assert.equal(await page.locator('.page-num[aria-current="page"]').innerText(), '2');
        await page.locator(`[data-date="${month}-16"]`).click(); await countRows(page, 2);
        await page.getByRole('button', { name: '我写的', exact: true }).click(); await countRows(page, 1);
        await page.locator('.record-row').click(); await page.getByRole('button', { name: '编辑内容', exact: true }).click();
        const dialog = page.getByRole('dialog'); await dialog.waitFor();
        assert.equal(await dialog.locator('#diary-entry-date').inputValue(), `${month}-16`);
        await dialog.locator('#diary-entry-date').fill(''); await dialog.getByRole('button', { name: '保存', exact: true }).click();
        assert.equal(state.saves.length, 0);
        await dialog.locator('#diary-entry-date').fill(`${previousMonth}-22`);
        await dialog.locator('input[type="text"]').fill('补写后的日记');
        await dialog.getByRole('button', { name: '保存', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' }); await countRows(page, 1);
        assert.equal(await page.locator('.record-title').innerText(), '补写后的日记');
        const edited = records.find(row => row.title === '补写后的日记');
        assert.equal(edited.start_date, `${previousMonth}-22T00:00:00.000Z`);
        assert.equal(edited.created_at.startsWith(month), true, '补写不改变发布时间');
        await page.getByRole('button', { name: '回到今天', exact: true }).click(); await settle(page);
        await page.getByRole('button', { name: '对方写的', exact: true }).click(); await settle(page);
        await page.locator(`[data-date="${month}-16"]`).click(); await countRows(page, 1);
        await page.locator('.publish-btn').click(); await dialog.waitFor();
        assert.equal(await dialog.locator('#diary-entry-date').inputValue(), `${month}-16`);
        await dialog.locator('input[type="text"]').fill('新写的一篇');
        await dialog.locator('textarea').fill('补写与回看联动');
        await dialog.getByRole('button', { name: '发布', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' }); await countRows(page, 1);
        assert.equal(await page.getByRole('button', { name: '我写的', exact: true }).getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('.record-title').innerText(), '新写的一篇');
        await page.getByRole('button', { name: '查看整月日记', exact: true }).click(); await countRows(page, 8);
        await page.locator('.publish-btn').click(); await dialog.waitFor();
        let confirms = 0;
        page.on('dialog', () => confirms++);
        await dialog.getByRole('button', { name: '取消', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
        assert.equal(confirms, 0, '默认日期不应把空白表单误判为已修改');
        await page.getByRole('button', { name: '全部可见', exact: true }).click(); await countRows(page, 8);
        await page.screenshot({ path: path.join(screenshots, 'diary-desktop.png'), fullPage: true });
        for (const width of [1024, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 900 });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `布局不应在 ${width}px 溢出`);
        }
        await page.screenshot({ path: path.join(screenshots, 'diary-mobile.png'), fullPage: true });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.locator('.account-trigger').click(); await page.getByRole('button', { name: '外观设置', exact: true }).click();
        await page.getByRole('button', { name: '暗色', exact: true }).click();
        const close = page.getByRole('button', { name: '关闭外观设置', exact: true });
        if (await close.count()) await close.click();
        await page.screenshot({ path: path.join(screenshots, 'diary-dark.png'), fullPage: true });
        await page.locator('.account-trigger').click(); await page.getByRole('button', { name: '退出登录', exact: true }).click();
        await page.locator('#login-account').waitFor();
        await page.locator('#login-account').fill('b@example.com');
        await page.locator('#login-password').fill('test-password');
        await page.getByRole('button', { name: '登录', exact: true }).click(); await countRows(page, 8);
        assert.equal(await page.getByRole('button', { name: '全部可见', exact: true }).getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator(`[data-date="${month}-17"]`).getAttribute('aria-label'), `${month}-17，0 篇可见日记`);
        assert.equal(await page.locator(`[data-date="${month}-19"]`).getAttribute('aria-label'), `${month}-19，1 篇可见日记`);
        await page.getByRole('button', { name: '对方写的', exact: true }).click(); await countRows(page, 8);
        assert.equal(state.requests.findLast(request => request.path.endsWith('/contents') && request.params.select !== '*').params.author_id, `eq.${A}`);
        await page.getByRole('button', { name: '我写的', exact: true }).click(); await countRows(page, 3);
        await page.locator('.account-trigger').click(); await page.getByRole('button', { name: '退出登录', exact: true }).click();
        await page.locator('#login-account').waitFor();
        await page.locator('#login-account').fill('c@example.com');
        await page.locator('#login-password').fill('test-password');
        await page.getByRole('button', { name: '登录', exact: true }).click(); await countRows(page, 8);
        assert.equal(await page.getByRole('button', { name: '对方写的', exact: true }).count(), 0, '其他账号即使是管理员也没有该栏目');
        assert.equal(await page.getByRole('button', { name: '我写的', exact: true }).count(), 1);
        const beforeDenied = state.requests.length;
        const denied = await page.evaluate(async ({ month, id }) => {
            const { getDiaryIndex } = await import('/src/data.js');
            return getDiaryIndex({ month, authorScope: 'other', user: { id, username: 'ordinary', level: 3 } });
        }, { month, id: C });
        assert.deepEqual(denied, []);
        assert.equal(state.requests.length, beforeDenied, '非法对方筛选不查询他人索引');
        // 访客没有作者筛选，也看不到他人的私密日期标记。
        await context.clearCookies();
        await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
        state.viewer = null;
        await page.reload(); await page.getByRole('button', { name: '以访客身份浏览', exact: true }).click(); await countRows(page, 8);
        assert.equal(await page.getByRole('group', { name: '按日记作者筛选' }).count(), 0);
        assert.equal(await page.locator(`[data-date="${month}-19"]`).getAttribute('aria-label'), `${month}-19，0 篇可见日记`);
        assert.equal(await page.locator(`[data-date="${month}-17"]`).getAttribute('aria-label'), `${month}-17，0 篇可见日记`);
        await page.getByRole('button', { name: '文章', exact: true }).click(); await countRows(page, 1);
        assert.equal(await page.locator('.diary-calendar').count(), 0);
        assert.equal(await page.locator('.record-title').innerText(), '普通文章');
        await page.getByRole('button', { name: '日记', exact: true }).click(); await countRows(page, 8);
        // 另一端删除记录后，旧月历索引不能把最后一页卡成空页。
        const beforeDeletion = records;
        records = records.filter(row => row.type !== 'diary' || (row.author_id === A && Number(row.id.slice(-12)) <= 4));
        await page.getByRole('button', { name: '下一页', exact: true }).click(); await countRows(page, 4);
        assert.equal(await page.locator('.pagination').count(), 0);
        assert.equal(await page.locator('.content-count').innerText(), '4 条');
        records = beforeDeletion;
        state.failIndex = true;
        await page.getByRole('button', { name: '上个月', exact: true }).click();
        await page.getByRole('button', { name: '重新加载', exact: true }).waitFor();
        assert.equal(await page.locator('.calendar-day.has-diary').count(), 0);
        await page.getByRole('button', { name: '重新加载', exact: true }).click(); await settle(page);
        assert.equal(await page.locator('.record-row').count(), 0, '访客看不到上月的伴侣可见记录');
        assert.deepEqual(forbidden, []); assert.deepEqual(errors, []);
        console.log('PASS: author/date/search filters, full-month calendar counts, same-day records, pagination, permissions, backdating, create/edit, account isolation, guest scope, network retry, mobile and dark mode. All remote requests mocked.');
        await context.close();
    } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exit(1); });
