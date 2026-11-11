# Setup guide

Use a new, private demo workbook and synthetic documents. These steps describe the supplied source code; successful installation in your account still requires your own live test.

## 1. Create the Control workbook

Create a blank Google spreadsheet named **Invoice Pipeline – Control**. Place it in your desired Drive folder. Open **Extensions → Apps Script** and name the project **Invoice Pipeline**.

## 2. Install the files

Replace the default sample function with the contents of `apps-script/Config.gs`, renaming the file to `Config.gs`. Add Script files for `Sheets.gs`, `Intake.gs`, and `Extract.gs`, copying each complete file into its own editor file.

In Project Settings, enable **Show appsscript.json manifest file in editor**. Replace that manifest's contents with `apps-script/appsscript.json` from this download. Do not put JSON in a `.gs` file, and do not paste Markdown code fences into the editor.

Save all files. There should be exactly four `.gs` modules and one `appsscript.json`. Do not install `Config_1.gs` or copies of old versions.

## 3. Run Setup

Reload the Control spreadsheet. Select **Invoice Pipeline → 1. Setup**. Review the authorization prompt before granting access; the manifest requests Gmail, Drive, Sheets, external-request, interface, and trigger-management scopes. Do not bypass an organizational restriction.

Setup creates **Config, Mapping, Status, Exceptions**, a folder named **Invoice Pipeline - PDFs**, a separate **Invoice Pipeline - Output** workbook, and Gmail labels. The output workbook includes **Invoices, Line Items, Quotes, Quote Lines**. The folder/output workbook are created alongside the Control workbook where supported by your Drive permissions.

Setup does not install the recurring trigger or process invoices. A reminder about a missing API key is expected when no key has been stored yet.

## 4. Configure Gemini privately

Obtain a Gemini API key for an appropriate project through Google AI Studio. Confirm its API/model availability, quota, billing, and data-use terms. The recording used a Free Tier project and `gemini-3.5-flash-lite`; those recorded circumstances do not guarantee current access for another account.

In Apps Script → Project Settings → Script Properties, add:

| Property | Value |
|---|---|
| GEMINI_API_KEY | Your secret key, entered privately |

Keep `CONTROL_SS_ID` and other Setup-created properties. A numeric Cloud project number is not an API key. This code uses a key-based external request; it does not require switching Apps Script's default linked Cloud project merely to call Gemini.

## 5. Set Config

| Setting | Suggested first test |
|---|---|
| GEMINI_MODEL | A PDF/structured-output model you have verified is available; recorded demo: `gemini-3.5-flash-lite` |
| EXTRACT_BATCH_SIZE | `1` |
| API_TIMEOUT_SECONDS | `120` for the recorded troubleshooting configuration; allowed range in this code is 10–120 |
| REQUIRE_VENDOR_MAPPING | `TRUE` |
| EMAIL_SUBJECT_CONTAINS | `Aria Invoice Demo` |

Leave Setup-created folder/output IDs unchanged unless deliberately choosing another compatible destination. `GEMINI_MODEL` starts blank in the code. The code default for batch size is 3 and timeout is 60; the test settings above are explicit changes, not the defaults.

A larger timeout is not a guarantee of provider availability. Start with one file and keep scheduling off.

## 6. Configure Gmail intake

Create a Gmail filter matching:

```text
subject:"Aria Invoice Demo" has:attachment filename:pdf
```

Apply the existing label **invoices/to-process**. Choose to apply it to existing matching conversations only when you want those messages included in the next intake.

The Config value `GMAIL_LABEL_TODO` must match the label. The code also checks `EMAIL_SUBJECT_CONTAINS`. Using a label is a routing rule, not a permission boundary restricting the script's Gmail OAuth scope.

## 7. Add vendor mappings

Open `sample-data/vendor_mapping_example.csv` and copy its four data rows to Mapping **below the existing headers**. Do not create a duplicate Acme rule: update the seeded example or replace that example with the CSV data. Keep the exact seven-column order and set Active to checked/TRUE for the four intended rows.

Use `VENDOR_NAME` when all sample emails are sent from the same test address. The CSV intentionally leaves out **Westbridge IT Services**. Its invoice will become an unmapped-vendor exception when the configured validation runs. You can later add a reviewed vendor rule and revalidate; do not turn off mapping checks to hide that exception.

**Default Currency is not an implemented fallback in this version.** Currency is read from the document. GL Code is a vendor-level invoice-header default, not line-level classification.

## 8. Test Acme only

Send the Acme PDF to your demo mailbox using its supplied subject/body. If other samples are already labeled, temporarily remove the intake label from those other messages before this isolated test. Do not delete the messages or data.

Run **Invoice Pipeline → Run intake now (Gmail → Drive)** once. Confirm a saved PDF and a `RECEIVED` Status record. This step does not call Gemini.

Run **Run extraction now (Drive → Sheets)** once. Inspect the resulting state, error/exception if any, and actual output. Do not treat a successful script execution alone as a passed extraction.

For `ACS-DEMO-1002`, compare with the PDF:

| Item | Quantity | Unit price | Amount |
|---|---:|---:|---:|
| Multipurpose copy paper - carton | 6 | 48.00 | 288.00 |
| Black printer toner cartridge | 3 | 89.50 | 268.50 |
| Hardcover notebook | 18 | 6.75 | 121.50 |
| Desktop organizer | 5 | 18.50 | 92.50 |

Subtotal: **770.50**. Invoice-level tax: **61.64**. Total: **832.14 USD**. Invoice number: **ACS-DEMO-1002**. Purchase order: **PO-DEMO-2101**. The PDF does not state a separate tax amount for each line.

Confirm that **View original invoice** opens the correct saved PDF. The source link appears on both header and line rows. Output is marked for human review, not approved for posting or payment.

## 9. Enable the scheduled demonstration

After the first document is checked, select **Invoice Pipeline → 2. Install trigger (every 5 minutes)** once. Under one trigger owner, the code installs one `runPipeline` trigger. It collects new attachments and then processes a bounded extraction batch.

Send the remaining sample PDFs using their supplied email subjects. Let Gmail apply the label. Do not also click a manual Run command if you are demonstrating scheduled execution.

With `EXTRACT_BATCH_SIZE = 1`, one run may collect several PDFs while extracting at most one queued document. More scheduled runs are needed to process the rest. Do not claim every file finishes in exactly five minutes. Keep raw source files and Status records intact to retain duplicate detection.

The routing label remains on the thread. **invoices/done** describes collection; it does not establish extraction success. The PDF folder also contains saved extraction JSON files after successful model responses.

## 10. Resolve or stop

Use **REVALIDATE** for an updated mapping when extracted JSON already exists. Use **RETRY** only to request another extraction. Use **IGNORE** to exclude a document while retaining its source and tracking record. See [troubleshooting](TROUBLESHOOTING.md).

After the demo, select **Invoice Pipeline → Remove triggers** so the workflow does not keep running under your account.
