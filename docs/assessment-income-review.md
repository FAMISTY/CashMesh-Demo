# Spending assessment, history conversation and income setup

Assessment separates the mean of fully covered calendar months from a 30-day extrapolation; partial months do not count as full months. Daily mean and daily median explain skew. Adjustable large-expense threshold defaults to CNY1000; ultra-large means at least the greater of CNY5000 and that threshold. Counts, gross expense share, biggest records, peak month, a gross-spending average excluding large items, and recent-versus-prior 30-day changes are explained with coverage/classification caveats. Threshold changes affect assessment only, not daily-budget estimation.

The history section has an independent conversation log with monthly/daily, specific-month, category and large-expense answers based on current records. Daily-budget target questions reuse the historical scenario comparison, with changes only on explicit adoption. It is browser-local deterministic analysis rather than a model API.

Bulk exception review supports selected visible rows or all pending rows for a selected source. Users explicitly accept current displayed types or assign expense/income/internal-transfer types. Unknown direction is cleared only as a recorded user decision. Invalid amounts/dates, credit refunds without links and unresolved current repayments remain pending with counts and reasons. It does not silently force every exception to confirmed.

Initial conditions now include monthly allowance/income, next receipt date and number of repetitions. Applying settings upserts one origin-tagged income plan, so repeated updates do not add income twice. Zero removes only this setup plan; other income plans remain. Previously received income belongs in opening cash. Future income is booked on receipt dates. If none is recorded, forecast text explicitly says so. Deleting a setup income plan resets its input to avoid recreating it on the next calculation.

Validation includes DOM clicks for assessment and history chat, recurring income timing and idempotence, selected/source/all review, protected exceptions and existing import/forecast regressions. No private transaction fixtures are committed.
