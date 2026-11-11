# Aria Invoice Pipeline

**Gmail → Google Drive → Apps Script + Gemini → Google Sheets**

Companion code and synthetic sample files for the **AI for Business** invoice-processing tutorial.

This educational prototype collects matching PDF email attachments, preserves source documents in Drive, asks Gemini for structured invoice data, applies explicit vendor mappings and validation, and writes records for human review in Sheets.

**This is not an accounting system, a payment system, or a production-certified integration.** No invoices are approved or paid by this code.

## Start here

1. Download the repository using **Code → Download ZIP**, then unzip it.
2. Follow the [setup guide](docs/SETUP.md).
3. Test one synthetic invoice and compare every extracted field with its PDF before enabling scheduled processing.

The recording used `gemini-3.5-flash-lite` successfully. That is a record of the demonstration, **not a promise of current model availability, free quota, speed, or accuracy**. Choose a PDF- and structured-output-capable model available in your own API project.

## Files

| Folder/file | Purpose |
|---|---|
| [apps-script/](apps-script/) | Four Apps Script modules and the manifest to install. |
| [sample-invoices/](sample-invoices/) | Five fictional, one-page invoices, marked **NOT PAYABLE**. |
| [sample-data/vendor_mapping_example.csv](sample-data/vendor_mapping_example.csv) | Four sample vendor rules. Westbridge is intentionally omitted for an exception test. |
| [sample-data/sample_email_subjects_and_bodies.txt](sample-data/sample_email_subjects_and_bodies.txt) | Copyable subjects and email messages for your test mailbox. |
| [docs/SETUP.md](docs/SETUP.md) | Installation, configuration, first test, and scheduling. |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Retry, revalidation, model-connection, and setup guidance. |
| [PACKAGE_NOTES.md](PACKAGE_NOTES.md) | Provenance, packaging checks, and limitations of this download. |

Install **only** these four JavaScript files in one spreadsheet-bound project: `Config.gs`, `Sheets.gs`, `Intake.gs`, and `Extract.gs`. The JSON manifest goes in **`appsscript.json`**, never in a `.gs` file. Do not install duplicate versions of the same module.

## What the Control workbook does

- **Config** holds destinations, model selection, and processing settings.
- **Mapping** contains business-defined vendor rules, not AI-generated accounting decisions.
- **Status** tracks the current processing state, attempts, errors, source link, and extraction reference for each document.
- **Exceptions** surfaces issues with actions to retry extraction, revalidate a saved result, or exclude a document.

Status is not a complete immutable event log: some current-state fields are overwritten. Exception resolver notes retain selected retry/resolution information, but neither workbook provides a formal approval or tamper-proof audit trail.

## What the mapping actually implements

The code matches active vendor rules using a **case-insensitive contains check**, with leading/trailing and repeated whitespace normalized. `acme`, for example, can match `Acme Supplies Inc.`. This is not fuzzy matching. Multiple active matching vendor rules are flagged as ambiguous rather than silently choosing an arbitrary vendor.

The current vendor mapping standardizes the vendor name and places a **vendor-level default GL code on the invoice header**. It does not assign individual GL accounts to each line item. Line-level classification, internal vendor/item IDs, cost centers, PO matching, and destination-specific rules are future implementation work.

### Currency clarification

The Mapping tab contains a **Default Currency** column for compatibility with the demonstrated layout. **This version does not apply that column as a fallback.** Currency is extracted from the PDF, required by validation, and written from the extraction result. A missing currency needs review; it is not filled from the vendor table.

### Extraction Notes clarification

Before a first extraction, vendor-specific notes can be selected using a sender rule. A rule keyed by `VENDOR_NAME` becomes usable for those instructions on a retry when a prior saved extraction identifies the vendor. Do not assume that adding a vendor-name note changes a first request whose vendor has not yet been identified.

## Output and traceability

**Invoices** contains document-level records. **Line Items** contains the billed charges, linked by invoice key and source-file ID. Both include links to the saved PDF. Quotes, when accepted, are routed to **Quotes** and **Quote Lines**, not the invoice tabs.

`WRITTEN_TO_SHEETS` and `READY FOR HUMAN REVIEW` mean that the programmed checks passed and review rows were written. **They do not prove that all values are correct, authorize payment, or establish compatibility with any particular accounting import/API.**

In the sample Acme PDF, tax is shown only at invoice level. The line-level tax fields remain blank when not stated in the source; blank is not equivalent to zero. A downstream system requiring allocation needs an explicitly designed, reviewed rule rather than invented source values.

## Sample invoices

| Vendor | Invoice | Reference total (USD) |
|---|---|---:|
| Acme Supplies Inc. | ACS-DEMO-1002 | 832.14 |
| Westbridge IT Services | WIT-DEMO-2001 | 1,486.00 |
| Clearview Facility Services | CFS-DEMO-3001 | 1,676.00 |
| Pacific Print Studio | PPS-DEMO-4001 | 720.36 |
| Cedar Table Catering | CTC-DEMO-5001 | 956.34 |

All documents and vendor email addresses are fictional. Use a test mailbox you control; do not send email to the placeholder vendor addresses. The GL codes and tax treatments are illustrative, not accounting or tax advice.

## Security, cost, and sharing

Store your own `GEMINI_API_KEY` in Apps Script **Script Properties**, never in GitHub, a spreadsheet cell, a video, or source code. No key is included in this repository. Keep the working spreadsheet/project private: Script Properties are not a security boundary against collaborators who can edit the project.

The manifest requests broad Gmail, Drive, and Sheets permissions in addition to external requests and trigger management. Review them before authorizing. Intake filters restrict what this code chooses to process; they do not narrow the underlying OAuth access to only the demo emails.

Use synthetic documents for the public tutorial. Check the provider's current data-use terms, region/account eligibility, billing configuration, and API limits before using real documents. A paid chat subscription or a Cloud trial balance is not proof that this API project has funded/available generation quota. Do not enable billing or buy credits unless you intentionally accept the charges.

A Drive link does not grant access by itself. Share only this clean repository, not your live inbox, operational workbooks, extraction logs, or credential-bearing project. The included `.gitignore` is a convenience, not a guarantee against accidentally publishing secrets.

## Scope and known limits

This download has no production-volume benchmark, independent accuracy guarantee, SLA, payment execution, accounting-system connector, or immutable approval log. The intake function scans a bounded set of labeled threads; it does not paginate through an unlimited backlog. Do not extrapolate the small demo to sustained high-volume operation without addressing that design and testing it.

Do not delete queue records, change headers, or rebuild output rows to hide a failed test. Correct the cause, then retry or revalidate deliberately. Review [troubleshooting](docs/TROUBLESHOOTING.md) before repeatedly sending requests.

## Use

You may adapt this demo code for learning and internal prototyping. Validate security, accounting, tax, compliance, and system-integration requirements before using it in a production process.

## Official references

- [Google Apps Script: bound projects](https://developers.google.com/apps-script/guides/bound)
- [Google Apps Script: Script Properties](https://developers.google.com/apps-script/guides/properties)
- [Google Apps Script: collaboration and access](https://developers.google.com/apps-script/guides/collaborating)
- [Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key)
- [Gemini model documentation](https://ai.google.dev/gemini-api/docs/models)
- [Gemini API terms](https://ai.google.dev/gemini-api/terms)
