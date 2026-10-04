# Play Store Yayın Hazırlığı

Bu işler kodlama fazları bittikten sonra, **Faz 8'de** uygulama Play Console'a yüklenirken yapılır.

## Karar verilecekler
- [ ] Uygulama ismi
- [ ] **Paket adı** (örn. `com.xxx.masa`). Play Store'a ilk yüklemeden sonra **değiştirilemez**. Şu an geçici olarak `com.masaoyunlari.masa` kullanılıyor.
- [ ] Hesap türü: Play Console hesabı **şahıs** hesabıysa ilk yayından önce **en az 12 kişiyle 14 gün kapalı test** zorunlu. Test grubunu erkenden toplamak gerekir.

## Web sayfası ve hukuki metinler
- [ ] Alan adı
- [ ] Gizlilik politikası sayfası (Play Console ve AdMob istiyor)
- [ ] Kullanım koşulları sayfası
- [ ] Hesap silme talebi sayfası (uygulama içi silmeye ek olarak web adresi isteniyor)
- [ ] `app-ads.txt` dosyası (AdMob için alan adının kökünde)

## Play Console formları
- [ ] Veri güvenliği (hangi verileri topluyoruz, neden)
- [ ] İçerik derecelendirmesi (IARC anketi)
- [ ] Hedef kitle ve içerik (çocuklara yönelik değil)
- [ ] Reklam beyanı (uygulamada reklam var)
- [ ] Uygulama erişimi (test için giriş bilgisi gerekiyorsa)
- [ ] Hedef API seviyesi güncel mi kontrol

## Ödeme ve reklam
- [ ] Play Console ödeme profili (abonelik geliri için)
- [ ] Abonelik ürünü: reklamsız üyelik 19,99 TL / 0,99 € aylık
- [ ] AdMob hesabı, uygulama kaydı, ödüllü reklam birimi
- [ ] AdMob'da kumar/bahis reklam kategorisini engelleme
- [ ] GDPR onay mesajı (AdMob'daki "Privacy & messaging" bölümünden)

## Mağaza sayfası
- [ ] İkon (512×512)
- [ ] Öne çıkan görsel (1024×500)
- [ ] Telefon ekran görüntüleri (TR, DE, EN)
- [ ] Kısa ve uzun açıklama (TR, DE, EN)
- [ ] Tanıtım videosu (isteğe bağlı)

## Teknik
- [ ] Yükleme anahtarı (upload key) oluşturup güvenli yerde saklamak
- [ ] Play App Signing
- [ ] Canlı sunucu (Frankfurt) ve alan adı üzerinden güvenli bağlantı (`wss://`)
- [ ] Aşamalı yayın: önce küçük bir yüzde, sorun yoksa %100
