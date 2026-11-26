const escapeCsvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

export const safeLoginPackFilename = (value) => String(value || 'school')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const downloadBlob = (filename, content, type) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const downloadStudentLoginCsv = (schoolName, credentials) => {
  const headers = ['firstName', 'lastName', 'username', 'email', 'temporaryPassword', 'yearGroup', 'tutorGroup', 'isActive'];
  const content = [
    headers.map(escapeCsvValue).join(','),
    ...credentials.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(','))
  ].join('\r\n');
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(
    `${safeLoginPackFilename(schoolName)}-student-logins-${date}.csv`,
    content,
    'text/csv;charset=utf-8'
  );
};

export const downloadStudentLoginHtml = (schoolName, credentials) => {
  const generatedAt = new Date();
  const cards = credentials.map((credential) => {
    const fullName = [credential.firstName, credential.lastName].filter(Boolean).join(' ') || credential.username;
    const classDetails = [credential.yearGroup && `Year ${credential.yearGroup}`, credential.tutorGroup]
      .filter(Boolean)
      .join(' · ');
    return `
      <article class="login-card">
        <div class="card-accent"></div>
        <div class="card-header">
          <div>
            <p class="eyebrow">INNER PERFORMANCE</p>
            <h2>${escapeHtml(fullName)}</h2>
            ${classDetails ? `<p class="class-detail">${escapeHtml(classDetails)}</p>` : ''}
          </div>
          <span class="badge">Student login</span>
        </div>
        <div class="school">${escapeHtml(schoolName)}</div>
        <dl>
          <div><dt>Username</dt><dd>${escapeHtml(credential.username)}</dd></div>
          <div><dt>Email</dt><dd>${escapeHtml(credential.email)}</dd></div>
          <div class="password"><dt>Temporary password</dt><dd>${escapeHtml(credential.temporaryPassword)}</dd></div>
        </dl>
        <p class="instruction">Sign in using these details. Keep this page private and change your password when instructed by your school.</p>
      </article>
    `;
  }).join('');

  const content = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(schoolName)} student login pack</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #eef2ff; color: #0f172a; }
    .page-header { padding: 34px 40px 26px; background: linear-gradient(135deg, #312e81, #6d28d9 55%, #0891b2); color: white; }
    .page-header p { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: .24em; text-transform: uppercase; color: #cffafe; }
    .page-header h1 { margin: 8px 0 6px; font-size: 30px; }
    .page-header .meta { font-size: 13px; color: #e0e7ff; }
    .notice { margin: 22px 40px 0; padding: 14px 16px; border: 1px solid #f59e0b; border-radius: 14px; background: #fffbeb; color: #92400e; font-size: 13px; font-weight: 650; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; padding: 22px 40px 40px; }
    .login-card { position: relative; overflow: hidden; break-inside: avoid; border: 1px solid #cbd5e1; border-radius: 18px; background: white; padding: 22px; box-shadow: 0 12px 30px rgba(15, 23, 42, .08); }
    .card-accent { position: absolute; inset: 0 0 auto; height: 5px; background: linear-gradient(90deg, #7c3aed, #22d3ee); }
    .card-header { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; }
    .eyebrow { margin: 0; font-size: 9px; font-weight: 900; letter-spacing: .2em; color: #7c3aed; }
    h2 { margin: 5px 0 0; font-size: 20px; }
    .class-detail { margin: 4px 0 0; color: #64748b; font-size: 12px; }
    .badge { white-space: nowrap; border-radius: 999px; background: #ede9fe; color: #6d28d9; padding: 6px 9px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
    .school { margin-top: 18px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 13px; font-weight: 700; }
    dl { display: grid; gap: 10px; margin: 15px 0; }
    dl div { border-radius: 11px; background: #f8fafc; padding: 10px 12px; }
    dt { color: #64748b; font-size: 9px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    dd { margin: 4px 0 0; overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; font-weight: 750; }
    dl .password { background: #ecfeff; border: 1px solid #a5f3fc; }
    dl .password dd { color: #155e75; font-size: 18px; letter-spacing: .12em; }
    .instruction { margin: 0; color: #64748b; font-size: 10px; line-height: 1.5; }
    @media (max-width: 760px) { .grid { grid-template-columns: 1fr; padding: 18px; } .page-header { padding: 28px 18px 22px; } .notice { margin: 18px 18px 0; } }
    @media print {
      @page { size: A4; margin: 10mm; }
      body { background: white; }
      .page-header { padding: 14px 16px; border-radius: 12px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .notice { margin: 12px 0; }
      .grid { padding: 0; gap: 10px; }
      .login-card { box-shadow: none; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <header class="page-header">
    <p>Inner Performance</p>
    <h1>${escapeHtml(schoolName)} student login pack</h1>
    <div class="meta">${credentials.length} students · Generated ${escapeHtml(generatedAt.toLocaleString())}</div>
  </header>
  <div class="notice">Confidential: every password in this pack was newly generated. Store and distribute these details securely.</div>
  <main class="grid">${cards}</main>
</body>
</html>`;

  const date = generatedAt.toISOString().slice(0, 10);
  downloadBlob(
    `${safeLoginPackFilename(schoolName)}-student-logins-${date}.html`,
    content,
    'text/html;charset=utf-8'
  );
};
