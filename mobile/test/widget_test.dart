import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smart_control_security/app.dart';

void main() {
  testWidgets('App muestra el placeholder del scaffold inicial', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: SmartControlSecurityApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Smart Control Security'), findsOneWidget);
    expect(find.text('App móvil de control de asistencia'), findsOneWidget);
    expect(find.byIcon(Icons.security), findsOneWidget);
  });
}
