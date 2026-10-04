import 'dart:math';

import 'package:flutter/material.dart';

import '../game/table_state.dart';
import '../net/game_connection.dart';
import '../theme.dart';
import '../ui/sounds.dart';
import 'table_screen.dart';

/// Geçici ana sayfa: botlarla oyna, masa kur, koda katıl. Lobi ve eşleşme Faz 6'da gelecek.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.connection, this.sounds});

  final GameConnection connection;
  final Sounds? sounds;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _name = TextEditingController(text: 'Oyuncu');
  final _code = TextEditingController();
  var _settings = const TableSettings(
    openingMode: 'fixed',
    hands: 7,
    partnership: false,
    unopenedPenalty: 202,
    speed: 'normal',
  );

  @override
  void dispose() {
    _name.dispose();
    _code.dispose();
    super.dispose();
  }

  static String _randomCode() {
    const letters = 'abcdefghjkmnpqrstuvwxyz23456789';
    final r = Random.secure();
    return List.generate(5, (_) => letters[r.nextInt(letters.length)]).join();
  }

  String get _playerName =>
      _name.text.trim().isEmpty ? 'Oyuncu' : _name.text.trim();

  void _open(String room, {bool autoStart = false, bool withSettings = true}) {
    widget.connection.join(
      room,
      _playerName,
      withSettings ? _settings.toJson() : null,
    );
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TableScreen(
          connection: widget.connection,
          autoStart: autoStart,
          sounds: widget.sounds,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListenableBuilder(
          listenable: widget.connection,
          builder: (context, _) {
            final c = widget.connection;
            final connected = c.status == ConnectionStatus.connected;
            return LayoutBuilder(
              builder: (context, constraints) {
                final wide = constraints.maxWidth > 640;
                final brand = _Brand(connection: c);
                final form = _form(connected);
                return SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: wide
                      ? Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(child: brand),
                            const SizedBox(width: 24),
                            Expanded(child: form),
                          ],
                        )
                      : Column(
                          children: [brand, const SizedBox(height: 16), form],
                        ),
                );
              },
            );
          },
        ),
      ),
    );
  }

  Widget _form(bool connected) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _name,
          maxLength: 24,
          decoration: const InputDecoration(labelText: 'Adın', counterText: ''),
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: connected
              ? () => _open('bot-${_randomCode()}', autoStart: true)
              : null,
          icon: const Icon(Icons.smart_toy_outlined),
          label: const Text('Botlarla oyna'),
        ),
        const SizedBox(height: 8),
        FilledButton.tonalIcon(
          onPressed: connected ? () => _open(_randomCode()) : null,
          icon: const Icon(Icons.group_add_outlined),
          label: const Text('Arkadaşlarla masa kur'),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _code,
                decoration: const InputDecoration(
                  labelText: 'Masa kodu',
                  isDense: true,
                ),
                onChanged: (_) => setState(() {}),
              ),
            ),
            const SizedBox(width: 8),
            OutlinedButton(
              onPressed:
                  connected &&
                      RegExp(r'^[a-z0-9-]{1,32}$')
                          .hasMatch(_code.text.trim().toLowerCase())
                  ? () => _open(
                      _code.text.trim().toLowerCase(),
                      withSettings: false,
                    )
                  : null,
              child: const Text('Katıl'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ExpansionTile(
          title: const Text('Masa ayarları'),
          tilePadding: EdgeInsets.zero,
          childrenPadding: const EdgeInsets.only(bottom: 8),
          children: [
            _choice('Açma', _settings.openingMode, {
              'fixed': 'Sabit 101',
              'rising': 'Yükselen',
            }, (v) => _update(openingMode: v)),
            _choice('El sayısı', _settings.hands, {
              5: '5',
              7: '7',
              9: '9',
              11: '11',
            }, (v) => _update(hands: v)),
            _choice('Mod', _settings.partnership, {
              false: 'Tekli',
              true: 'Eşli',
            }, (v) => _update(partnership: v)),
            _choice('Açmamış cezası', _settings.unopenedPenalty, {
              101: '101',
              202: '202',
              303: '303',
            }, (v) => _update(unopenedPenalty: v)),
            _choice('Hız', _settings.speed, {
              'fast': 'Hızlı',
              'normal': 'Normal',
              'relaxed': 'Rahat',
            }, (v) => _update(speed: v)),
          ],
        ),
      ],
    );
  }

  void _update({
    String? openingMode,
    int? hands,
    bool? partnership,
    int? unopenedPenalty,
    String? speed,
  }) {
    setState(() {
      _settings = TableSettings(
        openingMode: openingMode ?? _settings.openingMode,
        hands: hands ?? _settings.hands,
        partnership: partnership ?? _settings.partnership,
        unopenedPenalty: unopenedPenalty ?? _settings.unopenedPenalty,
        speed: speed ?? _settings.speed,
      );
    });
  }

  Widget _choice<T>(
    String label,
    T value,
    Map<T, String> options,
    ValueChanged<T> onChanged,
  ) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: const TextStyle(fontSize: 13, color: Colors.white70),
            ),
          ),
          Expanded(
            child: SegmentedButton<T>(
              showSelectedIcon: false,
              style: const ButtonStyle(visualDensity: VisualDensity.compact),
              segments: [
                for (final e in options.entries)
                  ButtonSegment(value: e.key, label: Text(e.value)),
              ],
              selected: {value},
              onSelectionChanged: (s) => onChanged(s.first),
            ),
          ),
        ],
      ),
    );
  }
}

class _Brand extends StatelessWidget {
  const _Brand({required this.connection});
  final GameConnection connection;

  @override
  Widget build(BuildContext context) {
    final c = connection;
    final (color, text) = switch (c.status) {
      ConnectionStatus.connected => (
        MasaColors.turkuaz,
        'Bağlı${c.latencyMs == null ? '' : ' · ${c.latencyMs} ms'}',
      ),
      ConnectionStatus.connecting => (MasaColors.altin, 'Bağlanıyor…'),
      ConnectionStatus.disconnected => (MasaColors.hata, 'Bağlı değil'),
      ConnectionStatus.versionMismatch => (
        MasaColors.hata,
        'Uygulama güncel değil, lütfen güncelleyin',
      ),
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Masa',
          style: TextStyle(
            fontSize: 44,
            fontWeight: FontWeight.w900,
            color: MasaColors.altin,
          ),
        ),
        const Text(
          '101 Okey',
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        const Text(
          'Mesafe var. Masa aynı.',
          style: TextStyle(fontSize: 15, color: Colors.white70),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Icon(Icons.circle, size: 12, color: color),
            const SizedBox(width: 6),
            Flexible(child: Text(text)),
          ],
        ),
        if (c.lastError != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              c.lastError!,
              style: const TextStyle(color: MasaColors.hata),
            ),
          ),
        const SizedBox(height: 16),
        const Text(
          '🛡️ Adil dağıtım · ⚡ Bağlantın giderse oyun gitmez · 🤝 Arkadaşınla aynı masada',
          style: TextStyle(fontSize: 12, color: Colors.white54),
        ),
      ],
    );
  }
}
