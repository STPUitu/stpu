# Spesifikasi Teknikal — Dashboard Tempahan ITU

---

## 1. JSONP API Client (`gasCall()`)

`index.html` di GitHub Pages menggunakan helper `gasCall(params)` untuk semua komunikasi dengan GAS backend.

```javascript
var allParams = Object.assign({}, params, {
  apiKey: API_KEY,
  callback: cbName
});
```

`API_KEY` dihantar dengan setiap request JSONP. Backend menyemak nilai ini terhadap Script Property `ADMIN_API_KEY` sebelum menjalankan sebarang API action.

---

## 2. JSONP — Penyelesaian CORS

### Masalah
GAS web app (`/exec` URL) mengembalikan CORS header yang inconsistent — kadang-kadang benarkan cross-origin, kadang-kadang tidak. `fetch()` dari domain GitHub Pages akan gagal secara rawak.

### Penyelesaian
Untuk semua GET actions, hantar request melalui `<script src="">` tag. Browser tidak enforce CORS untuk permintaan skrip.

### Cara ia berfungsi

**Client (`index.html`) — buat request:**
```javascript
var cbName = 'jsonp_cb_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
var script = document.createElement('script');

// Daftar callback global sementara
window[cbName] = function(data) {
  clearTimeout(timeoutId);
  cleanup(); // buang callback dan <script> tag
  resolve(data);
};

// Request dengan ?action, ?apiKey dan ?callback
script.src = GAS_URL + '?action=getAllData&apiKey=' + API_KEY + '&callback=' + cbName;
document.head.appendChild(script);
```

**Server (`Code.js`) — balas dalam format JSONP:**
```javascript
function doGet(e) {
  var action   = e.parameter.action;
  var callback = e.parameter.callback || '';

  // validateApiKey(e.parameter) mesti lulus sebelum action dijalankan

  // ... jalankan fungsi, dapat result sebagai JSON string ...

  var output = callback ? callback + '(' + result + ');' : result;
  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
```

Browser jalankan skrip yang diterima → callback global dipanggil dengan data → Promise resolve.

### GET actions yang guna JSONP:
| Action | Keterangan |
|--------|------------|
| `getAllData` | Ambil semua rekod tempahan dari 6 Sheet |
| `getAllFeedback` | Ambil semua maklumbalas dari 3 tab |
| `checkLogin` | Semak username/password (dihantar sebagai query param) |
| `exportCsv` | Ambil data CSV (filter dihantar sebagai JSON ter-encode) |

### Timeout dan cleanup:
- Timeout 30 saat — jika GAS tidak balas, Promise di-reject
- Selepas callback dipanggil (atau timeout/error), callback global dibuang (`delete window[cbName]`) dan `<script>` tag dikeluarkan dari DOM

---

## 3. `doGet(e)` Routing dalam `Code.js`

```
Incoming GET request ke EXEC_URL
│
├── Ada ?action parameter
│   ├── Semak apiKey lawan Script Property ADMIN_API_KEY
│   ├── Jika tidak sah: balas error JSON / callback(errorObject)
│   ├── Jika sah: jalankan fungsi API berkaitan
│   └── Balas: callback(JSON_data);   ← format JSONP
│
└── Tiada ?action parameter
    └── Serve Index.html              ← dashboard GAS biasa
```

Semua GET action sokong parameter `?callback=` untuk JSONP. Jika `?callback=` tiada, balas JSON sahaja (untuk debug/testing manual).

---

## 4. Service Worker (`sw.js`)

**CACHE_NAME**: `stpu-admin-cache-v2`

Nama cache unik dipilih untuk elak clash dengan Service Worker repo lain (contoh: repo `tempah` mungkin guna nama generic). Service Worker hanya aktif dalam scope `/admin/`.

### Strategi fetch:

| Request URL | Strategi | Sebab |
|-------------|----------|-------|
| `script.google.com` | Network-first | Data mestilah terkini |
| `script.googleusercontent.com` | Network-first | Sama — GAS serving URL |
| Semua lain (shell files) | Cache-first, fallback network | Sokong offline access |

Jika network gagal untuk GAS request semasa offline, Service Worker balas dengan:
```json
{ "success": false, "error": "Tiada sambungan internet." }
```

Jika request offline mengandungi parameter `callback`, Service Worker membalas dalam format JSONP yang valid:
```javascript
callback({ "success": false, "error": "Tiada sambungan internet." });
```

### Install event:
Cache awal (pre-cache) fail-fail shell:
- `./`
- `./index.html`
- `./manifest.json`
- `./icon-192.png`
- `./icon-512.png`

### Activate event:
Buang semua cache lama (nama berbeza dari `stpu-admin-cache-v2`) dan `claim()` semua client serta-merta tanpa perlu reload.

---

## 5. ID Rekod (`_id`)

Setiap rekod tempahan mempunyai ID unik yang dibina oleh `getAllData()`:

```
{spreadsheet_id}__{sheet_gid}__{row_number}
```

Contoh: `1eiHYWxtkdOrf9FU__970969483__5`

ID ini digunakan untuk operasi `updateStatus` dan `updateStatusBatch` — backend parse ID untuk locate spreadsheet, sheet (by GID), dan row yang betul.

---

## 6. Header-Based Column Mapping

`getAllData()` dan `getAllFeedback()` dalam `Code.js` tidak bergantung pada index kolum (posisi tetap). Sebaliknya, nilai dimap mengikut **nama header** (case-insensitive, trim whitespace).

Ini membolehkan kolum dalam Google Sheet disusun semula tanpa merosakkan dashboard.

Kolum yang diuruskan khas (status, nota, audit) diasingkan dari kolum data biasa:

| Kolum dalam Sheet | Disimpan sebagai |
|-------------------|------------------|
| `STATUS TEMPAHAN` | `_status` |
| `NOTA ADMIN` | `_notes` |
| `DIKEMASKINI PADA` | `_updatedAt` |
| `DIKEMASKINI OLEH` | `_updatedBy` |

Kolum-kolum ini dicipta secara automatik dalam Sheet jika belum wujud (`getOrCreateColumn()`).

---

## 7. PWA Manifest

```json
{
  "name": "Dashboard Tempahan STPU ITU",
  "short_name": "STPU ITU",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "orientation": "any",
  "theme_color": "#135c2d",
  "background_color": "#f0f4f1"
}
```

`scope: "./"` bermakna PWA hanya aktif dalam path `/admin/` — tidak campur dengan PWA lain di domain yang sama.

---

## 8. Session & Authentication

- Login disimpan dalam `sessionStorage` (bukan `localStorage`) — hilang automatik bila tab/browser ditutup
- Storage key: `itu_dashboard_auth` = `'ok'`
- `checkLogin()` dalam `Code.js` semak `ADMIN_USERNAME` dan `ADMIN_PASSWORD` dari GAS Script Properties
- Semua API actions memerlukan `apiKey` yang sepadan dengan Script Property `ADMIN_API_KEY`
- Required Script Properties: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_API_KEY`
- Email notifikasi (bila kemaskini status individu) hanya dihantar jika kolum `Email Address` wujud dalam Sheet sumber dan mengandungi nilai yang sah

---

## 9. Responsive Layout

Dashboard menggunakan breakpoint `max-width: 860px`:
- Desktop: sidebar tetap di kiri (220px), kandungan utama ada `margin-left: 220px`
- Mobile: sidebar tersembunyi (`transform: translateX(-100%)`), hamburger button (☰) muncul di topbar untuk toggle sidebar dengan overlay

---

## 10. GSAP Animations

Dashboard menggunakan GSAP 3.12.5 (CDN) untuk animasi:

- **Stats counter**: nombor animate 0 → nilai sebenar (1.2s, `power2.out`)
- **Stat cards stagger**: fade+scale masuk satu-satu (0.07s delay antara kad)
- **Page transition**: fade+slide (`y:12 → 0`, 0.28s) bila tukar tab
- **Modal**: slide up + scale dengan `back.out` bounce
- **Toast**: bounce masuk dari bawah, slide keluar elegan
- **Sidebar mobile**: CSS transition handle slide, overlay guna `opacity` + `pointer-events`

---

## 11. Contact Assist dalam Modal Tempahan

Modal tempahan mempunyai seksyen **"📞 Hubungi Pembeli"** yang membantu admin menyediakan mesej kepada pembeli tanpa menghantar apa-apa secara automatik.

Butang yang tersedia:
| Button | Fungsi |
|--------|--------|
| `📲 WhatsApp` | Normalise nombor telefon Malaysia dan buka `https://wa.me/<phone>?text=<message>` |
| `📧 Email` | Buka `mailto:<email>?subject=...&body=...` |
| `📋 Copy Mesej` | Salin mesej ke clipboard |

Mesej dijana dalam Bahasa Malaysia berdasarkan status semasa yang dipilih dalam modal:
- `Siap Kutip` → tambah arahan kutipan
- `Dibatalkan` → minta pembeli hubungi ITU jika ada pertanyaan
- Status lain → maklumkan status tempahan telah dikemaskini

Feature ini frontend-only dalam `index.html`. Ia tidak memerlukan perubahan GAS, tidak menulis ke Google Sheets, dan tidak auto-send WhatsApp/email.

---

## 12. Semua Actions Guna JSONP

**SEMUA actions — GET dan write — guna JSONP.** Tiada `fetch()` POST langsung dari GitHub Pages context.

| Action | Jenis | Cara hantar params |
|--------|-------|--------------------|
| `getAllData` | Read | — |
| `getAllFeedback` | Read | — |
| `checkLogin` | Read | `?username=&password=` |
| `exportCsv` | Read | `?filter=<JSON encoded>` |
| `updateStatus` | Write | `?id=&status=&notes=` |
| `updateStatusBatch` | Write | `?ids=<JSON encoded>&status=&notes=` |

**Sebab**: GAS CORS inconsistent untuk `fetch()` dari domain lain, walaupun untuk GET request. JSONP via `<script>` tag tidak tertakluk kepada CORS sepenuhnya, menjadikannya lebih reliable untuk semua jenis request dari GitHub Pages.

Semua request turut membawa `apiKey=<API_KEY>` dan backend menolak request jika key tiada atau tidak sepadan dengan `ADMIN_API_KEY`.
