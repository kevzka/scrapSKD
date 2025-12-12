const puppeteer = require("puppeteer");
const { JSDOM } = require("jsdom");
require("dotenv").config();

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

async function captureScreenshot() {
	// 1. Luncurkan browser Chromium/Chrome headless
	const browser = await puppeteer.launch();

	// 2. Buka tab (halaman) baru
	const page = await browser.newPage();

	// URL yang akan di-screenshot
	const targetUrl =
		"https://platform.masukkampus.com/tryout/kedinasan/akses/842443/pembahasan";

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
		const soalArray = parseSoalHtml(content);
		//jadikan ke dalam file json
		const fs = require("fs");
		fs.writeFileSync("soal_kedinasan.json", JSON.stringify(soalArray, null, 2));
		console.log(
			"   Kode HTML #soal-tab berhasil diambil dan disimpan ke soal_kedinasan.json"
		);
	} catch (error) {
		console.error("Terjadi error saat mengambil screenshot:", error.message);
	} finally {
		// 5. Tutup browser
		await browser.close();
		console.log("Browser ditutup.");
	}
}

function parseSoalHtml(htmlString) {
	// Memisahkan string HTML berdasarkan pemisah soal
	const soalBlocks = htmlString.split('<div class="tab-pane show soal"');

	const results = [];

	soalBlocks.forEach((block) => {
		const questionDetails = extractAllQuestionDetails(block);
		if (questionDetails) {
			results.push(questionDetails);
		}
	});

	return results;
}

function extractAllQuestionDetails(htmlBlock) {
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
		const opsiJawaban = {};

		opsiElements.forEach((opsi) => {
			const optionLabelEl = opsi.querySelector(".opsi-button");
			const optionLabel =
				optionLabelEl && optionLabelEl.textContent
					? optionLabelEl.textContent.trim()
					: null;

			const optionTextEl = opsi.querySelector(".opsi-label p");
			const optionText =
				optionTextEl && optionTextEl.textContent
					? optionTextEl.textContent.trim()
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
			opsiJawaban[optionLabel || "unknown"] = [
				optionPoin || "",
				optionText || "",
			];
		});

		const results = {
			nomorSoal: nomorSoal,
			pertanyaan: pertanyaan,
			opsiJawaban: opsiJawaban,
			jawabanSaya: jawabanSaya,
			jawabanBenar: jawabanBenar,
			pembahasan: pembahasan,
		};

		return results;
	} catch (err) {
		console.error("Error parsing HTML block:", err);
		return null;
	}
}

captureScreenshot();