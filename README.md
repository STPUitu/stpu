# Dashboard Tempahan — Institut Teknologi Unggas (ITU)

Dashboard admin untuk menguruskan tempahan produk unggas bagi Unit Penetasan, ITU.

**URL**: https://stpuitu.github.io/admin/

---

## Overview

Sistem ini terdiri dari dua bahagian:

1. **GitHub Pages** (`stpuitu.github.io/admin/`) — UI penuh + PWA shell yang boleh dipasang di skrin utama
2. **Google Apps Script** — pure JSON API backend yang membaca/menulis data dari Google Sheets

Pengguna admin membuka GitHub Pages, login, dan dashboard berkomunikasi dengan GAS backend melalui JSONP untuk ambil/kemaskini data.

> **Arkitektur ini mengikuti model yang sama dengan `stpuitu/tempah`** — UI sepenuhnya di GitHub Pages, GAS hanya jadi API.

---

## Arkitektur

```
GitHub Pages (stpuitu.github.io/admin/)
├── index.html    ← UI penuh dashboard + PWA shell (i kecil)
├── sw.js         ← Service Worker
├── manifest.json ← PWA manifest
├── icon-192.png
└── icon-512.png

GAS Project (tempahanitu@gmail.com)
└── Code.gs       ← Pure JSON API: doGet(e) + doPost(e) routing
```

Apabila `index.html` di GitHub Pages perlu data, ia memanggil GAS Web App URL dengan parameter `?action=...&callback=...` menggunakan teknik **JSONP** (cross-origin safe).
Setiap panggilan JSONP juga menghantar `apiKey` supaya backend boleh sahkan akses melalui Script Properties.

---

## Fail Utama

### `index.html` (i kecil) — GitHub Pages
UI penuh dashboard. Mengandungi:
- Keseluruhan UI (sidebar, hamburger menu, semua page)
- `GAS_URL` — URL GAS `/exec` deployment
- `API_KEY` — API key admin yang dihantar bersama setiap request GAS JSONP
- `gasCall()` — helper JSONP untuk semua panggilan API
- `gasGet()` / `gasPost()` — wrapper (kedua-duanya guna JSONP GET internally)
- Pendaftaran `sw.js` untuk keupayaan PWA
- Contact Assist dalam modal tempahan: WhatsApp, Email, dan Copy Mesej berdasarkan status semasa yang dipilih

### `Index.html` (I besar) — GAS Project
Template lama yang diserve oleh `doGet()` apabila tiada parameter `?action`. Kini **tidak digunakan lagi** — UI sudah berpindah ke GitHub Pages. Kekalkan sebagai backup sahaja.

### `Code.gs` — GAS Project
Backend pure API. `doGet(e)` melakukan routing:
- Ada `?action` → sahkan `ADMIN_API_KEY`, jalankan fungsi, balas JSON (dengan JSONP `callback` jika ada)
- Tiada `?action` → serve `Index.html` (legacy fallback)

Fungsi API yang disokong: `getAllData`, `getAllFeedback`, `checkLogin`, `exportToCsv`, `updateStatus`, `updateStatusBatch`.

**GAS deployment mesti di-set:**
- Execute as: **Me (tempahanitu@gmail.com)**
- Who has access: **Anyone** ← bukan "Anyone with Google account"

### `sw.js` — GitHub Pages
Service Worker. Strategi cache:
- Cache name: `stpu-admin-cache-v2`
- Request ke `script.google.com` dan `script.googleusercontent.com` → **network-first**, fallback JSON error bila offline
- Jika request offline ada parameter `callback`, fallback dibalas sebagai JSONP sah: `callback(errorObject)`
- Fail shell (HTML/CSS/JS/icon) → **cache-first**

### `manifest.json` — GitHub Pages
PWA manifest. `name: "STPU Admin — Dashboard Tempahan ITU"`, scope `./`, orientation `"any"`.

---

## Rule: `index.html` (i kecil) vs `Index.html` (I besar)

| | `index.html` | `Index.html` |
|--|--------------|--------------|
| **Huruf** | i kecil | I besar |
| **Lokasi** | GitHub Pages repo | GAS project |
| **Fungsi** | UI penuh + PWA shell | Legacy GAS template (tidak aktif) |
| **Edit bila** | Ubah UI, API call, layout | — |
| **Deploy ke** | `git push origin main` | — |

GitHub **case-sensitive** — kedua-dua fail berbeza. Jangan keliru semasa `git add`.

---

## Cara Deploy

### Kemaskini GitHub Pages (`index.html`, `sw.js`, `manifest.json`)

```bash
git add index.html sw.js manifest.json
git commit -m "keterangan perubahan"
git push https://STPUitu@github.com/STPUitu/admin.git main
```

GitHub Pages auto-update dalam masa ~1-2 minit.

### Kemaskini GAS Backend (`Code.gs`)

**WAJIB buat New Version setiap kali edit `Code.gs`** — tanpanya, URL lama kekal guna kod lama.

1. Edit `Code.gs` dalam GAS editor
2. Klik **Deploy → Manage deployments**
3. Klik ikon edit ✏️ pada deployment aktif (`STPU-FixPWA`)
4. Tukar "Version" kepada **New version**
5. Klik **Deploy** — URL `/exec` kekal sama

---

## Cara Install PWA

### Desktop (Chrome / Edge)
1. Buka **https://stpuitu.github.io/admin/**
2. Klik ikon install (⊕) di address bar → "Install"
3. Dashboard buka dalam tetingkap standalone

### Android (Chrome)
1. Buka **https://stpuitu.github.io/admin/**
2. Notifikasi "App installed" akan muncul automatik, atau
3. Menu (⋮) → "Add to Home screen"

### iPhone / iPad (Safari)
1. Buka **https://stpuitu.github.io/admin/** dalam Safari
2. Butang Share (□↑) → "Add to Home Screen"

### iPad (Chrome)
> **Nota**: iPad Chrome memerlukan GAS deployment di-set **Who has access: Anyone** (bukan "Anyone with Google account"). Jika masih gagal, guna Safari pada iPad.

---

## Sumber Data

Dashboard membaca dari 6 Google Sheet tempahan dan 1 Google Sheet maklumbalas (3 tab). Rujuk array `SOURCES` dan `FEEDBACK_SOURCES` dalam `Code.gs`.

**Aliran status tempahan:**
`Baru` → `Disahkan` → `Sedang Diproses` → `Siap Kutip` → `Selesai` / `Dibatalkan` / `Tak Ambil`

Email notifikasi dihantar ke pembeli secara automatik (BM + EN) setiap kali status dikemaskini secara individu. Bulk update tidak hantar email.

### Hubungi Pembeli / Contact Assist

Dalam modal tempahan, seksyen **"📞 Hubungi Pembeli"** membantu admin menyediakan mesej kepada pembeli:
- **📲 WhatsApp** — buka WhatsApp dengan mesej siap diisi
- **📧 Email** — buka email client dengan subject dan body siap diisi
- **📋 Copy Mesej** — salin mesej ke clipboard

Mesej dijana dalam Bahasa Malaysia mengikut status semasa yang dipilih dalam modal. Status `Siap Kutip` memasukkan arahan kutipan, status `Dibatalkan` meminta pembeli hubungi ITU jika ada pertanyaan, dan status lain memaklumkan bahawa status tempahan telah dikemaskini.

Contact Assist adalah **frontend-only**. Ia tidak auto-send apa-apa, tidak menulis ke Sheet, dan tidak memerlukan deployment GAS.

---

## Maklumat Projek

- **GAS Akaun**: tempahanitu@gmail.com
- **GitHub Repo**: https://github.com/STPUitu/admin
- **Credentials**: disimpan dalam GAS Script Properties (bukan hardcoded)
- **Required Script Properties**: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_API_KEY`
