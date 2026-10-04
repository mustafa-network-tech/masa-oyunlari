import 'package:flutter/material.dart';

import '../game/fairness.dart';
import '../game/game_controller.dart';
import '../game/table_state.dart';
import '../theme.dart';

class _Panel extends StatelessWidget {
  const _Panel({required this.child, this.maxWidth = 560});
  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0.9, end: 1),
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOutBack,
          builder: (context, v, child) =>
              Transform.scale(scale: v, child: child),
          child: Card(
            margin: const EdgeInsets.all(12),
            color: MasaColors.zemin,
            surfaceTintColor: Colors.transparent,
            elevation: 6,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: MasaColors.altin.withValues(alpha: 0.6)),
            ),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}

String seatName(TableState s, int seat) =>
    seat == s.you ? 'Sen' : s.seats[seat]?.name ?? 'Koltuk ${seat + 1}';

/// El sonu: kim bitti, puanlar, Adil Oyun doğrulaması.
class HandResultPanel extends StatelessWidget {
  const HandResultPanel({super.key, required this.controller});
  final GameController controller;

  @override
  Widget build(BuildContext context) {
    final s = controller.state!;
    final result = s.result!;
    final match = s.match!;
    final finisher = result.finisher;
    final multipliers = [
      if (result.okeyFinish) 'Okeyle ×2',
      if (result.elden) 'Elden ×2',
      if (result.pairsFinish) 'Çiftten ×2',
    ];

    return _Panel(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            finisher == null
                ? 'Deste bitti, kimse bitemedi'
                : '${seatName(s, finisher)} bitti!',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: MasaColors.altin,
            ),
          ),
          if (multipliers.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Wrap(
                alignment: WrapAlignment.center,
                spacing: 6,
                children: [
                  for (final m in multipliers)
                    Chip(label: Text(m), visualDensity: VisualDensity.compact),
                ],
              ),
            ),
          const SizedBox(height: 10),
          ScoreTable(state: s, rows: result.rows),
          const SizedBox(height: 10),
          FairnessBadge(controller: controller),
          const SizedBox(height: 8),
          Text(
            match.history.length >= match.hands
                ? 'Maç bitti'
                : 'El ${match.history.length}/${match.hands} · sonraki el birazdan başlıyor',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 12, color: Colors.white60),
          ),
        ],
      ),
    );
  }
}

class ScoreTable extends StatelessWidget {
  const ScoreTable({super.key, required this.state, required this.rows});
  final TableState state;
  final List<ScoreRow> rows;

  @override
  Widget build(BuildContext context) {
    final totals = state.match!.totals;
    const head = TextStyle(
      fontSize: 11,
      color: Colors.white60,
      fontWeight: FontWeight.w600,
    );
    Widget cell(
      String text, {
      TextStyle? style,
      TextAlign align = TextAlign.right,
    }) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 5, horizontal: 6),
      child: Text(
        text,
        textAlign: align,
        style: style ?? const TextStyle(fontSize: 14),
      ),
    );
    return Table(
      columnWidths: const {0: FlexColumnWidth(2.2)},
      defaultVerticalAlignment: TableCellVerticalAlignment.middle,
      children: [
        TableRow(
          children: [
            cell('Oyuncu', style: head, align: TextAlign.left),
            cell('El', style: head),
            cell('Ceza', style: head),
            cell('Toplam', style: head),
            cell('Maç', style: head),
          ],
        ),
        for (final row in rows)
          TableRow(
            decoration: BoxDecoration(
              color: row.seat == state.you
                  ? MasaColors.turkuaz.withValues(alpha: 0.15)
                  : null,
              borderRadius: BorderRadius.circular(6),
            ),
            children: [
              cell(seatName(state, row.seat), align: TextAlign.left),
              cell('${row.base}'),
              cell(
                row.penalties == 0 ? '–' : '${row.penalties}',
                style: TextStyle(
                  fontSize: 14,
                  color: row.penalties > 0 ? MasaColors.hata : null,
                ),
              ),
              cell(
                '${row.total}',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
              cell(
                '${totals[row.seat]}',
                style: const TextStyle(fontSize: 14, color: MasaColors.altin),
              ),
            ],
          ),
      ],
    );
  }
}

/// "🛡️ Adil Oyun Doğrulandı" rozeti. Dokununca ayrıntılar açılır.
class FairnessBadge extends StatelessWidget {
  const FairnessBadge({super.key, required this.controller});
  final GameController controller;

  @override
  Widget build(BuildContext context) {
    final check = controller.fairness;
    if (check == null) return const SizedBox.shrink();
    final color = check.ok ? MasaColors.turkuaz : MasaColors.hata;
    return Center(
      child: ActionChip(
        avatar: Icon(
          check.ok ? Icons.verified_user : Icons.gpp_bad,
          color: color,
          size: 18,
        ),
        label: Text(
          check.ok ? 'Adil Oyun Doğrulandı' : 'Adil Oyun doğrulanamadı',
          style: TextStyle(color: color, fontWeight: FontWeight.w700),
        ),
        side: BorderSide(color: color),
        onPressed: () => showModalBottomSheet<void>(
          context: context,
          backgroundColor: MasaColors.zemin,
          isScrollControlled: true,
          builder: (_) => FairnessDetails(controller: controller, check: check),
        ),
      ),
    );
  }
}

class FairnessDetails extends StatelessWidget {
  const FairnessDetails({
    super.key,
    required this.controller,
    required this.check,
  });
  final GameController controller;
  final FairnessCheck check;

  @override
  Widget build(BuildContext context) {
    final f = controller.state!.result!.fairness;
    Widget item(bool? ok, String text) => ListTile(
      dense: true,
      leading: Icon(
        ok == null
            ? Icons.remove_circle_outline
            : (ok ? Icons.check_circle : Icons.cancel),
        color: ok == null
            ? Colors.white38
            : (ok ? MasaColors.turkuaz : MasaColors.hata),
      ),
      title: Text(text),
    );
    const mono = TextStyle(
      fontFamily: 'monospace',
      fontSize: 11,
      color: Colors.white70,
    );
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Adil Oyun',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            const Text(
              'Taşlar, sunucunun ve oyuncuların telefonlarının ürettiği rastgele sayılar birleştirilerek karıştırıldı. '
              'Sunucu kendi sayısını el başında kilitledi, oyuncuların sayısını önceden bilemedi. '
              'Telefonun bunları el bitince kendisi kontrol etti:',
              style: TextStyle(fontSize: 13, color: Colors.white70),
            ),
            item(
              check.commitMatches,
              'Sunucu sayısını el ortasında değiştirmedi',
            ),
            item(
              check.mySeedIncluded,
              'Senin telefonunun sayısı karıştırmaya katıldı',
            ),
            item(check.seedMatches, 'Karıştırma bu sayılardan üretildi'),
            item(check.dealMatches, 'Sana gelen taşlar bu karıştırmayla aynı'),
            const SizedBox(height: 8),
            SelectableText(
              'Özet: ${f.commit}\nSunucu: ${f.serverSeed}\nKarıştırma: ${f.seed}',
              style: mono,
            ),
          ],
        ),
      ),
    );
  }
}

/// Maç sonu: sıralama ve kazanan.
class MatchOverPanel extends StatelessWidget {
  const MatchOverPanel({
    super.key,
    required this.controller,
    required this.onHome,
  });
  final GameController controller;
  final VoidCallback onHome;

  @override
  Widget build(BuildContext context) {
    final s = controller.state!;
    final totals = s.match!.totals;
    final teams = s.settings.partnership;
    final entries = teams
        ? [
            (
              name: '${seatName(s, 0)} & ${seatName(s, 2)}',
              score: totals[0] + totals[2],
              mine: s.you == 0 || s.you == 2,
            ),
            (
              name: '${seatName(s, 1)} & ${seatName(s, 3)}',
              score: totals[1] + totals[3],
              mine: s.you == 1 || s.you == 3,
            ),
          ]
        : [
            for (var i = 0; i < 4; i++)
              (name: seatName(s, i), score: totals[i], mine: i == s.you),
          ];
    entries.sort((a, b) => a.score.compareTo(b.score));
    final best = entries.first.score;
    final winners = entries.where((e) => e.score == best).toList();
    final iWon = winners.any((e) => e.mine);

    return _Panel(
      maxWidth: 460,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.emoji_events,
            size: 40,
            color: iWon ? MasaColors.altin : Colors.white38,
          ),
          Text(
            iWon
                ? 'Kazandın!'
                : 'Kazanan: ${winners.map((w) => w.name).join(', ')}',
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: MasaColors.altin,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'En düşük puan kazanır',
            style: TextStyle(fontSize: 12, color: Colors.white60),
          ),
          const SizedBox(height: 10),
          for (final (i, e) in entries.indexed)
            ListTile(
              dense: true,
              tileColor: e.mine
                  ? MasaColors.turkuaz.withValues(alpha: 0.15)
                  : null,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              leading: Text(
                '${i + 1}.',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              title: Text(e.name),
              trailing: Text(
                '${e.score}',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          const SizedBox(height: 10),
          FilledButton.icon(
            onPressed: onHome,
            icon: const Icon(Icons.home),
            label: const Text('Ana sayfa'),
          ),
        ],
      ),
    );
  }
}

class SeedingCard extends StatelessWidget {
  const SeedingCard({super.key});

  @override
  Widget build(BuildContext context) {
    return const _Panel(
      maxWidth: 360,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox.square(
            dimension: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
          SizedBox(width: 12),
          Flexible(
            child: Text(
              'Adil dağıtım hazırlanıyor…',
              style: TextStyle(fontSize: 15),
            ),
          ),
        ],
      ),
    );
  }
}

/// Ekranın üstünde ince bilgi bandı.
class InfoBanner extends StatelessWidget {
  const InfoBanner({
    super.key,
    required this.text,
    required this.color,
    this.action,
  });
  final String text;
  final Color color;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color,
      borderRadius: BorderRadius.circular(10),
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              text,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                color: MasaColors.kirikBeyaz,
              ),
            ),
            if (action != null) ...[const SizedBox(width: 8), action!],
          ],
        ),
      ),
    );
  }
}
