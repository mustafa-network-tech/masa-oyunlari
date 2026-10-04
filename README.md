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
```

Uygulama (`app/` içinde):
```bash
flutter run                                                    # emülatör (sunucuya 10.0.2.2 üzerinden bağlanır)
flutter run --dart-define=SERVER_URL=ws://192.168.1.20:2567    # gerçek telefon: bilgisayarın yerel IP'si
dart analyze
flutter test
flutter test test/live_server_test.dart --dart-define=LIVE_SERVER_URL=ws://localhost:2567   # çalışan sunucuya karşı
```
