// 先运行构建预览（默认 8081）。所有远程请求均由本地模拟响应处理，不修改真实数据。
// node tests/performance-browser.cjs [Playwright 模块路径]
const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.TEST_URL || 'http://127.0.0.1:8081';
const A = '22222222-2222-4222-8222-222222222222', B = '33333333-3333-4333-8333-333333333333';
const user = id => ({ id, name: id === A ? '甲' : '乙', username: id === A ? 'demo' : 'other', email: id === A ? 'demo@example.com' : 'other@example.com', avatar: '👤', level: 1, aud: 'authenticated', role: 'authenticated', user_metadata: {} });
const fixtureToday = new Date();
const make = (n, extra = {}) => ({ id: `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`, type: 'diary', title: `记录 ${n}`, body: `正文 ${n}`, description: '', author_id: A, visibility: 'public', start_date: null, created_at: new Date(fixtureToday.getFullYear(), fixtureToday.getMonth(), 15, 12, 0, -n).toISOString(), ...extra });
const specials = '符号 ,()"\\%_*.[试]';
let records = [...Array.from({ length: 100 }, (_, i) => make(i + 1)), make(101, { title: '甲的私密', visibility: 'private' }), make(102, { title: '乙的私密', visibility: 'private', author_id: B }), make(103, { type: 'article', title: '文章一' }), make(104, { type: 'album', title: '相册一' }), make(105, { type: 'album', title: '空相册' })];
records[90].body = '深处的搜索词 ' + specials;
const pictures = records.filter(r => r.id !== make(105).id).flatMap(row => Array.from({ length: row.type === 'album' ? 3 : 1 }, (_, i) => ({ id: row.id + '-' + i, content_id: row.id, url: A + '/' + row.id + '-' + i + '.webp', thumbnail_url: A + '/' + row.id + '-' + i + '_thumb.webp', caption: `照片 ${i + 1}`, is_cover: row.type === 'album' && i === 1, sort_order: i })));
function split(value) {
    let depth = 0, quoted = false, escaped = false, start = 0;
    const result = [];
    for (let i = 0; i < value.length; i++) {
        const c = value[i];
        if (escaped) { escaped = false; continue; }
        if (quoted && c === '\\') { escaped = true; continue; }
        if (c === '"') quoted = !quoted;
        if (quoted) continue;
        if (c === '(') depth++;
        if (c === ')') depth--;
        if (c === ',' && depth === 0) { result.push(value.slice(start, i)); start = i + 1; }
    }
    result.push(value.slice(start));
    return result;
}
function matches(row, condition) {
    if (condition.startsWith('and(')) return split(condition.slice(4, -1)).every(c => matches(row, c));
    if (condition.startsWith('or(')) return split(condition.slice(3, -1)).some(c => matches(row, c));
    const [, field, op, value] = condition.match(/^([\w_]+)\.(eq|neq|in|imatch|gte|lt|is)\.(.*)$/s) || [];
    if (!field) throw new Error('Unexpected query: ' + condition);
    if (op === 'imatch') return new RegExp(JSON.parse(value), 'i').test(row[field] || '');
    if (op === 'in') return split(value.slice(1, -1)).includes(row[field]);
    if (op === 'is') return row[field] == null;
    if (op === 'gte') return row[field] != null && Date.parse(row[field]) >= Date.parse(value);
    if (op === 'lt') return row[field] != null && Date.parse(row[field]) < Date.parse(value);
    if (op === 'neq') return row[field] !== (value.startsWith('"') ? JSON.parse(value) : value);
    return row[field] === (value.startsWith('"') ? JSON.parse(value) : value);
}
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
const errors = [], forbidden = [];
async function create(browser, options = {}) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
    const state = { user: null, requests: [], chunks: [], imagesGate: options.imagesGate, settingsGate: options.settingsGate, listGate: null, failImages: false, failList: false, saves: 0 };
    await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.hostname === 'me.kis.v2.scr.kaspersky-labs.com') return route.abort();
        const json = (data, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-expose-headers': 'content-range', ...headers }, body: JSON.stringify(data) });
        if (url.hostname === '127.0.0.1') {
            if (url.pathname.startsWith('/qa-photo')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#dce1da"/></svg>' });
            if (/\/assets\/.*\.js$/.test(url.pathname)) state.chunks.push(url.pathname);
            return route.continue();
        }
        state.requests.push({ pathname: url.pathname, params: Object.fromEntries(url.searchParams), method: request.method() });
        if (url.pathname === '/auth/v1/token') { state.user = user(request.postDataJSON().email === 'demo@example.com' ? A : B); return json({ access_token: 'qa-' + state.user.id, refresh_token: 'qa-refresh', expires_in: 3600, token_type: 'bearer', user: state.user }); }
        if (url.pathname === '/auth/v1/user') return json(state.user);
        if (url.pathname === '/auth/v1/logout') { state.user = null; return json({}); }
        if (url.pathname === '/storage/v1/object/sign/images') {
            return json(request.postDataJSON().paths.map(path => ({ path, signedURL: `/object/sign/images/${path}?token=qa` })));
        }
        if (url.pathname.startsWith('/storage/v1/object/sign/images/')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#dce1da"/></svg>' });
        if (url.pathname === '/rest/v1/rpc/save_content_bundle') {
            const payload = request.postDataJSON(); state.saves++;
            const existing = records.find(r => r.id === payload.p_id);
            const { id: ignoredId, ...fields } = payload.p_content;
            fields.start_date = fields.startDate || null;
            if (existing) Object.assign(existing, fields);
            else records.unshift(make(200 + state.saves, { id: payload.p_id, ...fields, author_id: state.user.id, created_at: new Date().toISOString() }));
            return json({ id: payload.p_id });
        }
        if (request.method() !== 'GET' && request.method() !== 'HEAD') { forbidden.push(request.method() + ' ' + url.pathname); return json({}, 403); }
        if (url.pathname.endsWith('/system_settings')) { if (state.settingsGate) await state.settingsGate.promise; return json({ id: 1, registration_open: true, daily_post_limit: 10, max_image_size: 10 }); }
        if (url.pathname.endsWith('/profiles')) return json(url.searchParams.has('id') || url.searchParams.has('username') ? state.user || user(A) : [user(A), user(B)]);
        if (url.pathname.endsWith('/contents')) {
            if (state.listGate) { const gate = state.listGate; state.listGate = null; await gate.promise; }
            if (state.failList) { state.failList = false; return json({ message: 'test failure' }, 400); }
            const filter = url.searchParams.get('or');
            let result = records.filter(row => row.visibility === 'public' || row.author_id === state.user?.id);
            if (filter) result = result.filter(row => split(filter.slice(1, -1)).some(c => matches(row, c)));
            if (url.searchParams.has('type')) result = result.filter(r => r.type === url.searchParams.get('type').slice(3));
            for (const field of ['id', 'author_id']) if (url.searchParams.has(field)) result = result.filter(row => matches(row, `${field}.${url.searchParams.get(field)}`));
            result.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
            const total = result.length, offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || total);
            result = result.slice(offset, offset + limit);
            return json(result, 200, { 'content-range': `${result.length ? offset + '-' + (offset + result.length - 1) : '*'}/${total}` });
        }
        if (url.pathname.endsWith('/content_images')) {
            if (state.imagesGate) await state.imagesGate.promise;
            if (state.failImages) { state.failImages = false; return json({ message: 'test image failure' }, 400); }
            const filter = url.searchParams.get('content_id');
            const ids = filter.startsWith('in.') ? split(filter.slice(4, -1)).map(s => s.replaceAll('"', '')) : [filter.slice(3)];
            return json(pictures.filter(p => ids.includes(p.content_id)));
        }
        forbidden.push(request.method() + ' ' + url.pathname); return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.accept());
    return { context, page, state };
}
function count(state, suffix) { return state.requests.filter(r => r.pathname === suffix).length; }
async function waitRows(page, count = 8) { await page.waitForFunction(n => document.querySelectorAll('.record-row').length === n, count); }
async function search(page, term) { await page.getByRole('searchbox').fill(term); await page.waitForFunction(() => !document.querySelector('[aria-label="正在加载内容"]')); }
async function login(page, email) { await page.locator('#login-account').fill(email); await page.locator('#login-password').fill('test-password'); await page.getByRole('button', { name: '登录', exact: true }).click(); await waitRows(page); }
async function logout(page) { await page.locator('.account-trigger').click(); await page.getByRole('button', { name: '退出登录', exact: true }).click(); await page.locator('.login-page').waitFor(); }
async function run() {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const imagesGate = deferred(), settingsGate = deferred();
        const { context, page, state } = await create(browser, { imagesGate, settingsGate });
        await page.goto(base);
        await page.locator('.login-page').waitFor();
        assert.equal(await page.getByRole('button', { name: '立即注册', exact: true }).count(), 0, 'Unknown settings must keep registration closed');
        assert.equal(state.chunks.some(p => /SettingsModal-|ContentModal-/.test(p)), false, 'Unused dialogs must not download on login');
        await page.getByRole('button', { name: '以访客身份浏览', exact: true }).click();
        await waitRows(page);
        assert.match(await page.locator('.content-count').innerText(), /100/);
        assert.equal(count(state, '/rest/v1/contents'), 2, 'Only date metadata plus 8 full records are requested');
        await page.waitForFunction(() => document.querySelector('.image-count')?.textContent.includes('加载中'));
        assert.equal(count(state, '/rest/v1/content_images'), 1, 'Only one batched image query for the page');
        assert.equal(count(state, '/storage/v1/object/sign/images'), 0, 'Text renders before signing');
        settingsGate.resolve(); imagesGate.resolve(); state.imagesGate = null;
        await page.locator('.record-preview img').first().waitFor();
        assert.equal(count(state, '/storage/v1/object/sign/images'), 1);
        const firstBatch = state.requests.find(r => r.pathname === '/rest/v1/content_images').params.content_id;
        assert.equal(split(firstBatch.slice(4, -1)).length, 8);
        const beforeReturn = state.requests.length;
        await page.getByRole('button', { name: '文章', exact: true }).click(); await waitRows(page, 1);
        await page.getByRole('button', { name: '日记', exact: true }).click(); await waitRows(page);
        assert.equal(count(state, '/rest/v1/contents'), 3, 'Return uses cache');
        assert.equal(count(state, '/rest/v1/profiles'), 1, 'Authors are cached');
        await page.getByRole('button', { name: '下一页', exact: true }).click(); await waitRows(page);
        assert.match(await page.locator('.record-title').first().innerText(), /记录 9$/);
        await page.locator('.record-row').first().click(); await page.locator('.detail-title').waitFor();
        await page.getByRole('button', { name: /返回列表/ }).click();
        assert.equal(await page.locator('[aria-current="page"].page-num').innerText(), '2');
        await search(page, '深处的搜索词'); await waitRows(page, 1);
        assert.equal(await page.locator('.record-title').innerText(), '记录 91');
        await search(page, specials); await waitRows(page, 1);
        assert.equal(await page.locator('.record-title').innerText(), '记录 91');
        await search(page, '不存在的记录'); await page.getByText('没有找到匹配内容', { exact: true }).waitFor();
        await search(page, ''); await waitRows(page);
        const gate = deferred(); state.listGate = gate;
        const slowRequest = page.waitForRequest(r => r.url().includes('/contents?') && r.url().includes('type=eq.album'));
        await page.getByRole('button', { name: '照片集', exact: true }).click();
        await slowRequest;
        await page.waitForFunction(() => Boolean(document.querySelector('[aria-label="正在加载内容"]')));
        await page.getByRole('button', { name: '日记', exact: true }).click(); await waitRows(page);
        gate.resolve();
        await page.waitForTimeout(100);
        assert.equal(await page.locator('.album-card').count(), 0, 'Late request must not overwrite active tab');
        state.failImages = true;
        await page.getByRole('button', { name: '照片集', exact: true }).click();
        await page.getByRole('button', { name: '重试图片', exact: true }).waitFor();
        assert.equal(await page.locator('.album-card').count(), 2);
        await page.getByRole('button', { name: '重试图片', exact: true }).click();
        await page.locator('.album-cover').waitFor();
        assert.ok((await page.locator('.album-cover').getAttribute('src')).includes('-1_thumb.webp'), 'Selected cover preserved');
        assert.equal(await page.locator('.album-count').first().innerText(), '3 张');
        assert.equal(await page.locator('.album-count').last().innerText(), '0 张');
        state.failList = true;
        await page.getByRole('button', { name: '全部', exact: true }).click();
        await page.getByRole('button', { name: '重新加载', exact: true }).waitFor();
        assert.equal(await page.getByText('这里还没有记录', { exact: true }).count(), 0);
        await page.getByRole('button', { name: '重新加载', exact: true }).click(); await waitRows(page);
        await page.getByRole('button', { name: '日记', exact: true }).click(); await waitRows(page);
        await page.getByRole('button', { name: '全部', exact: true }).click(); await waitRows(page);
        const beforeExpiry = count(state, '/rest/v1/contents');
        await page.evaluate(() => { const original = Date.now; Date.now = () => original() + 61_000; });
        await page.getByRole('button', { name: '日记', exact: true }).click(); await waitRows(page);
        assert.equal(count(state, '/rest/v1/contents'), beforeExpiry + 2, 'Expired cache refetches date metadata and current-page records');
        for (const width of [390, 320]) { await page.setViewportSize({ width, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); }
        if (process.env.TEST_SCREENSHOT) await page.screenshot({ path: process.env.TEST_SCREENSHOT, fullPage: true });
        await page.locator('.account-trigger').click(); await page.getByRole('button', { name: '外观设置', exact: true }).click();
        await page.getByRole('button', { name: '暗色', exact: true }).click();
        assert.ok(state.chunks.some(p => /SettingsModal-/.test(p)));
        assert.equal(state.chunks.some(p => /ContentModal-/.test(p)), false);
        await page.getByRole('button', { name: '关闭外观设置', exact: true }).click();
        await page.locator('.account-trigger').click(); await page.getByRole('button', { name: '登录账号', exact: true }).click();
        await login(page, 'demo@example.com');
        const privateGate = deferred(); state.imagesGate = privateGate;
        await search(page, '甲的私密'); await waitRows(page, 1);
        await page.locator('.record-row').first().click();
        await page.getByRole('button', { name: '编辑内容', exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: '编辑内容', exact: true }).isDisabled(), true, 'Editing before images arrive would lose images');
        await page.getByRole('button', { name: /返回列表/ }).click();
        await logout(page);
        await login(page, 'other@example.com');
        privateGate.resolve(); state.imagesGate = null;
        await search(page, '甲的私密'); await page.getByText('没有找到匹配内容', { exact: true }).waitFor();
        await search(page, '乙的私密'); await waitRows(page, 1);
        assert.equal(await page.locator('.record-title').innerText(), '乙的私密');
        await page.locator('.record-row').first().click();
        await page.getByRole('button', { name: '编辑内容', exact: true }).click();
        await page.locator('.uploaded-image').waitFor();
        assert.equal(await page.locator('.uploaded-image').count(), 1, 'Editor retains existing image');
        await page.getByRole('button', { name: '关闭编辑窗口', exact: true }).click();
        await search(page, ''); await waitRows(page);
        await page.locator('.publish-btn').click(); await page.getByRole('dialog').waitFor();
        await page.getByPlaceholder('请输入标题').fill('加速后新增');
        await page.getByPlaceholder('请输入正文').fill('缓存应立即失效');
        await page.getByRole('button', { name: '发布', exact: true }).click();
        await page.getByRole('dialog').waitFor({ state: 'hidden' }); await waitRows(page, 1);
        assert.equal(await page.locator('.record-title').first().innerText(), '加速后新增');
        assert.equal(state.saves, 1);
        assert.ok(state.chunks.some(p => /ContentModal-/.test(p)));
        await logout(page);
        await page.getByRole('button', { name: '以访客身份浏览', exact: true }).click(); await waitRows(page);
        await search(page, '私密'); await page.getByText('没有找到匹配内容', { exact: true }).waitFor();
        const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
        assert.equal(stored.includes('甲的私密') || stored.includes('乙的私密') || stored.includes('缓存应立即失效'), false);
        assert.deepEqual(errors, []);
        assert.deepEqual(forbidden, []);
        await context.close();
        const originalRecords = records;
        records = Array.from({ length: 100 }, (_, i) => make(i + 1));
        const shrinking = await create(browser);
        await shrinking.page.goto(base);
        await shrinking.page.getByRole('button', { name: '以访客身份浏览', exact: true }).click(); await waitRows(shrinking.page);
        records = records.slice(0, 8);
        await shrinking.page.getByRole('button', { name: '13', exact: true }).click(); await waitRows(shrinking.page);
        assert.equal(await shrinking.page.locator('.record-title').first().innerText(), '记录 1');
        assert.equal(await shrinking.page.locator('.pagination').count(), 0, 'Out-of-range page clamps after deletion elsewhere');
        await shrinking.context.close();
        records = originalRecords;
        assert.deepEqual(errors, []);
        assert.deepEqual(forbidden, []);
        console.log('PASS: 100-item fixture loads 8 records, 1 image query + 1 signing request; text precedes delayed images/settings; page/search/cache/races/error retries/covers/mobile/lazy dialogs/account isolation/save invalidation. All network operations mocked.');
    } finally { await browser.close(); }
}
run().catch(error => { console.error(error); console.error({ errors, forbidden }); process.exit(1); });
