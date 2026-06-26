# Panduan Deploy — Dashboard Tempahan ITU

---

## A. Kemaskini GAS Backend (`Code.js`)

> **WAJIB buat New Version setiap kali edit `Code.js`** — tanpanya, deployment lama kekal guna kod lama walaupun selepas `clasp push`.

### Langkah-langkah:

1. Edit `Code.js` dalam GAS editor (atau local, kemudian sync manual)
2. Buka GAS project: https://script.google.com → buka project
3. Klik **Deploy → Manage deployments**
4. Klik ikon edit ✏️ pada deployment semasa (bukan cipta deployment baru)
5. Pada dropdown "Version": pilih **New version**
6. Klik **Deploy**

URL `/exec` kekal sama selepas deploy — tiada perubahan diperlukan pada `EXEC_URL` dalam `index.html`.

### Script Properties wajib

Dalam GAS editor, pastikan **Project Settings → Script Properties** mengandungi:

| Property | Kegunaan |
|----------|----------|
| `ADMIN_USERNAME` | Username login admin |
| `ADMIN_PASSWORD` | Password login admin |
| `ADMIN_API_KEY` | API key yang disemak oleh backend untuk semua action |

`ADMIN_API_KEY` mesti sepadan dengan `API_KEY` dalam `index.html`. Jika tidak sepadan, semua API action akan ditolak dengan error akses.

### Bila wajib New Version:
- Selepas sebarang edit pada `Code.js`
- Selepas tambah/ubah fungsi yang dipanggil oleh `callApi()`
- Selepas tambah scope GAS baharu (contoh: MailApp, DriveApp)
- Selepas ubah validasi backend seperti `ADMIN_API_KEY`
- Selepas ubah status rasmi atau normalisasi legacy status

Perubahan cleanup status rasmi mengubah `Code.js`, jadi GAS deployment mesti dikemaskini menggunakan **New version** sebelum backend production membaca normalisasi terkini.

### Jika tambah scope baharu:
Scope baharu memerlukan authorization sebelum boleh deploy:
1. Dalam GAS editor, jalankan mana-mana fungsi yang guna scope baru (contoh: jalankan `sendStatusEmail`)
2. GAS akan minta "Review Permissions" — klik dan benarkan dengan akaun `tempahanitu@gmail.com`
3. Baru buat New Version dan Deploy

---

## B. Kemaskini GitHub Pages (`index.html`, `sw.js`, `manifest.json`)

Fail-fail ini diserve terus oleh GitHub Pages dari branch `main`. Tiada build step diperlukan.

### Langkah-langkah:

```bash
# Stage fail yang diubah sahaja (jangan guna git add .)
git add index.html
# atau
git add sw.js manifest.json

git commit -m "keterangan perubahan"
git push origin main
```

GitHub Pages auto-update dalam masa ~1-2 minit selepas push.

### Nota frontend semasa

- `index.html` menghantar `API_KEY` bersama setiap request GAS JSONP
- Service Worker cache semasa: `stpu-admin-cache-v2`
- `sw.js` menggunakan network-first untuk `script.google.com` dan `script.googleusercontent.com`
- Jika offline dan request JSONP mempunyai parameter `callback`, fallback dibalas sebagai `callback(errorObject)`
- `manifest.json` menggunakan orientation `"any"`
- Status rasmi tempahan: `Baru`, `Disahkan`, `Sedang Diproses`, `Selesai`, `Tidak Ambil`, `Dibatalkan`
- Status lama `Siap Kutip` dinormalisasi kepada `Sedang Diproses`; `Tak Ambil` dinormalisasi kepada `Tidak Ambil`
- Wording kutip/pickup lama telah dibuang dari UI dan mesej Contact Assist
- Dashboard stat **Selesai** kini mengira `Selesai` sahaja
- Contact Assist **"📞 Hubungi Pembeli"** berada dalam modal tempahan dan hanya frontend-only:
  - WhatsApp membuka `wa.me` dengan mesej siap diisi
  - Email membuka `mailto:` dengan subject/body siap diisi
  - Copy Mesej salin mesej ke clipboard
  - Tiada auto-send
  - Mesej ikut status semasa yang dipilih dalam modal: `Selesai` = tempahan telah selesai, `Tidak Ambil` = tempahan direkodkan sebagai tidak diambil/dituntut, `Dibatalkan` = tempahan telah dibatalkan, status lain = status tempahan telah dikemaskini

Perubahan Contact Assist tidak memerlukan deployment GAS kerana tiada perubahan backend.

### Jika `EXEC_URL` perlu ditukar:
Situasi ini berlaku hanya jika GAS deployment dipadam dan deployment baru dicipta (URL berubah). Kemaskini dalam `index.html`:

```javascript
const EXEC_URL = 'https://script.google.com/macros/s/SCRIPT_ID_BARU/exec';
```

Kemudian commit dan push seperti biasa.

---

## C. Remote Git

Repo ini push ke `STPUitu/admin`:

```bash
git remote set-url origin https://github.com/STPUitu/admin.git
git push origin main
```

---

## D. Nota Penting

- `Index.html` (I besar) hanya wujud dalam GAS project — **jangan commit ke GitHub repo**
- `index.html` (i kecil) hanya dalam GitHub repo — **jangan sync ke GAS project**
- Kedua-dua fail berbeza sepenuhnya — jangan campur
- Selepas push ke GitHub, tunggu ~2 minit sebelum test di browser (GitHub Pages ada delay)
- Jika Service Worker cache lama masih aktif di browser, buka DevTools → Application → Storage → "Clear site data" untuk force refresh
