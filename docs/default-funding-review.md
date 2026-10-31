# Default funding and final review

Unknown payment sources default to cash for forecasting, with a provisional flag. Exported transactions alone do not prove which funding instrument was used. Explicit credit evidence remains credit.

The final review shows the latest 30 calendar days, 50 rows per page. Users can change individual or selected rows to credit/cash, optionally show all history, then confirm all remaining defaults once. Confirmation also covers older provisional rows without changing explicit credit or manual choices. Other unresolved transaction errors remain separate.

Legacy unknown records migrate through auto-organization. Reimported explicit source evidence can replace assumed cash, but preserves manual recent-review edits. Assumptions are disclosed in forecast and chat until confirmed.

Validation: 3500 legacy rows, recent date filtering, explicit credit preservation, bulk edits, confirmation persistence, and DOM click paths.
