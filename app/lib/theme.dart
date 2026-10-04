import 'package:flutter/material.dart';

/// "Modern Çini" renk paleti. Bkz. docs/01-urun-plani.md
abstract final class MasaColors {
  static const zemin = Color(0xFF101820);
  static const masa = Color(0xFF174A45);
  static const turkuaz = Color(0xFF19A7A0);
  static const kirikBeyaz = Color(0xFFF4F0E8);
  static const altin = Color(0xFFD5A84B);
  static const hata = Color(0xFFE5675A);
}

ThemeData buildMasaTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: MasaColors.turkuaz,
    brightness: Brightness.dark,
  ).copyWith(
    primary: MasaColors.turkuaz,
    secondary: MasaColors.altin,
    surface: MasaColors.zemin,
    onSurface: MasaColors.kirikBeyaz,
    error: MasaColors.hata,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: MasaColors.zemin,
    cardTheme: const CardThemeData(color: MasaColors.masa),
  );
}
