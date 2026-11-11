## Start here

1. Open the [complete download kit](Aria_Invoice_Pipeline_GitHub_Ready.zip)
   and download the ZIP file.
2. Unzip it on your computer.
3. Inside the extracted `aria-invoice-pipeline` folder, open
   `docs/SETUP.md` for the installation instructions.
4. Test one synthetic invoice and compare the extracted data with
   the original PDF before enabling scheduled processing.

The complete kit includes setup instructions, troubleshooting guidance,
sample vendor mappings, sample email messages, and five synthetic invoices.

## Browse the code

These files are also available individually in this repository:

| File | Purpose |
|---|---|
| [Config.gs](Config.gs) | Workflow configuration, setup, menus, and scheduling. |
| [Sheets.gs](Sheets.gs) | Spreadsheet operations and tracking helpers. |
| [Intake.gs](Intake.gs) | Collect PDF email attachments and save them to Drive. |
| [Extract.gs](Extract.gs) | Gemini extraction, mapping, validation, and exception handling. |
| [appsscript.json](appsscript.json) | Apps Script project settings and permission scopes. |

Install the four `.gs` files in the same Apps Script project.
Place the JSON configuration in `appsscript.json`, not in a `.gs` file.

## Sample invoices available individually

- [Acme Supplies](01_Acme_ACS-DEMO-1002.pdf)
- [Westbridge IT Services](02_Westbridge_IT_WIT-DEMO-2001.pdf)
- [Clearview Facility Services](03_Clearview_Facility_CFS-DEMO-3001.pdf)
- [Pacific Print Studio](04_Pacific_Print_PPS-DEMO-4001.pdf)
- [Cedar Table Catering](05_Cedar_Table_CTC-DEMO-5001.pdf)

All five sample invoices are fictional and marked NOT PAYABLE.
