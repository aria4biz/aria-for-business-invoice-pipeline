# Troubleshooting and operating notes

Keep scheduled processing disabled while diagnosing a single file. Do not resend PDFs, rerun Setup, or recreate API keys as a substitute for reading the latest error.

## Pick the correct action

| Situation | Action |
|---|---|
| Vendor rule changed and extraction JSON exists | Select **REVALIDATE** on the matching unresolved exception, then **Apply exception actions**. This action reuses saved extraction without calling Gemini. |
| A new extraction is needed after a provider/configuration issue | Select **RETRY** on the actual populated exception row, apply actions, then run extraction once. |
| Already in RETRY with Next Attempt At in the future | Leave it queued. It is not eligible until that time. With the scheduler off, a manual extraction run is still required after the time passes. |
| State FAILED | It is not in the extraction queue. Requeue deliberately using its populated exception row; do not edit an unrelated empty row. |
| Document should not continue | **IGNORE** retains the source/tracking record but excludes it from processing. It does not delete the file. |

RETRY resets the current attempt count and flags another model extraction. The cumulative API Calls count is not an exact billing ledger and does not include separate diagnostics outside this queue. A timeout does not prove the provider performed no work.

## HTTP errors and timeouts

The original `Extract.gs` in this bundle reports a generic `Gemini HTTP <code>` error. It does not retain the provider's detailed response body. This is an explicitly documented limitation: **do not infer an account-access problem, billing cause, or permanent outage from that generic string alone**.

For further debugging, obtain a sanitized provider error or use a separate minimal text test with the same key/model. Never print or publish the API key, PDF payload, or full request. A metadata lookup succeeding does not prove text generation or PDF extraction succeeds. The tutorial's model switch is an observed recovery, not proof that every timeout means a Free Tier restriction.

Before purchasing anything, verify the project associated with your key, the current provider error, model availability, allowance, and billing status. Do not buy credits simply because a request timed out. Model quota and availability can change.

`API_TIMEOUT_SECONDS` is bounded to 10–120 by this code. The process also has an overall runtime budget. Automatic retry delay grows from approximately 2 minutes after the first retryable failure to 4 minutes after the second. The default MAX_ATTEMPTS is 3. HTTP 4xx other than 408/429 are treated as non-retryable by this implementation.

## Exceptions appear far below the headers

A previously initialized sheet may contain FALSE values in otherwise empty checkbox rows. The append helper uses the sheet's last populated row, so these values can move new exceptions far down the sheet. Find the document's filename or exception ID with the spreadsheet's Find command; do not enter a cell address such as H1001 into a data cell.

This package applies checkbox validation without intentionally filling empty rows. It does not migrate an older workbook that already contains those placeholder values. Start in a fresh workbook. For an existing workbook, back it up and review the unused rows before any cleanup; do not delete real exception records or change header names.

## Ambiguous mappings

Matching is case-insensitive, contains-based, and whitespace-normalized. It is not typo correction. Keep Match Text distinctive. More than one active vendor-name match generates an ambiguity exception rather than choosing a first match. A sender alone does not establish vendor identity in the final mapping; forwarded documents need care.

Currency is extracted from the PDF. The Default Currency mapping column is not used as a fallback. The GL code is a vendor-level header default, not per-line classification.

## Setup and source integrity

- JSON belongs in `appsscript.json`; `.gs` files contain JavaScript.
- Install only one copy of each of the four modules.
- Do not rename or reorder the generated headers. The code expects its schema.
- Save the script and reload the spreadsheet to refresh the menu.
- A saved file in Drive means collection worked, not extraction.
- WRITTEN_TO_SHEETS means rows passed implemented checks and were written, not that human review is complete.
- If line writing is interrupted, the implementation uses source/line identifiers to try to resume existing output. Verify review status and row completeness before using an output. Do not manually set success states to hide a partial write.
- Quotes have separate tabs. Credit notes, statements, and other unsupported document types must not be treated as payable invoices.

## Demo is not a high-volume service

Intake reads a limited set of labeled threads and retains the routing label. It does not paginate through an unlimited backlog. Sheets/Drive operations are not transactional. The shared script lock and execution budget can skip busy invocations; the queue resumes only on subsequent eligible executions. Test concurrency, backlog behavior, failure recovery, quotas, review effort, and correctness before deploying at scale.

The exported table is a review layer, not a ready-made connector for every accounting product. Map it to the actual destination schema and design approval/security controls before building a real integration.
