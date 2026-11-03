# 记录平台与资金账户

记录平台用于说明在哪个平台查看或完成交易；资金账户用于说明实际扣款/到账位置。

- 微信 + 农业银行储蓄卡（尾号4179）：即时扣款，不能写成微信零钱。
- 微信 + 工商银行信用卡（尾号1234）：信用支付，不能写成储蓄卡。
- 抖音 + 抖音月付：信用支付。
- 未识别的账户留空，明细显示“未记录，请核对”，不猜测余额。

新增 paymentAccount 字段贯穿解析、编辑、浏览器保存、备份、同步队列和主页面读取。旧记录不强制回填。银行卡只保存尾号。

云端需执行 cloud/payment-account.sql 更新既有 RPC；旧客户端不传此字段时保留云端已有值。初次部署使用 cloud/schema.sql。

验证：tests/payment-account.mjs、tests/wechat-amount.mjs、tests/journal-dom.mjs、tests/cloud-db.mjs。

待完成：Supabase 云端 RPC 更新确认连续超时，当前未应用，网页尚未发布。
