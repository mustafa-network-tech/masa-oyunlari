# 101 Okey — Kural Spesifikasyonu (v1.0 — onaylandı)

Bu doküman oyun motorunun tek kaynağıdır. Kod bu kurallara göre yazılır, testler bu kurallardan türetilir.
Bütün maddeler Mustafa tarafından onaylandı (2026-10-04).

---

## 1. Taşlar ve dağıtım
- 106 taş: 4 renk (kırmızı, sarı, mavi, siyah) × 1–13 × 2 adet = 104 + 2 sahte okey.
- 4 oyuncu, saat yönünün tersine oynanır.
- Başlayan oyuncu 22 taş, diğerleri 21 taş alır. Başlayan oyuncu ilk turda çekmeden taş atar.
- Dağıtım sunucuda yapılır; karıştırma "Adil Oyun" yöntemiyle doğrulanabilir (bkz. ürün planı).

## 2. Gösterge ve okey
- Açılan gösterge taşının aynı renkteki bir üstü **okey**tir (gösterge 13 ise okey 1'dir).
- Okey her taşın yerine geçebilir (joker).
- Sahte okey, okey taşının kendisi gibi davranır (okeyin rengi ve sayısı).
- Okey bir perde kullanıldığında yerine geçtiği taşın puanını alır.

## 3. Perler
- **Seri:** Aynı renk, ardışık en az 3 taş. Örn. kırmızı 4-5-6.
- **Küt (grup):** Aynı sayı, farklı renk, 3 veya 4 taş. Örn. 7 kırmızı - 7 mavi - 7 siyah.
- **Çift:** Aynı renk ve aynı sayıdan 2 taş.
- **Seriler 13'te biter.** 12-13-1 ve 13-1-2 gibi seriler geçersizdir. 1 taşı yalnızca 1-2-3 gibi serilerin başında kullanılır ve 1 puan sayılır.

## 4. Açma
Oyuncu elini açmak için kendi sırasında, tek seferde yere per koyar.

| Açma türü | Sabit masa | Yükselen masa |
|---|---|---|
| Per ile | Toplam ≥ **101** | İlk açan ≥ 101, sonraki her açan **masadaki en yüksek açmadan en az 1 fazla** |
| Çift ile | ≥ **5 çift** | İlk çift açan ≥ 5, sonraki çift açan **öncekinden en az 1 çift fazla** |

- Çifte giden oyuncu o elde **seri veya küt açamaz**. Yalnızca çift ekleyebilir ve masadaki perlere taş işleyebilir.

## 5. İşleme
- Elini açmış oyuncu kendi sırasında masadaki **herhangi bir pere** (kendi veya başkasının) taş ekleyebilir.
- Açmamış oyuncu işleme yapamaz.
- **Masadaki okeyi almak serbesttir:** Açmış oyuncu, masadaki bir perde okeyin yerine geçtiği gerçek taşı koyup okeyi alabilir.

## 6. Yere atılan taşı alma
- Oyuncu, solundaki oyuncunun attığı taşı alabilir.
- **Açmamış oyuncu** aldığı taşı **aynı tur** açmada kullanmak zorundadır. Açamazsa taş geri konur ve oyuncu **101 ceza** alır.
- **Açmış oyuncu** aldığı taşı aynı tur işlemek zorundadır.
- Taş ele alınıp saklanamaz.

## 7. Cezalı hamleler
| Hamle | Ceza |
|---|---|
| İşlenebilir bir taşı yere atmak | +101 |
| Okey atmak (bitiş hamlesi dışında) | +101 |
| Yerden alıp kullanamamak | +101 |

## 8. Bitiş ve puanlama
Oyuncu elindeki tüm taşları açıp/işleyip son taşını yere atarak biter. **Düşük puan iyidir.**

### Temel değerler
| Oyuncu | Puan |
|---|---|
| Biten | −101 |
| Açmış | Elinde kalan taşların toplamı |
| Açmış ve elinde okey kalmış | Elinde kalan taşların toplamı **+101** |
| Açmamış | Masa ayarındaki açmamış cezası (101 / 202 / 303). Elinde okey olsa da ek ceza yazılmaz. |

### Çarpanlar
Çarpanlar birbiriyle çarpılır.

| Durum | Etki |
|---|---|
| Okey atarak bitme | ×2 (bitenin puanı ve diğerlerinin cezaları) |
| Elden bitme (tek seferde hepsini açıp bitme) | ×2 |
| Çiftle bitme | ×2 |
| Çifte gitmiş oyuncunun cezası | ×2 |

Örnek: Çiftle açıp okey atarak biten oyuncu: −101 × 2 × 2 = **−404**.

### Deste biterse
Kimse bitemeden çekilecek taş kalmazsa el **bitensiz kapanır**. Herkes kendi cezasını yazar: açmış oyuncu elindeki toplamı, açmamış oyuncu açmamış cezasını.

## 9. Maç
- Maç **5 / 7 / 9 / 11 el** olabilir (masa ayarı).
- Maç sonunda **toplam puanı en düşük** olan kazanır.
- Başlama sırası her elde bir sonraki oyuncuya geçer.

### Eşli 101
- Karşılıklı oturan oyuncular eştir. Takımın puanı iki eşin toplamıdır.
- **Bir eş biterse, eşi ceza yazmaz (0).** Karşı takımın iki oyuncusu da kendi cezasını yazar.

## 10. Masa ayarları
| Ayar | Seçenekler | Varsayılan |
|---|---|---|
| Açma türü | Sabit 101 / Yükselen | Sabit |
| El sayısı | 5 / 7 / 9 / 11 | 7 |
| Mod | Tekli / Eşli | Tekli |
| Açmamış cezası | 101 / 202 / 303 | 202 |
| Hız | Hızlı / Normal / Rahat | Normal |

## 11. Hamle süresi
Rakiplerde hızlı masalar 10–15 sn, normal masalar 20–30 sn, rahat masalar 60 sn civarında.
101'de açma turu uzun sürer, bu yüzden normal süreye ek olarak **zaman bankası** kullanılır.

| Hız | Hamle süresi | Zaman bankası (el başına) |
|---|---|---|
| Hızlı | 12 sn | 20 sn |
| Normal | 20 sn | 40 sn |
| Rahat | 35 sn | 60 sn |

- Hamle süresi dolarsa önce zaman bankası harcanır.
- Banka da biterse otomatik hamle yapılır: taş çekilir ve en işe yaramaz taş atılır (cezalı hamle yapılmaz).
- Üst üste 2 otomatik hamlede oyuncu "uzakta" sayılır ve yerine bot oynar. Oyuncu dokununca kontrol geri gelir.
- Arkadaş masasında süreyi masa sahibi seçer.

## 12. Motorda netleştirilen ayrıntılar
Kurallarda açıkça yazmayan durumlar motorda şöyle uygulandı. Mustafa tarafından onaylandı (2026-10-04).

1. **İşlek taş cezası herkese uygulanır.** Elini açmamış oyuncu da işlenebilir taş atarsa 101 ceza alır.
2. **Bitiş hamlesine ceza yazılmaz.** Son taş okey ya da işlek taş olsa da ceza yok; okeyle bitiş zaten ×2 sayılır.
3. **Yerden alınıp kullanılamayan taş:** Oyuncu taşı geri koyar, 101 ceza alır ve desteden taş çeker.
4. **Açmış oyuncu yerden taş alırsa** o taşı aynı tur işlemek ya da yeni perde kullanmak zorundadır.
5. **Elde kalan okey:** Okeyin kendi sayı değeri + 101 yazılır (örn. okey siyah 13 ise 114). Sahte okey yalnızca okeyin sayı değeri kadar sayılır.
6. **Joker çiftte kullanılabilir.** Okey her taşla çift olur; iki okey de çift sayılır.
7. **Eşli oyunda** bitenin eşi el puanı olarak 0 yazar. O el içinde yaptığı cezalı hamleler yine de yazılır.
8. **Deste biterse:** Son taş çekilip atıldıktan sonra sıradaki oyuncunun çekecek taşı yoksa el kapanır.
9. **Gösterge:** Karıştırılmış destenin sonundaki ilk gerçek taş (sahte okey gösterge olamaz). Gösterge oyunda kullanılmaz.
10. **Seri sırası:** Seriler küçükten büyüğe dizilir. Okey serinin herhangi bir yerinde boşluğu doldurabilir.
