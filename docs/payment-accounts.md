# 账单渠道、交易平台、商户与资金账户

记录平台用于说明在哪个平台查看或完成交易；资金账户用于说明实际扣款/到账位置。

- 微信 + 农业银行储蓄卡（尾号4179）：即时扣款，不能写成微信零钱。
- 微信 + 工商银行信用卡（尾号1234）：信用支付，不能写成储蓄卡。
- 抖音 + 抖音月付：信用支付。
- 未识别的账户留空，明细显示“未记录，请核对”，不猜测余额。

新增 paymentAccount 字段贯穿解析、编辑、浏览器保存、备份、同步队列和主页面读取。旧记录不强制回填。银行卡只保存尾号。

云端需执行 cloud/payment-account.sql 更新既有 RPC；旧客户端不传此字段时保留云端已有值。初次部署使用 cloud/schema.sql。

验证：tests/payment-account.mjs、tests/wechat-amount.mjs、tests/journal-dom.mjs、tests/cloud-db.mjs。

待完成：Supabase 云端 RPC 更新确认连续超时，当前未应用，网页尚未发布。

## 交易平台与商户

- platform：账单渠道，如微信、支付宝、抖音订单页面。
- businessPlatform：明确识别出的交易平台，如拼多多、抖音、小红书。
- merchant：商户全称、商家名称或明确的交易对方。
- paymentAccount：真实扣款/到账账户。

商户和平台有证据则自动填写；只有公司名无法确认购物平台时留空。交易平台图表将未知交易单列，不将微信账单渠道自动当作购物平台。

“好评返现”有已到账、已收款等证据时记作收入；待领取、预计到账和宣传语不作为收入，也不把优惠金额当成支付金额。

新增 tests/platform-merchant.mjs；云端待确认更新同时保留 businessPlatform 和 paymentAccount。
