import 'package:flutter/material.dart';

import '../net/game_connection.dart';
import '../theme.dart';

/// Faz 1 bağlantı testi ekranı. Lobi ekranı gelince (Faz 6) kaldırılacak.
class ConnectionTestScreen extends StatefulWidget {
  const ConnectionTestScreen({super.key, required this.connection});

  final GameConnection connection;

  @override
  State<ConnectionTestScreen> createState() => _ConnectionTestScreenState();
}

class _ConnectionTestScreenState extends State<ConnectionTestScreen> {
  final _nameController = TextEditingController(text: 'Oyuncu');

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Bağlantı Testi')),
      body: ListenableBuilder(
        listenable: widget.connection,
        builder: (context, _) {
          final c = widget.connection;
          final room = c.room;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: ListTile(
                  leading: _StatusDot(c.status),
                  title: Text(_statusText(c.status)),
                  subtitle: Text(c.url.toString()),
                  trailing: c.latencyMs != null &&
                          c.status == ConnectionStatus.connected
                      ? Text('${c.latencyMs} ms')
                      : null,
                ),
              ),
              if (c.lastError != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    c.lastError!,
                    style: const TextStyle(color: MasaColors.hata),
                  ),
                ),
              const SizedBox(height: 16),
              TextField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'Adın'),
                maxLength: 24,
              ),
              FilledButton(
                onPressed: c.status == ConnectionStatus.connected
                    ? () => room == null
                        ? c.join('test-masa', _nameController.text)
                        : c.leave()
                    : null,
                child: Text(room == null ? 'Test masasına otur' : 'Masadan kalk'),
              ),
              if (room != null) ...[
                const SizedBox(height: 16),
                Text(
                  'Masada ${room.players.length} kişi',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                for (final player in room.players)
                  ListTile(leading: const Icon(Icons.person), title: Text(player)),
              ],
            ],
          );
        },
      ),
    );
  }

  static String _statusText(ConnectionStatus status) => switch (status) {
        ConnectionStatus.connected => 'Bağlandı',
        ConnectionStatus.connecting => 'Bağlanıyor…',
        ConnectionStatus.disconnected => 'Bağlı değil',
        ConnectionStatus.versionMismatch =>
          'Uygulama güncel değil, lütfen güncelleyin',
      };
}

class _StatusDot extends StatelessWidget {
  const _StatusDot(this.status);

  final ConnectionStatus status;

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      ConnectionStatus.connected => MasaColors.turkuaz,
      ConnectionStatus.connecting => MasaColors.altin,
      _ => MasaColors.hata,
    };
    return Icon(Icons.circle, color: color, size: 16);
  }
}
