/// Entry point de la app Smart Control Security.
///
/// Para correr en desarrollo (Android conectado por USB):
///     flutter run
///
/// Para hacer un build de release:
///     flutter build apk --release --obfuscate --split-debug-info=build/symbols/

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // TODO(Fase 2): Inicializar Firebase, configuración, almacenamiento, etc.
  // await Firebase.initializeApp();
  // await AppConfig.load();
  // await SecureStorage.init();

  runApp(
    const ProviderScope(
      child: SmartControlSecurityApp(),
    ),
  );
}
