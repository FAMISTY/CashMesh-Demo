import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const scope={};vm.runInNewContext(fs.readFileSync('receipt-parser.js','utf8'),scope);const {parse}=scope.CashMeshReceipt;
const base=`正在享受先用后付服务\n9天14时后自动扣款0.90元\n测试日用品商店\n商品价格 ¥6.56\n实付价 ¥0.9 价格明细\n共减¥5.66 优惠解析\n实付款¥0\n先用后付 确认收货后再付款¥0.9\n订单信息\n支付方式\n先用后付支付\n支付宝交易号 TESTTRANSACTION000001\n创建时间 2026-11-03 01:16:15`;
for(const text of [base,base.replaceAll('¥','￥'),base.replace('确认收货后再付款','确 认 收 货 后 再 付 款').replace('实付价 ¥0.9','实 付 价\n\n¥0.90'),base.replace('自动扣款0.90元','自动扣款\n0.90元')]){const p=parse(text);assert.equal(p.amount,'0.90');assert.equal(p.kind,'expense');assert.equal(p.settlement,'credit');assert.equal(p.deferred,true);assert.equal(p.paymentAccount,'先用后付');}
for(const label of ['确认收货后再付款','确认收货后付款','实付价'])assert.equal(parse('先用后付\n'+label+'¥0.90\n共减¥5.66\n实付款¥0').amount,'0.90',label);
assert.equal(parse('先用后付\n9天14时后自动扣款0.90元\n商品总价 ¥6.56\n共减 ¥5.66\n实付款 ¥0').amount,'0.90','future-debit header before region');
assert.equal(parse('先用后付\n商品总价 ¥6.56\n共减 ¥5.66\n实付款 ¥0\n确认收货后再付款 ¥0.90').amount,'0.90');
assert.equal(parse('先用后付\n共减¥5.66\n实付款¥0').amount,'','discount is never a fallback payment');
assert.equal(parse('先用后付\n实付价 ¥0.90\n共减\n¥5.66').amount,'0.90');
console.log('PASS actual deferred-order layout: payable 0.90, discount 5.66 excluded, zero paid ignored, future debit, label variants, countdown and credit classification.');
