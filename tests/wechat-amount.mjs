import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const scope={};vm.runInNewContext(fs.readFileSync('receipt-parser.js','utf8'),scope);const {parse}=scope.CashMeshReceipt;
const detail=(main,extra='银行卡立减金\n¥0.50')=>`微信支付\n测试商户\n${main}\n当前状态\n支付成功\n商品\n午餐\n支付方式\n银行卡\n${extra}\n交易时间\n2026-11-03 12:01:00\n交易单号\nTESTWECHAT0000001`;
for(const amount of ['-38.00','-¥38.00','¥-38.00','￥38.00','·38.00','38.00']){const p=parse(detail(amount));assert.equal(p.amount,'38.00',amount);assert.equal(p.kind,'expense');assert(p.evidence.some(x=>x.includes('微信')));}
assert.equal(parse(detail('-0.30','银行卡立减金优惠\n¥0.50')).amount,'0.30','do not choose the largest or smallest number blindly');
assert.equal(parse(detail('-38.00','银行卡立减金优惠0.50元\n优惠 ¥0.50')).amount,'38.00');
assert.equal(parse('微信支付\n银行卡立减金\n¥0.50\n当前状态 支付成功').amount,'','a benefit alone is not a payment');
assert.equal(parse('支付成功\n银行卡立减金\n¥0.50').amount,'','general fallback must also exclude discounts');
assert.equal(parse('微信支付\n测试商户\n¥38.00\n¥0.50\n当前状态 支付成功').amount,'','ambiguous headline needs review');
assert.equal(parse(detail('实付金额 ¥38.00')).amount,'38.00');
assert.equal(parse('抖音月付\n商品总价\n订单运费\n平台优惠\n确认收货后付\n¥6.99\n¥0.00\n-¥5.00\n¥1.99\n订单编号 TESTORDER12345678').amount,'1.99');
assert.equal(parse('抖音月付\n实付金额 ¥1.99\n银行卡立减金优惠 ¥0.50').amount,'1.99');
console.log('PASS: WeChat signed headline, currency glyphs, split discounts, benefit-only refusal, ambiguity, explicit payable, and deferred-order regression.');
