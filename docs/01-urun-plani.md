# Ürün Planı (v0.1)

Mustafa + Claude + ChatGPT fikir alışverişinden çıkan kararlar. Değiştikçe güncellenir.

## Konumlandırma
- Rakipler "bir sürü oyun" sunuyor, biz **"düzgün oyun"** sunuyoruz.
- Üç marka sözü:
  - 🛡️ **Adil:** Dağıtım doğrulanabilir. "Şansa karışmayız."
  - ⚡ **Kesintisiz:** Bağlantın giderse oyun gitmez.
  - 🤝 **Birlikte:** Arkadaşını linkle masaya getir.
- Slogan adayı: **"Mesafe var. Masa aynı."**
- Hedef: Türkiye + Avrupa'daki Türkler (Almanya, Hollanda, Fransa, Belçika, Avusturya).

## Oyun sırası
1. **101 Okey** (v1.0, online)
2. **Batak** (güncellemeyle eklenir). Kurallar: [03-batak-kurallari.md](03-batak-kurallari.md)
3. Okey
4. King, Pişti, Tavla

Fazlar ve takvim: [04-yol-haritasi.md](04-yol-haritasi.md)

Ana ekranda yayında olmayan oyunlar "Yakında" kilidiyle görünür.

## v1.0 kapsamı
**Oyun**
- 101 Okey online: tekli ve eşli, sabit 101 ve yükselen masalar, 5/7/9/11 el. Kurallar: [02-101-kurallari.md](02-101-kurallari.md)
- Hızlı eşleşme, arkadaş masası (WhatsApp linki), botlarla oyun

**Altyapı**
- Bağlantı koparsa bot devralır, oyuncu 60 sn içinde dönerse aynı koltuğa oturur
- Bütün kurallar sunucuda kontrol edilir, istemci hiçbir sonuca karar vermez
- Adil dağıtım: Sunucunun ve her oyuncunun rastgele sayısı birleştirilerek karıştırılır. Sunucu bile sonucu önceden bilemez. El sonunda "🛡️ Adil Oyun Doğrulandı" gösterilir.
- Her elin olay kaydı tutulur, şikayet gelince el baştan oynatılabilir
- Karma eşleşme: 20–25 sn'de gerçek oyuncu bulunamazsa bot eklenir. Botlar her zaman "BOT" etiketiyle görünür.

**Hesap ve sosyal**
- Misafir girişi + Google ile hesap bağlama (iOS gelince Apple)
- Profil, XP, rütbe, arkadaş ekleme
- Serbest sohbet yok, **hazır tepkiler** var
- Rövanş butonu, WhatsApp'ta paylaşılabilir maç kartı
- Sessize al, engelle, bildir. Gizli fair-play puanı tutulur.
- Hesap silme seçeneği (Play Store zorunluluğu)

**Gelir**
- **Reklamsız üyelik: 19,99 TL/ay, Avrupa'da 0,99 €/ay.**
- Ödüllü reklam: oyuncu isterse izler, karşılığında kozmetik deneme veya günlük sandık alır. Reklam izleyen rekabet avantajı kazanmaz.
- Oyun ortasında reklam yok
- Kozmetik ürünler: taş seti, masa teması, profil çerçevesi
- **Satın alınabilir çip yok.** İlerleme lig puanı, XP ve kupa ile olur. Bunlar paraya çevrilemez ve transfer edilemez.
- Reklam ağında kumar/bahis kategorisi kapalı olur

**Dil ve platform**
- Türkçe, Almanca, İngilizce (Felemenkçe ve Fransızca v1.1'de)
- İlk sürüm Android, iOS sonra

## v1.1 ve sonrası
- **Bizim Masa:** Kalıcı arkadaş grupları, grup istatistikleri, sezon geçmişi
- **Akşam Masası:** "Her cuma 21:00" gibi düzenli masa ve hatırlatma bildirimi
- **Şehir masaları ve şehir ligi:** Memleket + yaşadığı şehir (örn. Trabzon + Berlin)
- **Turnuvalar:** Haftalık turnuvalar, şehirler arası kapışmalar
- El sonu "Maçın hikâyesi" özeti
- Sezonluk kozmetikler: Ramazan, Bayram, yılbaşı

## Görsel kimlik: Modern Çini
- Arayüzün %90'ı modern, %10'u kültürel dokunuş. Çini motifleri yalnızca taş arkalarında, masa kenarında, yükleme ekranında ve rozetlerde kullanılır.
- Palet önerisi: zemin `#101820`, masa `#174A45`, turkuaz `#19A7A0`, kırık beyaz `#F4F0E8`, mat altın `#D5A84B`

## İsim
Henüz karar verilmedi. Aday: **Meydan**. Mağaza ve alan adı taraması yapılacak.

## Teknik
| Katman | Seçim |
|---|---|
| Uygulama | Flutter |
| Oyun sunucusu | Node.js + TypeScript, kendi WebSocket oda sistemi (sunucu otoriter). Colyseus'un resmi Flutter istemcisi olmadığı için kullanılmadı. |
| Kural motoru | Arayüzden bağımsız, testli TypeScript paketi |
| Veritabanı | PostgreSQL (Neon) |
| Reklam | Google AdMob + GDPR onay ekranı |
| Sunucu bölgesi | Frankfurt |
