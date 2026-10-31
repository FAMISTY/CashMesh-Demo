# Transaction semantics and purpose classification

Classification now uses merchant, product/description, and transaction type. CSV/Excel aliases include product description and transaction category; supported PDF adapters also retain summary/memo in a description column. Existing unclassified records are re-evaluated, with a visible rule basis; explicit manual classifications/types are preserved.

Food delivery including Taobao flash purchase is a dining heuristic, while coffee/tea/drink terms map to beverages. These are editable keyword rules, not a guarantee about the purchased item.

Shopping credit or stored-value top-ups are prepaid transfers, excluded from consumption, but cash-funded top-ups still reduce available cash. Actual goods purchased using an explicit stored-value payment method count as consumption without debiting cash again. A shopping-credit payment is not treated as another top-up. Mixed-source payments cannot be split accurately without component amounts.

Explicit fund subscriptions/auto-purchases are investment outflows; explicit redemptions are capital inflows, not wholly investment profit; explicit dividends/earnings are income; dividend reinvestment is neutral. Generic fund-name rows with no identified purpose are tracked separately from consumption, preserving their known cash direction and disclosing the ambiguity. Charitable foundations/donations are not treated as investment funds.

Consumption statistics/budget estimation exclude capital/prepaid operations while cash forecasting retains explicit cash movements. Supported credit-funded prepaid/investment outflows remain repayment obligations. The purpose distinction is described in history analysis and answers.

Tests cover food/product descriptions, repair of old uncategorised rows, prepaid top-up and actual purchase, investment purchase/redemption/dividend/reinvestment, unknown fund names, cashflow totals and manual overrides. No private transaction fixture is committed.
