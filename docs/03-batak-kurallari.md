# Batak — Kural Spesifikasyonu (v0.1 taslak)

Bu doküman Batak oyun motorunun tek kaynağıdır. Maddeler yaygın kurallara göre yazıldı.
**[ONAY]** işaretli maddeler Mustafa'nın onayını bekliyor.

İlk yayında üç tür olacak: **İhaleli Batak**, **Eşli İhaleli Batak**, **Koz Maça Batak**.

---

## 1. Ortak kurallar
- 52'lik deste, 4 oyuncu, her oyuncuya 13 kart.
- Kart sırası (büyükten küçüğe): A, K, Q, J, 10, 9 … 2.
- Saat yönünün tersine oynanır. Dağıtıcı her elde bir sonraki oyuncuya geçer.

### Oynama zorunlulukları
1. **Renge uyma:** Yerde açılan renkten kartın varsa o renkten atmak zorundasın.
2. **Yükseltme:** O renkten atarken yerdeki en büyük kartı geçebiliyorsan geçmek zorundasın.
3. **Koz kırma:** Açılan renkten kartın yoksa koz atmak zorundasın. Yerde koz varsa ve onu geçebiliyorsan daha büyük koz atmak zorundasın.
4. Ne o renkten ne de kozdan kartın varsa istediğin kartı atarsın.
5. **Koz açma:** Koz kırılmadan (biri kozla el almadan) el kozla açılamaz. Elinde yalnızca koz kaldıysa açılabilir.

El, koz varsa en büyük koza, yoksa açılan rengin en büyük kartına gider. Eli alan bir sonraki eli açar.

## 2. İhaleli Batak (tekli)
### İhale
- İhale **5** ile açılır. Her teklif bir öncekinden büyük olmalıdır.
- Pas diyen o elde tekrar teklif veremez.
- Herkes pas derse dağıtıcının sağındaki oyuncu ihaleyi **4** ile alır.
- İhaleyi alan **kozu seçer** ve ilk eli o açar.

### Puanlama
| Durum | Puan |
|---|---|
| İhaleci ihaleyi tutarsa | + aldığı el sayısı **[ONAY: + ihale miktarı mı?]** |
| İhaleci tutamazsa | − ihale miktarı |
| Diğer oyuncular | Aldıkları her el için +1 |
| Hiç el alamayan oyuncu ("batak") | − ihale miktarı **[ONAY]** |

### Maç sonu
- **[ONAY]** Maç 101'deki gibi el sayısıyla mı biter (örn. 11 el), yoksa hedef puanla mı (örn. 51)? Varsayılan: el sayısı (5 / 7 / 9 / 11).
- En yüksek puan kazanır.

## 3. Eşli İhaleli Batak
- Karşılıklı oturan oyuncular eştir. Takım puanı ortaktır.
- İhale **8** ile açılır.
- İhaleyi alan oyuncu kozu seçer ve ilk eli açar.
- **[ONAY]** İhalecinin eşi kartlarını masaya açar mı? Bazı uygulamalarda açıyor. Varsayılan: açmaz.

### Puanlama
| Durum | Puan |
|---|---|
| İhaleci takım tutarsa | + aldığı el sayısı |
| İhaleci takım tutamazsa | − ihale miktarı |
| Karşı takım en az 2 el alırsa | + aldığı el sayısı |
| Karşı takım 2 elden az alırsa | − ihale miktarı |
| **[ONAY]** 13 elin hepsini alan takım | Maçı doğrudan kazanır |

## 4. Koz Maça Batak
- Koz her zaman **maça**dır. İhale yoktur.
- **[ONAY]** Her oyuncu sırayla kaç el alacağını söyler (1–13).
- Tutturan oyuncu söylediği kadar puan alır. **[ONAY]** Fazladan aldığı her el +1 mi sayılır?
- Tutturamayan oyuncu söylediği kadar puan kaybeder.

## 5. Masa ayarları
| Ayar | Seçenekler | Varsayılan |
|---|---|---|
| Tür | İhaleli / Eşli İhaleli / Koz Maça | İhaleli |
| Maç uzunluğu | 5 / 7 / 9 / 11 el **[ONAY]** | 11 |
| Hız | Hızlı / Normal / Rahat | Normal |

## 6. Hamle süresi
Batakta her hamle tek kart olduğu için süreler 101'den kısadır.

| Hız | Hamle süresi | İhale süresi |
|---|---|---|
| Hızlı | 8 sn | 10 sn |
| Normal | 15 sn | 15 sn |
| Rahat | 25 sn | 25 sn |

- Süre dolarsa otomatik hamle yapılır: kurallara uyan en küçük kart atılır, ihalede pas denir.
- Üst üste 2 otomatik hamlede yerine bot oynar. Oyuncu dokununca kontrol geri gelir.
