// ============================================================
//  DASHBOARD TEMPAHAN — INSTITUT TEKNOLOGI UNGGAS
//  Code.gs v4 — Fix Column Mismatch + Header-Based Mapping
// ============================================================

// ── SUMBER TEMPAHAN ──
const SOURCES = [
  { id: '1eiHYWxtkdOrf9FU_vvutbESskAY9klFtWtKpsFYbM_s', gid: 970969483,  label: 'ANAK PUYUH PENELUR' },
  { id: '1HbXJUqBOyu-dUixgaPNlFfZhPqLibq_AeVju2JfbYfU', gid: 1049901411, label: 'ANAK PUYUH PEDAGING' },
  { id: '1mmB7bVyPvAE4SPSoQp5EiSQUGxa9XgbMg63U90lexHA', gid: 1860060742, label: 'TELUR PUYUH PENELUR BERNAS' },
  { id: '1v6nnt-6wFp4ha_QfjORBQ5Gh6gOg0p0VxKc-FSbG5qI', gid: 952460545,  label: 'TELUR PUYUH PEDAGING BERNAS' },
  { id: '131xIA9dGUmNc6CrWN-4R7N6t4f-bZQ9jSwx0pdzjMHg', gid: 182238238,  label: 'TELUR BERNAS AYAM KAMPUNG' },
  { id: '1kl6M-eDIJ7lHvX84sijOYdgJKbk4OLhW4Sk5eseLoz0', gid: 906497168,  label: 'ANAK AYAM KAMPUNG' }
];

// ── SUMBER MAKLUMBALAS ──
const FEEDBACK_SOURCES = [
  { id: '1lmgqxrP1XpaUe5vSqxlf-nQ9JwtMXOnuXmJh2HQ2NPY', gid: 1367062394, label: 'Maklumbalas Telur Bernas' },
  { id: '1lmgqxrP1XpaUe5vSqxlf-nQ9JwtMXOnuXmJh2HQ2NPY', gid: 901732472,  label: 'Maklumbalas D.O.Q Puyuh' },
  { id: '1lmgqxrP1XpaUe5vSqxlf-nQ9JwtMXOnuXmJh2HQ2NPY', gid: 374231095,  label: 'Maklumbalas D.O.C Ayam Kampung' }
];

// ── NAMA KOLUM STATUS ──
const COL_STATUS    = 'STATUS TEMPAHAN';
const COL_NOTA      = 'NOTA ADMIN';
const COL_UPDATED   = 'DIKEMASKINI PADA';
const COL_UPDATEDBY = 'DIKEMASKINI OLEH';

const STATUS_LIST = ['Baru','Disahkan','Sedang Diproses','Siap Kutip','Selesai','Dibatalkan','Tak Ambil'];

// ── CREDENTIALS ADMIN ──
const ADMIN_CREDENTIALS = [
  { username: 'Administrator', password: 'Manager1' },
];

// ------------------------------------------------------------------
// ENTRY POINT
// ------------------------------------------------------------------
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Dashboard Tempahan — ITU')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ------------------------------------------------------------------
// LOGIN
// ------------------------------------------------------------------
function checkLogin(username, password) {
  try {
    const found = ADMIN_CREDENTIALS.find(function(c) {
      return c.username === username && c.password === password;
    });
    if (found) return JSON.stringify({ success: true });
    return JSON.stringify({ success: false, error: 'Username atau password salah.' });
  } catch(e) {
    return JSON.stringify({ success: false, error: e.message });
  }
}

// ------------------------------------------------------------------
// HELPER: Cari sheet ikut GID
// ------------------------------------------------------------------
function getSheetByGid(spreadsheet, gid) {
  const sheets = spreadsheet.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() == gid) return sheets[i];
  }
  return spreadsheet.getSheets()[0];
}

// ------------------------------------------------------------------
// HELPER: Cari kolum ikut nama header — return index 0-based
// Kalau tak jumpa, return -1 (TIDAK cipta kolum baru)
// ------------------------------------------------------------------
function findColumnByName(headers, colName) {
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim().toLowerCase() === colName.trim().toLowerCase()) return i;
  }
  return -1;
}

// ------------------------------------------------------------------
// HELPER: Cari atau cipta kolum — return index 0-based
// FIX: lastCol adalah 1-based, index 0-based = lastCol (selepas tambah)
// ------------------------------------------------------------------
function getOrCreateColumn(sheet, colName) {
  const lastCol   = sheet.getLastColumn();
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // Cari dulu
  for (var i = 0; i < headerRow.length; i++) {
    if (String(headerRow[i]).trim().toLowerCase() === colName.toLowerCase()) return i; // 0-based
  }

  // Tak jumpa — cipta kolum baru
  const newColNum = lastCol + 1;          // 1-based column number
  const newColIdx = lastCol;              // 0-based index = lastCol (sebelum tambah = lastCol+1-1)
  sheet.getRange(1, newColNum).setValue(colName);
  sheet.getRange(1, newColNum)
    .setBackground('#135c2d')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  return newColIdx; // 0-based
}

// ------------------------------------------------------------------
// HELPER: Cari index kolum ikut regex pattern — return -1 kalau tak jumpa
// ------------------------------------------------------------------
function findColumnIndex(headers, pattern) {
  for (var i = 0; i < headers.length; i++) {
    if (pattern.test(String(headers[i]).trim())) return i;
  }
  return -1;
}

// ------------------------------------------------------------------
// HELPER: Escape HTML untuk elak XSS dalam email
// ------------------------------------------------------------------
function escapeHtmlSrv(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ------------------------------------------------------------------
// HANTAR EMAIL NOTIFIKASI STATUS KEPADA PEMBELI (BM + EN)
// ------------------------------------------------------------------
function sendStatusEmail(buyerEmail, buyerName, productLabel, status, notes) {
  try {
    if (!buyerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) return;

    var statusMap = {
      'Baru'            : { bm: '🆕 Baru',            en: 'New' },
      'Disahkan'        : { bm: '✅ Disahkan',         en: 'Confirmed' },
      'Sedang Diproses' : { bm: '⚙️ Sedang Diproses', en: 'In Process' },
      'Siap Kutip'      : { bm: '📦 Siap Kutip',       en: 'Ready for Collection' },
      'Selesai'         : { bm: '🎉 Selesai',          en: 'Completed' },
      'Dibatalkan'      : { bm: '❌ Dibatalkan',        en: 'Cancelled' },
      'Tak Ambil'       : { bm: '⚠️ Tak Ambil',        en: 'Uncollected' }
    };

    var statusInfo   = statusMap[status] || { bm: status, en: status };
    var safeName     = escapeHtmlSrv(buyerName || 'Pelanggan');
    var safeProduct  = escapeHtmlSrv(productLabel);
    var safeStatus   = escapeHtmlSrv(statusInfo.bm);
    var safeStatusEn = escapeHtmlSrv(statusInfo.en);
    var safeNotes    = notes ? escapeHtmlSrv(notes) : '';

    var notesRow = safeNotes
      ? '<tr><td style="padding:8px 0 4px;color:#555;font-size:13px;"><strong>Nota Admin / Admin Note:</strong></td></tr>'
        + '<tr><td style="padding:6px 12px;background:#f9fafb;border-left:3px solid #135c2d;font-size:13px;color:#374151;">' + safeNotes + '</td></tr>'
      : '';

    var htmlBody = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>'
      + '<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">'
      + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">'
      + '<tr><td align="center">'
      + '<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">'
      + '<tr><td style="background:#135c2d;padding:24px 32px;">'
      + '<h2 style="margin:0;color:#ffffff;font-size:20px;">Institut Teknologi Unggas (ITU)</h2>'
      + '<p style="margin:4px 0 0;color:#a7f3d0;font-size:13px;">Notifikasi Status Tempahan / Order Status Notification</p>'
      + '</td></tr>'
      + '<tr><td style="padding:28px 32px;">'
      + '<p style="margin:0 0 16px;font-size:15px;color:#111827;">Salam sejahtera, <strong>' + safeName + '</strong>,</p>'
      + '<p style="margin:0 0 16px;font-size:14px;color:#374151;">Status tempahan anda telah dikemaskini. / Your order status has been updated.</p>'
      + '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:20px;">'
      + '<tr><td style="background:#f9fafb;padding:10px 16px;font-size:12px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">PRODUK / PRODUCT</td></tr>'
      + '<tr><td style="padding:12px 16px;font-size:15px;font-weight:bold;color:#111827;">' + safeProduct + '</td></tr>'
      + '<tr><td style="background:#f9fafb;padding:10px 16px;font-size:12px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">STATUS BARU / NEW STATUS</td></tr>'
      + '<tr><td style="padding:12px 16px;font-size:18px;font-weight:bold;color:#135c2d;">' + safeStatus
      +   ' <span style="font-size:13px;color:#6b7280;font-weight:normal;">(' + safeStatusEn + ')</span></td></tr>'
      + '</table>'
      + '<table width="100%" cellpadding="0" cellspacing="0">' + notesRow + '</table>'
      + '<p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Emel ini dijana secara automatik. Sila hubungi kami jika ada sebarang pertanyaan.<br>'
      + 'This is an automated email. Please contact us if you have any questions.</p>'
      + '</td></tr>'
      + '<tr><td style="background:#135c2d;padding:16px 32px;text-align:center;">'
      + '<p style="margin:0;color:#a7f3d0;font-size:12px;">© Institut Teknologi Unggas (ITU)</p>'
      + '</td></tr>'
      + '</table></td></tr></table></body></html>';

    MailApp.sendEmail({
      to      : buyerEmail,
      subject : '[ITU] Status Tempahan: ' + statusInfo.bm + ' — ' + productLabel,
      htmlBody: htmlBody
    });
  } catch(e) {
    Logger.log('[sendStatusEmail ERROR] ' + e.message);
  }
}

// ------------------------------------------------------------------
// AMBIL SEMUA DATA TEMPAHAN
// FIX UTAMA: Guna header name untuk map nilai, bukan index rawak
// ------------------------------------------------------------------
function getAllData() {
  const allRows = [];

  // Kolum status yang kita urus sendiri — asingkan dari data biasa
  const STATUS_COL_PATTERNS = [
    COL_STATUS.toLowerCase(),
    COL_NOTA.toLowerCase(),
    COL_UPDATED.toLowerCase(),
    COL_UPDATEDBY.toLowerCase(),
    /^status(\s*tempahan)?$/,
    /^nota(\s*admin)?$/,
    /^dikemaskini(\s*pada)?$/,
    /^dikemaskini(\s*oleh)?$/
  ];

  function isStatusCol(headerName) {
    var h = String(headerName).trim().toLowerCase();
    return STATUS_COL_PATTERNS.some(function(p) {
      return p instanceof RegExp ? p.test(h) : h === p;
    });
  }

  for (var s = 0; s < SOURCES.length; s++) {
    var source = SOURCES[s];
    try {
      var ss    = SpreadsheetApp.openById(source.id);
      var sheet = getSheetByGid(ss, source.gid);
      var data  = sheet.getDataRange().getValues();

      if (data.length < 2) continue;

      // Header row — trim semua
      var headers = data[0].map(function(h) { return String(h).trim(); });

      // Cari index kolum status (by name, bukan assumption)
      var iStatus    = findColumnByName(headers, COL_STATUS);
      // Cuba variasi kalau tak jumpa
      if (iStatus < 0) iStatus = headers.findIndex(function(h) { return /^status(\s*tempahan)?$/i.test(h); });

      var iNota      = findColumnByName(headers, COL_NOTA);
      if (iNota < 0) iNota = headers.findIndex(function(h) { return /^nota(\s*admin)?$/i.test(h); });

      var iUpdated   = findColumnByName(headers, COL_UPDATED);
      if (iUpdated < 0) iUpdated = headers.findIndex(function(h) { return /^dikemaskini(\s*pada)?$/i.test(h); });

      var iUpdatedBy = findColumnByName(headers, COL_UPDATEDBY);
      if (iUpdatedBy < 0) iUpdatedBy = headers.findIndex(function(h) { return /^dikemaskini(\s*oleh)?$/i.test(h); });

      for (var i = 1; i < data.length; i++) {
        var row = data[i];

        // Skip baris kosong — semak kolum pertama yang bukan status col
        var firstDataCol = headers.findIndex(function(h, idx) { return h !== '' && !isStatusCol(h); });
        var firstVal = firstDataCol >= 0 ? row[firstDataCol] : row[0];
        if (!firstVal || String(firstVal).trim() === '') continue;

        var obj = {
          _id        : source.id + '__' + source.gid + '__' + (i + 1),
          _source    : source.label,
          _sourceId  : source.id,
          _sourceGid : source.gid,
          _rowIndex  : i + 1,
          _sheetName : sheet.getName()
        };

        // ── FIX UTAMA: Map setiap nilai ikut NAMA header, bukan index ──
        // Asingkan kolum status dari kolum data biasa
        headers.forEach(function(h, idx) {
          // Skip header kosong
          if (!h || h === '') return;
          // Skip kolum status — kita handle berasingan
          if (isStatusCol(h)) return;

          var val = row[idx];
          if (val instanceof Date) {
            val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
          }
          // Kalau header sama ada duplicate, tambah suffix
          var key = h;
          if (obj.hasOwnProperty(key) && !key.startsWith('_')) {
            key = h + '_' + idx;
          }
          obj[key] = (val !== undefined && val !== null) ? val : '';
        });

        // Assign nilai status secara berasingan
        obj._status    = (iStatus    >= 0 && row[iStatus]    != null && String(row[iStatus]).trim()    !== '') ? String(row[iStatus])    : 'Baru';
        obj._notes     = (iNota      >= 0 && row[iNota]      != null && String(row[iNota]).trim()      !== '') ? String(row[iNota])      : '';
        obj._updatedAt = (iUpdated   >= 0 && row[iUpdated]   != null && String(row[iUpdated]).trim()   !== '') ? String(row[iUpdated])   : '';
        obj._updatedBy = (iUpdatedBy >= 0 && row[iUpdatedBy] != null && String(row[iUpdatedBy]).trim() !== '') ? String(row[iUpdatedBy]) : '';

        allRows.push(obj);
      }
    } catch(e) {
      Logger.log('[ERROR] ' + source.label + ': ' + e.message);
    }
  }

  return JSON.stringify(allRows);
}

// ------------------------------------------------------------------
// AMBIL SEMUA MAKLUMBALAS
// FIX: Sama — guna header name mapping
// ------------------------------------------------------------------
function getAllFeedback() {
  const allRows = [];

  for (var s = 0; s < FEEDBACK_SOURCES.length; s++) {
    var source = FEEDBACK_SOURCES[s];
    try {
      var ss    = SpreadsheetApp.openById(source.id);
      var sheet = getSheetByGid(ss, source.gid);
      var data  = sheet.getDataRange().getValues();

      if (data.length < 2) continue;

      var headers = data[0].map(function(h) { return String(h).trim(); });

      for (var i = 1; i < data.length; i++) {
        var row = data[i];

        // Skip baris kosong
        if (!row[0] || String(row[0]).trim() === '') continue;

        var obj = {
          _id     : source.id + '__' + source.gid + '__' + (i + 1),
          _source : source.label,
          _rowIdx : i + 1
        };

        // Map ikut nama header
        headers.forEach(function(h, idx) {
          if (!h || h === '') return;
          var val = row[idx];
          if (val instanceof Date) {
            val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
          }
          var key = h;
          if (obj.hasOwnProperty(key) && !key.startsWith('_')) {
            key = h + '_' + idx;
          }
          obj[key] = (val !== undefined && val !== null) ? val : '';
        });

        allRows.push(obj);
      }
    } catch(e) {
      Logger.log('[ERROR Feedback] ' + source.label + ': ' + e.message);
    }
  }

  return JSON.stringify(allRows);
}

// ------------------------------------------------------------------
// KEMASKINI STATUS TEMPAHAN
// FIX: getOrCreateColumn dah fix — guna return value dengan betul
// ------------------------------------------------------------------
function updateStatus(id, status, notes, skipEmail) {
  try {
    if (STATUS_LIST.indexOf(status) < 0) {
      return JSON.stringify({ success: false, error: 'Status tidak sah.' });
    }

    var parts = id.split('__');
    if (parts.length < 3) return JSON.stringify({ success: false, error: 'ID tidak sah.' });

    var sourceId  = parts[0];
    var gid       = parseInt(parts[1]);
    var rowIndex  = parseInt(parts[2]);

    var ss    = SpreadsheetApp.openById(sourceId);
    var sheet = getSheetByGid(ss, gid);

    // getOrCreateColumn returns 0-based index
    // sheet.getRange uses 1-based column — so add 1
    var iStatus    = getOrCreateColumn(sheet, COL_STATUS)    + 1;
    var iNota      = getOrCreateColumn(sheet, COL_NOTA)      + 1;
    var iUpdated   = getOrCreateColumn(sheet, COL_UPDATED)   + 1;
    var iUpdatedBy = getOrCreateColumn(sheet, COL_UPDATEDBY) + 1;

    var now  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    var user = Session.getActiveUser().getEmail() || 'Admin';

    sheet.getRange(rowIndex, iStatus).setValue(status);
    sheet.getRange(rowIndex, iNota).setValue(notes || '');
    sheet.getRange(rowIndex, iUpdated).setValue(now);
    sheet.getRange(rowIndex, iUpdatedBy).setValue(user);

    var statusColors = {
      'Baru'            : { bg: '#dbeafe', font: '#1e40af' },
      'Disahkan'        : { bg: '#d1fae5', font: '#065f46' },
      'Sedang Diproses' : { bg: '#fef3c7', font: '#92400e' },
      'Siap Kutip'      : { bg: '#ede9fe', font: '#5b21b6' },
      'Selesai'         : { bg: '#bbf7d0', font: '#14532d' },
      'Dibatalkan'      : { bg: '#fee2e2', font: '#991b1b' },
      'Tak Ambil'       : { bg: '#fef9c3', font: '#854d0e' }
    };
    var color = statusColors[status];
    if (color) {
      sheet.getRange(rowIndex, iStatus)
        .setBackground(color.bg)
        .setFontColor(color.font)
        .setFontWeight('bold');
    }

    // EMAIL NOTIFICATION — skip kalau bulk update atau explicitly disabled
    if (skipEmail !== true) {
      try {
        var refreshedData  = sheet.getDataRange().getValues();
        var refreshHeaders = refreshedData[0].map(function(h) { return String(h).trim(); });
        var refreshRow     = refreshedData[rowIndex - 1];

        var iEmail = findColumnIndex(refreshHeaders, /email/i);
        var iName  = findColumnIndex(refreshHeaders, /nama\s*pembeli|nama\s*penuh|^nama$/i);

        var buyerEmail = iEmail >= 0 ? String(refreshRow[iEmail] || '').trim() : '';
        var buyerName  = iName  >= 0 ? String(refreshRow[iName]  || '').trim() : '';

        var productLabel = sheet.getName();
        for (var si = 0; si < SOURCES.length; si++) {
          if (SOURCES[si].id === sourceId && SOURCES[si].gid == gid) {
            productLabel = SOURCES[si].label;
            break;
          }
        }

        if (buyerEmail) {
          sendStatusEmail(buyerEmail, buyerName, productLabel, status, notes);
        }
      } catch(emailErr) {
        Logger.log('[updateStatus email ERROR] ' + emailErr.message);
      }
    }

    return JSON.stringify({ success: true });
  } catch(e) {
    return JSON.stringify({ success: false, error: e.message });
  }
}

// ------------------------------------------------------------------
// KEMASKINI STATUS BATCH
// ------------------------------------------------------------------
function updateStatusBatch(ids, status, notes) {
  try {
    if (STATUS_LIST.indexOf(status) < 0) {
      return JSON.stringify({ success: false, error: 'Status tidak sah.' });
    }

    var count  = 0;
    var errors = [];

    ids.forEach(function(id) {
      var res = JSON.parse(updateStatus(id, status, notes, true));
      if (res.success) count++;
      else errors.push(res.error);
    });

    return JSON.stringify({ success: true, count: count, errors: errors });
  } catch(e) {
    return JSON.stringify({ success: false, error: e.message });
  }
}

// ------------------------------------------------------------------
// EKSPORT CSV
// ------------------------------------------------------------------
function exportToCsv(filterParams) {
  var allData = JSON.parse(getAllData());
  var filtered = allData;

  if (filterParams) {
    var f = typeof filterParams === 'string' ? JSON.parse(filterParams) : filterParams;

    if (f.source && f.source !== 'all') filtered = filtered.filter(function(r) { return r._source === f.source; });
    if (f.status && f.status !== 'all') filtered = filtered.filter(function(r) { return r._status === f.status; });

    if (f.month && f.month !== 'all') {
      filtered = filtered.filter(function(r) {
        var tsKey = Object.keys(r).find(function(k) { return !k.startsWith('_') && /timestamp|tarikh|masa|date/i.test(k); });
        if (!tsKey || !r[tsKey]) return false;
        var parts = String(r[tsKey]).split('/');
        return parts.length >= 2 && parts[1] === f.month;
      });
    }
    if (f.year && f.year !== 'all') {
      filtered = filtered.filter(function(r) {
        var tsKey = Object.keys(r).find(function(k) { return !k.startsWith('_') && /timestamp|tarikh|masa|date/i.test(k); });
        if (!tsKey || !r[tsKey]) return false;
        var parts = String(r[tsKey]).split('/');
        return parts.length >= 3 && parts[2].startsWith(f.year);
      });
    }
  }

  if (filtered.length === 0) return '';

  var headerSet = new Set();
  filtered.forEach(function(row) {
    Object.keys(row).forEach(function(k) { if (!k.startsWith('_')) headerSet.add(k); });
  });

  var contentHeaders = [...headerSet];
  var extraCols      = ['_source','_status','_notes','_updatedAt','_updatedBy'];
  var displayHeaders = ['Sumber Produk','Status Tempahan','Nota Admin','Dikemaskini Pada','Dikemaskini Oleh'];
  var allHeaders     = contentHeaders.concat(displayHeaders);

  var rows = [allHeaders.join(',')];
  filtered.forEach(function(row) {
    var vals = contentHeaders.map(function(h) {
      return '"' + String(row[h] !== undefined ? row[h] : '').replace(/"/g, '""') + '"';
    }).concat(extraCols.map(function(k) {
      return '"' + String(row[k] || '').replace(/"/g, '""') + '"';
    }));
    rows.push(vals.join(','));
  });

  return rows.join('\n');
}