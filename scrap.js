const puppeteer = require("puppeteer");
const { JSDOM } = require("jsdom");
require("dotenv").config();

const fileName = "SoalKedinasan1";
const targetUrl = [
	"https://platform.masukkampus.com/tryout/kedinasan/akses/842443/pembahasan",
	"https://platform.masukkampus.com/tryout/kedinasan/akses/851571/pembahasan",
	"https://platform.masukkampus.com/tryout/kedinasan/akses/856010/pembahasan",
	"https://platform.masukkampus.com/tryout/kedinasan/akses/860983/pembahasan",
	"https://platform.masukkampus.com/tryout/kedinasan/akses/861103/pembahasan",
	"https://platform.masukkampus.com/tryout/kedinasan/akses/861126/pembahasan",
]
const cookiesToSet = [
	{
		name: process.env.COOKIE_NAME,
		value: process.env.COOKIE_VALUE,
		domain: "situs-platform.masukkampus.com", // Sesuaikan domain
		path: "/",
		httpOnly: true,
		expires: Date.now() / 1000 + 3600, // Berakhir 1 jam dari sekarang (dalam detik Unix)
	},
	{
		name: "language_pref",
		value: "id",
		domain: "situs-berproteksi.com",
	},
];

async function captureScreenshot(targetUrl, fileName) {
	// 1. Luncurkan browser Chromium/Chrome headless
	const browser = await puppeteer.launch();

	// 2. Buka tab (halaman) baru
	const page = await browser.newPage();

	// URL yang akan di-screenshot
	// const targetUrl = targetUrl[0];

	// Tentukan nama file output
	const outputPath = "wikipedia_screenshot.png";

	console.log("1. Menyiapkan Cookies...");
	// --- Perbaikan: gunakan `page.setCookie` dan pastikan cookies diset untuk `targetUrl` ---
	// Puppeteer mengharapkan cookie memiliki `url` atau domain yang cocok dengan halaman.
	// Untuk menghindari mismatch domain, tambahkan properti `url` ke setiap cookie.
	const preparedCookies = cookiesToSet.map((c) => {
		const cookie = { ...c };
		if (cookie.expires) cookie.expires = Math.floor(cookie.expires);
		// Gunakan targetUrl sebagai acuan agar cookie diterapkan pada origin yang benar
		cookie.url = targetUrl;
		// Hapus domain agar tidak bertabrakan dengan `url`
		delete cookie.domain;
		return cookie;
	});

	// Set cookies pada halaman (menggunakan `page.setCookie`, bukan `browser.setCookie`)
	await page.setCookie(...preparedCookies);
	console.log("   Cookies berhasil diset untuk", targetUrl);

	console.log(`Membuka halaman: ${targetUrl}`);

	try {
		// 3. Navigasi ke URL
		// Tunggu hingga jaringan tidak aktif (biasanya menandakan halaman selesai dimuat)
		await page.goto(targetUrl, { waitUntil: "networkidle2" });

		console.log("3. Verifikasi Cookies (Opsional)...");
		// Verifikasi apakah cookies sudah terpasang dengan benar
		const currentCookies = await page.cookies(targetUrl);
		console.log(
			"   Cookies yang saat ini ada:",
			currentCookies.map((c) => c.name)
		);

		console.log("mengambil kode html #soal-tab");

		const content = await page.$eval("#soal-tab", (el) => el.innerHTML);
		const subjects = await page.$eval(".nav.nav-pills.nav-primary.mb-3.justify-content-start.soal-nav",(el)=>el.innerHTML);
		
		const soalArray = parseSoalHtml(content, getSubjectsId(subjects));
		//jadikan ke dalam file json
		const fs = require("fs");
		fs.writeFileSync(`${fileName}.json`, JSON.stringify(soalArray, null, 2));

		console.log(
			`   Kode HTML #soal-tab berhasil diambil dan disimpan ke ${fileName}.json`
		);
	} catch (error) {
		console.error("Terjadi error saat mengambil screenshot:", error.message);
	} finally {
		// 5. Tutup browser
		await browser.close();
		console.log("Browser ditutup.");
	}
}

function parseSoalHtml(htmlString, subjectids) {
	// Memisahkan string HTML berdasarkan pemisah soal
	const soalBlocks = htmlString.split('<div class="tab-pane show soal"');
	let id = 0;


	const results = [];

	soalBlocks.forEach((block) => {
		const questionDetails = extractAllQuestionDetails(block);
		if (questionDetails) {
			questionDetails.subjectId = subjectids ? subjectids[id] : null;
			results.push(questionDetails);
			id++
		}
	});

	return results;
}

function extractAllQuestionDetails(htmlBlock, subjectids) {
	try {
		// JSDOM memerlukan tag <div> sebagai pembungkus jika input hanya potongan HTML
		const dom = new JSDOM(`<div>${htmlBlock}</div>`);
		const doc = dom.window.document;

		// 1. Ambil Nomor Soal
		const nomorSoalEl = doc.querySelector(".btn-outline-primary.px-3");
		const nomorSoal = nomorSoalEl
			? nomorSoalEl.textContent.trim().replace(".", "")
			: "Nomor tidak ditemukan";

		// 2. Ambil Pertanyaan
		const pertanyaanEl = doc.querySelector(".row.mt-2 .col-12.px-4");
		const pertanyaan = pertanyaanEl
			? pertanyaanEl.innerHTML.trim()
			: "Pertanyaan tidak ditemukan";

		// 3. Ambil Jawaban Benar dan Poin (Memerlukan seleksi yang akurat)
		// Jawaban Benar adalah opsi yang memiliki class 'btn-primary'
		const jawabanSayaEl = doc.querySelector(".opsi .opsi-button.btn-primary");
		const jawabanSaya = jawabanSayaEl
			? jawabanSayaEl.textContent.trim()
			: "Jawaban tidak ditemukan";

		// 4. Ambil Pembahasan (Menggabungkan semua paragraf setelah H3 Pembahasan)
		const discussionBlock = doc.querySelector(".row.my-2 .col-12.px-4");
		let pembahasan = "Pembahasan tidak ditemukan";
		let jawabanBenar = "Jawaban tidak ditemukan";

		if (discussionBlock) {
			// Ambil semua elemen <p> dalam blok pembahasan
			pembahasan = discussionBlock.innerHTML.trim();
			jawabanBenar = Array.from(discussionBlock.querySelectorAll("p"))[0].textContent.replace(/Jawaban:\s*\n*/gi, "").trim();
			jawabanBenar = jawabanBenar.toLowerCase().charAt(0) + ".";
		}

		// 5. Ekstraksi Opsi Jawaban (Karena ini adalah bagian kompleks, kita tetap iterasi)
		const opsiElements = doc.querySelectorAll(".row.mt-3.opsi");
		const opsiJawaban = [];

		opsiElements.forEach((opsi) => {
			const optionLabelEl = opsi.querySelector(".opsi-button");
			const optionLabel =
				optionLabelEl && optionLabelEl.textContent
					? optionLabelEl.textContent.trim()
					: null;

			const optionTextEl = opsi.querySelector(".opsi-label p");
			const optionText =
				optionTextEl && optionTextEl.innerHTML
					? optionTextEl.innerHTML.trim()
					: optionTextEl.innerHTML.trim();

			const badgeEl = opsi.querySelector(".badge");
			const optionPoin =
				badgeEl && badgeEl.textContent ? badgeEl.textContent.trim() : null;

			if (!optionLabelEl)
				console.warn("Warning: opsi-button not found in an opsi block");
			if (!optionTextEl)
				console.warn("Warning: opsi-label p not found in an opsi block");
			if (!badgeEl) console.warn("Warning: .badge not found in an opsi block");

			// gunakan fallback string kosong bila nilai null agar struktur JSON konsisten
			opsiJawaban.push({
				id: optionLabel,
				text: convertLatexSpansToImg(optionText),
				points: Number(optionPoin)
			});
		});

		const results = {
			id: nomorSoal,
			text: convertLatexSpansToImg(pertanyaan),
			options: opsiJawaban,
			// jawabanSaya: jawabanSaya,
			// jawabanBenar: jawabanBenar,
			explanation: convertLatexSpansToImg(pembahasan),
		};

		return results;
	} catch (err) {
		console.error("Error parsing HTML block:", err);
		return null;
	}
}

function getSubjectsId(subjects){
	const dom = new JSDOM(`<div>${subjects}</div>`);
	const doc = dom.window.document;
	const subjectElements = doc.querySelectorAll(".kesulitan");
	let subjectId = [];
	subjectElements.forEach((subjEl, index) => {
		const subjectName = subjEl.textContent.trim();
		subjectId.push(subjectName);
	});
	return subjectId
}

/**
 * Mengonversi string HTML yang mengandung teks LaTeX atau simbol matematika
 * menjadi elemen <img> menggunakan layanan CodeCogs.
 */
function convertLatexSpansToImg(htmlString) {
    if (!htmlString) return htmlString;

    const CODECOGS_BASE_URL = "https://latex.codecogs.com/png.image?";

    let result = htmlString;

    // 1. Normalisasi: Ubah simbol "√" mentah menjadi format LaTeX "\sqrt"
    // Agar teks seperti "√3" bisa terbaca sebagai "\sqrt3"
    result = result.replace(/√/g, '\\sqrt ');

    // --- Definisi Pola Regex ---

    // Pattern Utama: <span class="math-tex"><script type="math/tex">...</script></span>
    const mathTexScriptPattern = /(<span class="math-tex".*?<script type="math\/tex"[^>]*>)(.*?)(<\/script><\/span>)/gs;

    // Pattern 1: <span class="math-tex">\\( ... \\)</span>
    const pattern1 = /<span class="math-tex">\\\\\\((.*?)\\\\\\)<\/span>/g;

    // Pattern 2: \( ... \) (inline LaTeX)
    const pattern2 = /\\\\\((.*?)\\\\\)/g;

    // Pattern 3: $$ ... $$ (display math)
    const pattern3 = /\$\$(.*?)\$\$/g;

    // Pattern 4: $ ... $ (inline math)
    const pattern4 = /(?<!\$)\$(?!\$)(.*?)(?<!\$)\$(?!\$)/g;

    // Pattern 5: Perintah LaTeX telanjang (khusus untuk \sqrt, \frac, dll yang tidak terbungkus)
    const pattern5 = /(\\sqrt\{.*?\})|(\\sqrt\s*\d+)|(\\frac\{.*?\}\{.*?\})/g;


    // --- Proses Eksekusi ---

    // A. Proses pola <script type="math/tex"> (Format standar beberapa editor)
    result = result.replace(mathTexScriptPattern, (match, openingTag, latexContent) => {
        try {
            const cleanLatex = latexContent.trim();
            if (!cleanLatex) return match;

            const encodedLatex = encodeURIComponent(cleanLatex);
            return `<img src="${CODECOGS_BASE_URL}${encodedLatex}" alt="Math" class="rendered-math-img" style="display:inline; vertical-align:middle; margin: 0 2px;">`;
        } catch (e) {
            return match;
        }
    });

    // B. Proses semua pola lainnya
    const patterns = [
        { regex: pattern1, name: "span-bracket" },
        { regex: pattern2, name: "escaped-paren" },
        { regex: pattern3, name: "double-dollar" },
        { regex: pattern4, name: "single-dollar" },
        { regex: pattern5, name: "raw-latex" },
    ];

    patterns.forEach(({ regex }) => {
        result = result.replace(regex, (match, p1) => {
            try {
                // p1 adalah isi grup (capture group), jika null maka gunakan seluruh match
                const content = p1 || match;
                const cleanLatex = content.trim();
                
                if (!cleanLatex) return match;

                const encodedLatex = encodeURIComponent(cleanLatex);
                return `<img src="${CODECOGS_BASE_URL}${encodedLatex}" alt="Math" class="rendered-math-img" style="display:inline; vertical-align:middle; margin: 0 2px;">`;
            } catch (e) {
                return match;
            }
        });
    });

    return result;
}


// for(index in targetUrl){
// 	captureScreenshot(targetUrl[index], `${fileName}-${parseInt(index)+1}`);
// }

captureScreenshot(targetUrl[0], `${fileName}-1`);