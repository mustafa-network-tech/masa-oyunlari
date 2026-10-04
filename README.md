# Masa Oyunları

Online 101 Okey ve Batak. Plan ve kurallar: [docs/](docs/)

| Klasör | İçerik |
|---|---|
| `engine/` | Oyun kural motorları (TypeScript, arayüzden bağımsız) |
| `server/` | Online oyun sunucusu (Node.js + WebSocket) |
| `app/` | Mobil uygulama (Flutter) |

## Gerekenler
Node.js 22+, Flutter (stable), Android SDK.

## Windows'ta klasör adı uyarısı
Android derleyicisi ve `flutter analyze`, yolunda Türkçe karakter (ı, ş, ğ…) olan klasörlerde çalışmıyor. Proje klasörünün adı ASCII olmalı (örn. `masa-oyunlari`).

## Geliştirme
```bash
npm install          # ilk kurulum
npm run dev          # sunucuyu başlatır (ws://localhost:2567), kod değişince yeniden başlar
npm test             # motor ve sunucu testleri
npm run typecheck    # tip kontrolü
npm run build        # sunucuyu server/dist/server.js olarak derler
npm run loadtest -w @masa/server -- --tables 200 --hands 5   # çalışan sunucuya yük testi (--humans 1 ile botlu masalar)
```

Sunucu ortam değişkenleri:
| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | 2567 | WebSocket portu |
| `HAND_LOG_DIR` | `logs` | El kayıtlarının (JSONL) yazıldığı klasör |
| `STATS_INTERVAL_MS` | kapalı | Bağlantı, masa, bellek ve gecikmeyi düzenli yazar |
| `BOT_DELAY_MS` | 900 | Bot adımları arası bekleme (yük testi için) |

Uygulama (`app/` içinde):
```bash
flutter run                                                    # emülatör (sunucuya 10.0.2.2 üzerinden bağlanır)
flutter run --dart-define=SERVER_URL=ws://192.168.1.20:2567    # gerçek telefon: bilgisayarın yerel IP'si
dart analyze
flutter test
flutter test test/live_server_test.dart --dart-define=LIVE_SERVER_URL=ws://localhost:2567   # çalışan sunucuya karşı
```
