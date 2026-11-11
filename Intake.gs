/**
 * Intake.gs: Gmail (labelled threads) → Drive folder → Status row "RECEIVED".
 * Dedupes by SHA-256 of the PDF bytes, so re-sent invoices are saved only once.
 */

function runIntake() {
  return withPipelineLock_(deadline => runIntakeCore_(getConfig_(true), deadline));
}

function runIntakeCore_(cfg, deadline) {
    const todo = GmailApp.getUserLabelByName(cfg.GMAIL_LABEL_TODO);
    if (!todo) throw new Error('Gmail label "' + cfg.GMAIL_LABEL_TODO + '" not found — run Setup.');
    const done = getOrCreateLabel_(cfg.GMAIL_LABEL_DONE);
    const folder = DriveApp.getFolderById(cfg.DRIVE_FOLDER_ID);
    const status = sheet_(ctl_(), TABS.STATUS);
    const known = {};
    readTable_(status).forEach(r => { known[r.data['Hash']] = true; });

    const threads = todo.getThreads(0, Number(cfg.INTAKE_THREAD_LIMIT) || 20);
    for (const thread of threads) {
      if (Date.now() > deadline - MIN_START_REMAINING_MS) break;
      let pdfCount = 0;
      let incomplete = false;
      thread.getMessages().forEach(msg => {
        const phrase = String(cfg.EMAIL_SUBJECT_CONTAINS || '').toLowerCase();
        if (phrase && msg.getSubject().toLowerCase().indexOf(phrase) < 0) return;
        if (Date.now() > deadline - MIN_START_REMAINING_MS) { incomplete = true; return; }
        msg.getAttachments({ includeInlineImages: false }).filter(isPdf_).forEach(att => {
          pdfCount++;
          const hash = sha256_(att.getBytes());
          if (known[hash]) return; // duplicate file, already in pipeline
          if (Date.now() > deadline - MIN_START_REMAINING_MS) { incomplete = true; return; }
          const name = fileName_(msg, att.getName()).replace(/\.pdf$/i, '') + '__' + hash.slice(0, 16) + '.pdf';
          // Reuse an orphan file after a prior interruption between Drive and Status.
          const existing = folder.getFilesByName(name);
          const file = existing.hasNext() ? existing.next() : folder.createFile(att.copyBlob().setName(name));
          appendObj_(status, {
            'File ID': file.getId(),
            'File Name': file.getName(),
            'File Link': file.getUrl(),
            'Message ID': msg.getId(),
            'Sender': msg.getFrom(),
            'Subject': msg.getSubject(),
            'Received At': msg.getDate(),
            'Hash': hash,
            'State': 'RECEIVED',
            'Attempts': 0, 'API Calls': 0, 'Force Extraction': false,
            'Updated At': new Date(),
          });
          known[hash] = true;
        });
      });

      // Non-PDF messages are skipped. PDF-only intake is defined by the Gmail filter.

      // Keep the routing label: removing it from a thread can hide a newly arrived reply.
      // 'done' describes collection, not completion of Gemini extraction. Status is the queue.
      if (!incomplete) thread.addLabel(done);
    }
}

function isPdf_(att) {
  return att.getContentType() === 'application/pdf' || /\.pdf$/i.test(att.getName());
}

function sha256_(bytes) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes)
    .map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function fileName_(msg, original) {
  const date = Utilities.formatDate(msg.getDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const sender = (msg.getFrom().match(/<([^>]+)>/) || [null, msg.getFrom()])[1]
    .replace(/[^\w.@-]/g, '_');
  return date + '_' + sender + '_' + original;
}
