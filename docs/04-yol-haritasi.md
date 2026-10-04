# Yol Haritası: 101 ve Batak'ı Play Store'a Çıkarmak

Proje 11 faza ayrılır (Faz 0 – Faz 10). Her faz bir öncekinin üzerine kurulur. Bir faz, **çıkış kriterleri** sağlanmadan bitmiş sayılmaz.

- **Claude:** Kodu yazar, test eder, dokümanları günceller.
- **Mustafa:** Kararları verir, hesapları açar, telefonda test eder, mağaza işlerini yürütür.

Süreler tahminidir. En çok zaman alacak iş, Mustafa'nın test edip geri bildirim vermesidir.

## Özet takvim
| Faz | Konu | Tahmini süre | Kümülatif |
|---|---|---|---|
| 0 | Hazırlık ve kararlar | 1 hafta | 1. hafta |
| 1 | Proje iskeleti | 1 hafta | 2. hafta |
| 2 | 101 kural motoru | 2 hafta | 4. hafta |
| 3 | 101 botu | 1–2 hafta | 6. hafta |
| 4 | Online masa sunucusu | 2 hafta | 8. hafta |
| 5 | 101 oyun ekranı | 3 hafta | 11. hafta |
| 6 | Hesap, lobi, eşleşme, sosyal | 2 hafta | 13. hafta |
| 7 | Gelir ve diller | 1 hafta | 14. hafta |
| 8 | Test ve **101 yayını** | 3 hafta | **17. hafta** |
| 9 | Batak ve **Batak güncellemesi** | 4 hafta | **21. hafta** |
| 10 | Yayın sonrası büyüme | Sürekli | — |

---

## Faz 0 — Hazırlık ve kararlar ✅
- [x] 101 kuralları onaylandı ([02](02-101-kurallari.md))
- [x] Google Play Console hesabı mevcut
- [ ] Batak kurallarındaki [ONAY] maddeleri (Faz 9'dan önce yeterli, [03](03-batak-kurallari.md))
- [ ] Uygulama ismi ve paket adı (Faz 8'den önce yeterli)

Yayınla ilgili işler (gizlilik politikası, alan adı, kapalı test, mağaza formları) yükleme aşamasında yapılacak: [05-yayin-hazirligi.md](05-yayin-hazirligi.md)

## Faz 1 — Proje iskeleti ✅
**Hedef:** Bütün parçaların birbirine bağlı, çalışan boş bir hali.

- [x] Klasör yapısı: `app/` (Flutter), `server/` (Node.js + TypeScript, WebSocket), `engine/` (kural motorları, TypeScript)
- [x] Git deposu ve otomatik test (GitHub Actions)
- [x] Flutter uygulaması sunucuya bağlanıp boş bir odaya girebiliyor
- [x] Bilgisayarda tek komutla çalışan geliştirme ortamı

**Çıkış kriteri:** Telefondaki uygulama bilgisayardaki sunucuya bağlanıp "merhaba" mesajı alıyor.

## Faz 2 — 101 kural motoru
**Hedef:** Arayüzden bağımsız, eksiksiz ve testli 101 motoru. Projenin kalbi bu.

- [x] Taşlar, gösterge, okey, sahte okey
- [x] Adil dağıtım (sunucu ve oyuncu rastgele sayılarının birleşimi + doğrulama)
- [x] Per doğrulama: seri, küt, çift, okeyli perler, 12-13-1
- [x] Açma: sabit ve yükselen masa, çifte gitme
- [x] İşleme, masadaki okeyi alma
- [x] Yerden taş alma ve zorunluluğu
- [x] Cezalı hamleler
- [x] Bitiş türleri, çarpanlar, puanlama, eşli puanlama, destenin bitmesi
- [x] Maç yönetimi (5/7/9/11 el)
- [x] Her kural için otomatik testler (74 test)
- [ ] Mustafa'nın gerçek oyundan örnek elleriyle puanlama kontrolü

**Çıkış kriteri:** Kural dokümanındaki her madde en az bir testle kapsanıyor ve testlerin hepsi geçiyor. Mustafa'nın verdiği örnek eller doğru puanlanıyor.

## Faz 3 — 101 botu
**Hedef:** Boş koltukları dolduracak ve kopan oyuncunun yerine geçecek, makul oynayan bir bot.

- [x] Elini dizen, açabileceği en iyi kombinasyonu bulan algoritma
- [x] Taş çekme ve atma kararları (rakibe işe yarayacak taşı vermeme)
- [x] Ne zaman açacağı ve ne zaman çifte gideceği
- [x] Zorluk seviyeleri: kolay, orta
- [x] Bot-bot simülasyonu: binlerce el oynatıp kural motorunu ve botu sınamak

- [ ] Mustafa'nın botla oynayıp değerlendirmesi (oyun ekranı gelince, Faz 5)

Simülasyon sonucu: 3.300 elde hiç kural dışı hamle, sonsuz döngü veya cezalı hamle yok. Orta seviye bot kolay botu açık farkla yeniyor.

**Çıkış kriteri:** Bot binlerce simülasyon elinde hiç kural hatası yapmıyor. Mustafa botla oynayınca "saçma oynuyor" demiyor.

## Faz 4 — Online masa sunucusu
**Hedef:** Gerçek oyuncuların hilesiz ve kesintisiz oynadığı sunucu.

- [x] 101 masası: bütün hamleler sunucuda motordan geçer, herkes yalnızca kendi taşlarını görür
- [x] Adil Oyun turu: sunucu tohum özetini yayınlar, cihazlar kendi tohumunu gönderir, el sonunda açıklanır
- [x] Hamle süreleri ve zaman bankası; süre dolunca otomatik hamle, üst üste 2'de "uzakta" ve yerine bot
- [x] Bağlantı kopunca bot devralır, oyuncu 60 sn içinde dönerse aynı koltuğa oturur (koltuk jetonu)
- [x] Aynı mesajın iki kez gelmesine (sıra numarası), hızlı tıklamaya (tur numarası) ve mesaj selline (hız sınırı) karşı koruma
- [x] Her elin olay kaydı: tohumlar + sıralı hamleler, günlük JSONL dosyası. El baştan oynatılabilir.
- [x] Yük testi: `npm run loadtest -w @masa/server`
- [ ] 4 telefonla internet kesme denemesi (oyun ekranı gelince, Faz 5)

Yük testi sonucu (geliştirme bilgisayarı, tek Node süreci):
| Senaryo | Sonuç |
|---|---|
| 500 masa × 4 oyuncu (2.000 bağlantı), 5'er el | 500/500 maç bitti, saniyede 1.239 hamle, hamle onayı p99 13 ms, bellek 124 MB, hata yok |
| 300 masa × 1 oyuncu + 3 bot, botlar gerçeğin 9 katı hızda | 300/300 maç bitti, hamle onayı p99 12 ms, bellek 153 MB, hata yok |
| Kayıtlardan baştan oynatma | 4.250 elin hepsi aynı sonucu verdi |

Otomatik testlerde 4 bağlantılı bir masada bağlantı kesilip yeni bağlantıyla dönülüyor ve oyun kaldığı yerden sürüyor. Flutter istemcisi de gerçek sunucuya karşı aynı senaryoyu geçiyor.

**Çıkış kriteri:** 4 telefonla oynanan bir maçta interneti kesip açınca oyun kaldığı yerden devam ediyor. Yük testinde sunucu sorunsuz.

## Faz 5 — 101 oyun ekranı
**Hedef:** Rakiplerden daha akıcı ve şık bir masa deneyimi.

- [ ] Modern çini temasında masa, ıstaka ve taşlar
- [ ] Sürükle-bırak, otomatik dizme (seriye göre / çifte göre)
- [ ] Açma ve işleme ekranı, puan göstergesi ("açman için 23 puan daha lazım")
- [ ] Animasyonlar ve sesler
- [ ] Hazır tepkiler, el sonu puan tablosu, "🛡️ Adil Oyun Doğrulandı" ekranı
- [ ] Farklı telefon boyutları ve eski/yavaş cihazlarda test

**Çıkış kriteri:** Mustafa ve 3 arkadaşı telefonlarından tam bir maçı sorunsuz oynuyor.

## Faz 6 — Hesap, lobi, eşleşme, sosyal
- [ ] Neon'da PostgreSQL veritabanı (test ve canlı ortam için iki ayrı dal)
- [ ] Misafir girişi, Google ile hesap bağlama, profil, avatar
- [ ] XP ve rütbe sistemi
- [ ] Lobi: oyun seçimi (101 aktif, Batak / Okey / King / Pişti / Tavla "Yakında")
- [ ] Masa türü seçimi (sabit/yükselen, el sayısı, tekli/eşli, açmamış cezası, hız)
- [ ] Hızlı eşleşme, 20–25 sn sonra bot ekleme ("BOT" etiketiyle)
- [ ] Arkadaş ekleme, arkadaş masası, WhatsApp davet linki
- [ ] Rövanş butonu, paylaşılabilir maç kartı
- [ ] Sessize al, engelle, bildir. Fair-play puanı.
- [ ] Hesap silme

**Çıkış kriteri:** Yeni kullanıcı uygulamayı açıp 30 saniye içinde masaya oturabiliyor. WhatsApp linkiyle arkadaş masasına girilebiliyor.

## Faz 7 — Gelir ve diller
- [ ] AdMob ödüllü reklam, GDPR onay ekranı, kumar reklamları kapalı
- [ ] Google Play Faturalandırma: **reklamsız üyelik 19,99 TL / 0,99 € aylık**
- [ ] İlk kozmetik ürünler: 2–3 taş seti, 2–3 masa teması
- [ ] Türkçe, Almanca, İngilizce metinler

**Çıkış kriteri:** Test hesabıyla üyelik alınıp iptal edilebiliyor, ödüllü reklam izlenip ödül alınabiliyor.

## Faz 8 — Test ve 101 yayını
- [ ] Crash ve hata raporlama (Firebase Crashlytics), kullanım analitiği
- [ ] Dahili test: Mustafa ve yakın çevre
- [ ] **Kapalı test: en az 12 kişi, 14 gün** (şahıs hesabıysa zorunlu)
- [ ] Play Console işleri: [05-yayin-hazirligi.md](05-yayin-hazirligi.md) listesindeki her madde
- [ ] Mağaza sayfası: ikon, ekran görüntüleri, tanıtım videosu, TR/DE/EN açıklamalar
- [ ] Canlı sunucu (Frankfurt), yedekleme, izleme
- [ ] Yayın: önce küçük bir yüzdeyle aşamalı yayın, sorun yoksa %100

**Çıkış kriteri:** 🎉 **101 Play Store'da yayında.**

## Faz 9 — Batak ve Batak güncellemesi
Altyapı (sunucu, hesap, lobi, eşleşme, reklam, üyelik) hazır olduğu için yalnızca oyuna özel kısımlar yazılır.

- [ ] Batak kural motoru ve testleri: İhaleli, Eşli İhaleli, Koz Maça ([03](03-batak-kurallari.md))
- [ ] Batak botu: ihale tahmini ve kart oynama
- [ ] Batak odası (sunucu)
- [ ] Kart masası ekranı, iskambil kartı tasarımları, animasyonlar
- [ ] Lobide Batak'ın kilidinin açılması
- [ ] Kapalı testte deneme, sonra güncelleme olarak yayın

**Çıkış kriteri:** 🎉 **Batak, uygulama güncellemesiyle yayında.**

## Faz 10 — Yayın sonrası büyüme
Öncelik, gerçek kullanıcı verisine göre belirlenir.

- **Bizim Masa** grupları ve **Akşam Masası**
- **Şehir masaları** ve şehir ligi (memleket + yaşadığı şehir)
- **Turnuvalar**
- Felemenkçe ve Fransızca
- iOS sürümü (Apple girişi dahil)
- Sezonluk kozmetikler (Ramazan, Bayram, yılbaşı)
- Sonraki oyunlar: **Okey**, sonra King, Pişti, Tavla

---

## Riskler ve önlemler
| Risk | Önlem |
|---|---|
| Kural tartışmaları ("biz böyle oynamıyoruz") | Kurallar baştan dokümanda kesinleşir, farklılıklar masa ayarı olur |
| Açılışta az oyuncu, boş masalar | Az masa türü, bot ile tamamlama, arkadaş davetine ödül |
| Kapalı test için 12 kişi bulamamak | Faz 0'da test grubu toplanmaya başlanır |
| Bağlantı sorunları | Faz 4'te kopma senaryoları zorunlu test |
| Google Play politika reddi | Satın alınabilir çip yok, kumar reklamı kapalı, formlar dikkatle doldurulur |
