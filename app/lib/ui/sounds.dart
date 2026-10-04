import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';

/// Oyun sesleri (assets/sounds, sentetik). Ses kapatılabilir.
enum Sound { tas, sira, per, ceza, bitis }

class Sounds extends ChangeNotifier {
  bool muted = false;

  // Taş sesi üst üste gelebildiği için ayrı çalar.
  final _tilePlayer = AudioPlayer()..setPlayerMode(PlayerMode.lowLatency);
  final _player = AudioPlayer()..setPlayerMode(PlayerMode.lowLatency);

  void play(Sound sound) {
    if (muted) return;
    final player = sound == Sound.tas ? _tilePlayer : _player;
    player.play(AssetSource('sounds/${sound.name}.wav')).catchError((Object e) {
      debugPrint('Ses çalınamadı: $e');
    });
  }

  void toggle() {
    muted = !muted;
    notifyListeners();
  }

  @override
  void dispose() {
    _tilePlayer.dispose();
    _player.dispose();
    super.dispose();
  }
}
