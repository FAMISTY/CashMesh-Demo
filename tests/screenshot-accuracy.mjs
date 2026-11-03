import fs from 'node:fs';import assert from 'node:assert/strict';import {Window} from 'happy-dom';
const w=new Window({url:'https://example.test/'}),html=fs.readFileSync('index.html','utf8');w.document.write(html);const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];for(let i=0;i<scripts.length;i++)w.eval(scripts[i][1]+(i===scripts.length-1?'\n'+fs.readFileSync('notifications.js','utf8'):''));w.eval(fs.readFileSync('screenshot-import.js','utf8'));const C=w.CashMesh,parse=C.parseScreenshotText,$=id=>w.document.getElementById(id);
const order='运输中\n测试日用品旗舰店\n商品总价 ¥6.99\n订单运费 ¥0.00\n平台优惠 立减5元 -¥5.00\n确认收货后付 ¥1.99\n订单编号 TESTORDER00000001\n支付方式 抖 音 月 付\n下单时间 2026-11-02 01:23:46\n付款时间 2026-11-02 01:23:50';
let p=parse(order);assert.equal(p.amount,'1.99');assert.equal(p.platform,'抖音月付');assert.equal(p.kind,'expense');assert.equal(p.transactionId,'TESTORDER00000001');assert.equal(p.merchant,'测试日用品旗舰店');assert(p.deferred&&p.requiresReview);assert.match(p.timestamp,/2026-11-02/);
for(const text of [order.replace('确认收货后付 ¥1.99','确 认 收 货 后 付\n￥ 1.99'),order.replace('¥1.99','￥１．９９')])assert.equal(parse(text).amount,'1.99');
assert.equal(parse('花呗 支付成功 商品总价￥100 优惠￥20 实付￥80 2026/11/2').amount,'80');
assert.equal(parse('花呗 支付成功 ￥80 ￥100').amount,'');
assert.equal(parse('花呗 支付成功 实付￥80 实付￥100').amount,'');
assert.equal(parse('花呗 本期应还￥300 最低还款￥30 2026年11月2日').amount,'300');
assert.equal(parse('花呗 退款成功 退款金额￥5 商品金额￥100').kind,'refund');
assert.equal(parse('花呗 还款成功 还款金额￥40 账单金额￥100').amount,'40');
assert.equal(parse('花呗 待付款 订单金额￥40').kind,'');
assert.equal(parse('花呗 支付成功 实付￥40 2026-02-30').timestamp,'');
$('shotText').value=order;$('shotParse').click();assert.equal($('shotAmount').value,'1.99');assert.equal($('shotPlatform').value,'抖音月付');assert.match($('shotResult').textContent,/收货后付款/);
// The latest edited text is parsed at confirmation; it must not reuse an older order identity.
$('shotText').value=order.replace('TESTORDER00000001','TESTORDER00000099');$('shotConfirm').click();assert.equal(C.getState().events.filter(e=>e.external==='TESTORDER00000099').length,1);assert.equal(C.getState().events.find(e=>e.external==='TESTORDER00000099').settlement,'credit');
// Handoff pre-fills rather than silently committing uncertain OCR results.
w.location.hash='#capture='+encodeURIComponent(order.replace('TESTORDER00000001','TESTORDER00000000'));w.dispatchEvent(new w.Event('hashchange'));assert.equal($('shotAmount').value,'1.99');assert.equal(C.getState().events.filter(e=>e.external==='TESTORDER00000000').length,0);
console.log('PASS: deferred order, OCR whitespace/fullwidth amounts, competing prices, ambiguous totals, refund/repayment, invalid date, current-text submission and handoff review.');await w.happyDOM.abort();
