**ScrapKedinasan**

- **Deskripsi**: Proyek kecil untuk mengambil konten soal dari halaman pembahasan Tryout Kedinasan pada platform MasukKampus menggunakan Puppeteer dan mengekstrak HTML menjadi JSON menggunakan JSDOM.

- **Fitur utama**:
  - Akses halaman terproteksi dengan cookie yang diset secara programatik.
  - Simpan HTML hasil ekstraksi ke `soal_kedinasan.json`.
  - Parser dasar untuk mengekstrak nomor soal, pertanyaan, opsi jawaban, jawaban benar, dan pembahasan.

**Prasyarat**

- Node.js (disarankan LTS terbaru, minimal v14+)
- npm atau yarn
- Koneksi internet (untuk mengakses halaman target dan mengunduh Chromium bila perlu)

**Instalasi**

- Jika repository sudah punya `package.json`, jalankan:

```powershell
npm install
```

Catatan: Puppeteer akan mengunduh Chromium. Jika Anda ingin menggunakan Chrome/Chromium yang sudah terpasang, atur opsi `puppeteer.launch({ executablePath: 'PATH_TO_CHROME' })` di `screenshot.js`.

**Tata Cara Penggunaan**

1. Buka file `scrap.js`.
   - Atur variabel `targetUrl` ke URL halaman pembahasan yang ingin Anda scrap.
   - Atur `cookiesToSet` jika halaman memerlukan cookie/login untuk mengakses konten.

2. Jalankan script:

```powershell
node .\scrap.js
```

- Output:
  - `soal_kedinasan.json` berisi array soal yang diekstrak.

**Penjelasan singkat isi `screenshot.js`**

- `cookiesToSet`: array cookie yang akan diset ke `page` sebelum navigasi. Gunakan `url` atau pastikan `domain` cocok dengan `targetUrl`.
- `page.setCookie(...)`: dipakai agar cookie terpasang sebelum request dilakukan.
- `page.$eval('#soal-tab', el => el.innerHTML)`: mengambil potongan HTML yang berisi soal.
- `parseSoalHtml(htmlString)`: memecah HTML menjadi blok soal dan memanggil `extractAllQuestionDetails` untuk setiap blok.
- `extractAllQuestionDetails(htmlBlock)`: fungsi yang bertanggung jawab mengekstrak nomor soal, pertanyaan, opsi, poin, jawaban benar, dan pembahasan. Jika struktur HTML berubah, sesuaikan selector di fungsi ini.

**Selector yang digunakan (sesuaikan bila markup berbeda)**

- Nomor soal: `.btn-outline-primary.px-3`
- Pertanyaan: `.row.mt-2 .col-12.px-4 p`
- Blok opsi: `.row.mt-3.opsi`
- Label opsi: `.opsi-button`
- Teks opsi: `.opsi-label p`
- Poin (badge): `.badge`
- Jawaban benar (tanda aktif): `.opsi .opsi-button.btn-primary`
- Pembahasan block: `.row.my-2 .col-12.px-4`

Jika parser sering mengeluarkan peringatan bahwa selector tidak ditemukan, buka `soal_kedinasan.json` atau ambil `sample_soal.html` (lihat bagian Troubleshooting) dan periksa markup asli lalu sesuaikan selector di `extractAllQuestionDetails`.

**Kontribusi**

- Jika Anda ingin parser yang lebih tangguh, buat issue atau PR yang menambahkan test HTML sample dan selector alternatif.
