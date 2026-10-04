import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../game/game_controller.dart';
import '../game/table_state.dart';
import '../net/game_connection.dart';
import '../theme.dart';
import '../ui/sounds.dart';
import 'game_view.dart';

/// Masa: oyuncular beklenirken bekleme odası, oyun başlayınca oyun masası.
class TableScreen extends StatefulWidget {
  const TableScreen({
    super.key,
    required this.connection,
    this.autoStart = false,
    this.sounds,
  });

  final GameConnection connection;
  final Sounds? sounds;

  /// Botlarla oyunda masa sahibi oturur oturmaz oyun başlar.
  final bool autoStart;

  @override
  State<TableScreen> createState() => _TableScreenState();
}

class _TableScreenState extends State<TableScreen> {
  late final GameController controller = GameController(
    widget.connection,
    sounds: widget.sounds,
  );
  bool _started = false;
  bool _closing = false;

  @override
  void initState() {
    super.initState();
    controller.addListener(_onChange);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }

  void _onChange() {
    final s = controller.state;
    if (widget.autoStart &&
        !_started &&
        s != null &&
        s.phase == TablePhase.waiting &&
        s.you == s.host) {
      _started = true;
      controller.start();
    }
    // Masadan çıktık (kalktık veya koltuk bota geçti).
    if (!widget.connection.inTable && !_closing && mounted) {
      _closing = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) Navigator.of(context).pop();
      });
    }
  }

  @override
  void dispose() {
    controller.removeListener(_onChange);
    controller.dispose();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  Future<void> _confirmLeave() async {
    final s = controller.state;
    final playing =
        s != null &&
        s.phase != TablePhase.waiting &&
        s.phase != TablePhase.finished;
    final ok =
        !playing ||
        await showDialog<bool>(
              context: context,
              builder: (context) => AlertDialog(
                title: const Text('Masadan kalkılsın mı?'),
                content: const Text(
                  'Oyun sürüyor. Kalkarsan yerine bot oturur ve geri dönemezsin.',
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(context, false),
                    child: const Text('Vazgeç'),
                  ),
                  FilledButton(
                    onPressed: () => Navigator.pop(context, true),
                    child: const Text('Kalk'),
                  ),
                ],
              ),
            ) ==
            true;
    if (ok) controller.leave();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmLeave();
      },
      child: Scaffold(
        body: SafeArea(
          child: ListenableBuilder(
            listenable: controller,
            builder: (context, _) {
              final s = controller.state;
              if (s == null) {
                return const Center(child: CircularProgressIndicator());
              }
              if (s.phase == TablePhase.waiting) {
                return WaitingView(
                  controller: controller,
                  onLeave: _confirmLeave,
                );
              }
              return GameView(controller: controller, onLeave: _confirmLeave);
            },
          ),
        ),
      ),
    );
  }
}

/// Bekleme odası: masa kodu, koltuklar, başlat düğmesi.
class WaitingView extends StatelessWidget {
  const WaitingView({
    super.key,
    required this.controller,
    required this.onLeave,
  });

  final GameController controller;
  final VoidCallback onLeave;

  @override
  Widget build(BuildContext context) {
    final s = controller.state!;
    final isHost = s.you != null && s.you == s.host;
    final empty = s.seats.where((x) => x == null).length;
    final st = s.settings;
    final summary = [
      st.openingMode == 'rising' ? 'Yükselen' : 'Sabit 101',
      '${st.hands} el',
      st.partnership ? 'Eşli' : 'Tekli',
      'Açmamış ${st.unopenedPenalty}',
      {'fast': 'Hızlı', 'normal': 'Normal', 'relaxed': 'Rahat'}[st.speed] ??
          st.speed,
    ].join(' · ');

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Masa kodu: ',
                  style: TextStyle(fontSize: 16, color: Colors.white70),
                ),
                SelectableText(
                  s.room,
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: MasaColors.altin,
                    letterSpacing: 2,
                  ),
                ),
                IconButton(
                  tooltip: 'Kodu kopyala',
                  icon: const Icon(Icons.copy, size: 18),
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: s.room));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Masa kodu kopyalandı')),
                    );
                  },
                ),
              ],
            ),
            Text(
              summary,
              style: const TextStyle(fontSize: 13, color: Colors.white60),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              alignment: WrapAlignment.center,
              children: [
                for (var i = 0; i < 4; i++)
                  Container(
                    width: 140,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: MasaColors.masa,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: i == s.you ? MasaColors.turkuaz : Colors.white12,
                      ),
                    ),
                    child: Column(
                      children: [
                        Icon(
                          s.seats[i] == null
                              ? Icons.event_seat_outlined
                              : Icons.person,
                          color: s.seats[i] == null
                              ? Colors.white30
                              : MasaColors.kirikBeyaz,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          s.seats[i]?.name ?? 'Boş',
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: s.seats[i] == null ? Colors.white38 : null,
                          ),
                        ),
                        if (i == s.host)
                          const Text(
                            'Masa sahibi',
                            style: TextStyle(
                              fontSize: 10,
                              color: MasaColors.altin,
                            ),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            if (isHost)
              FilledButton.icon(
                onPressed: controller.start,
                icon: const Icon(Icons.play_arrow),
                label: Text(
                  empty == 0 ? 'Başlat' : 'Başlat (boş koltuklara bot oturur)',
                ),
              )
            else
              const Text(
                'Masa sahibinin başlatması bekleniyor…',
                style: TextStyle(color: Colors.white70),
              ),
            const SizedBox(height: 8),
            TextButton(onPressed: onLeave, child: const Text('Masadan kalk')),
          ],
        ),
      ),
    );
  }
}
