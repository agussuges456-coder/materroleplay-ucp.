# MaterRoleplay UCP

UCP ini memakai halaman web statis, Supabase Auth/PostgreSQL, dan satu Vercel Function untuk login dari gamemode SA-MP. Tidak memakai MySQL.

## 1. Siapkan Supabase

1. Buat project baru di Supabase.
2. Buka **SQL Editor**, lalu jalankan seluruh isi `supabase/schema.sql`.
3. Ambil **Project URL** dan **anon public key** dari Project Settings > API.
4. Isi nilai tersebut di `config.js`.

`anon key` boleh berada di browser jika RLS pada schema sudah aktif. Jangan memasukkan service role key ke `config.js`, `index.html`, atau file yang dikirim ke browser.

## 2. Deploy ke Vercel

Jadikan folder `ucp` sebagai **Root Directory** project Vercel. Vercel akan menyajikan `index.html` dan endpoint `api/game-login.js`.

Tambahkan environment variables berikut di Vercel:

```text
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
UCP_GAME_SERVER_SECRET=buat-secret-panjang-yang-sama-dengan-gamemode
```

`SUPABASE_SERVICE_ROLE_KEY` hanya boleh dipakai oleh Vercel Function. Jangan dibagikan ke client atau ditulis di Pawn.

## 3. Hubungkan gamemode

Di `gamemodes/materroleplay.pwn`, ubah:

```pawn
#define UCP_API_URL "https://DOMAIN-VERCEL-KAMU.vercel.app/api/game-login"
#define UCP_SERVER_SECRET "buat-secret-panjang-yang-sama-dengan-vercel"
```

Catatan penting: source gamemode awal menggunakan native `HTTP` bawaan SA-MP. Native tersebut hanya cocok untuk bridge HTTP biasa, sehingga tidak dapat langsung memanggil URL HTTPS Vercel. Untuk koneksi langsung ke Vercel, pasang plugin HTTPS seperti [`https_samp`](https://github.com/NullSablex/https_samp), salin include-nya ke `pawno/include`, lalu migrasikan pemanggilan `HTTP` ke native `https`. Alternatifnya, jalankan bridge HTTP di server game yang meneruskan request ke Vercel.

Endpoint akan menerima request POST dan mengembalikan `OK|id|username` saat login berhasil. Keduanya tidak membutuhkan plugin atau koneksi MySQL untuk database; plugin HTTPS hanya diperlukan bila gamemode mengakses endpoint Vercel secara langsung.

## 4. Alur pengguna

1. Pemain membuat UCP melalui website.
2. Trigger Supabase membuat baris profile secara otomatis.
3. Pemain masuk server dengan username GTA yang sama dan password UCP.
4. Gamemode mengirim kredensial ke endpoint Vercel.
5. Endpoint memvalidasi password melalui Supabase Auth.
