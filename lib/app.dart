import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:jaspr/jaspr.dart';
import 'package:jaspr/dom.dart';

class App extends StatefulComponent {
  const App({super.key});

  @override
  State<App> createState() => _AppState();
}

class _AppState extends State<App> {
  Map<String, dynamic>? _versions;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetchVersions();
  }

  Future<void> _fetchVersions() async {
    try {
      // In production, this path will be intercepted by Firebase Hosting rewrites.
      // In development, you might need to use the emulator URL.
      // Using relative path for the rewrite:
      final response = await http.get(Uri.parse('/api/versions'));
      
      if (response.statusCode == 200) {
        setState(() {
          _versions = json.decode(response.body);
          _loading = false;
        });
      } else {
        setState(() {
          _error = 'Failed to load versions (HTTP ${response.statusCode})';
          _loading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Failed to fetch versions: $e';
        _loading = false;
      });
    }
  }

  @override
  Component build(BuildContext context) {
    return div(classes: 'container', [
      header([
        h1([.text('Flutter Supported Android Versions')]),
        p([.text('Minimum and maximum fully supported versions of Gradle, AGP, and KGP in Flutter.')]),
      ]),
      
      if (_loading)
        div(classes: 'loading', [.text('Loading versions...')])
      else if (_error != null)
        div(classes: 'error-text', [.text(_error!)])
      else if (_versions != null)
        _buildTable(),
        
      if (_versions?['lastUpdated'] != null)
        div(classes: 'timestamp', [
          .text('Last updated: '),
          .text(_formatDate(_versions!['lastUpdated']['_seconds'])),
        ]),
    ]);
  }
  
  String _formatDate(int seconds) {
    final date = DateTime.fromMillisecondsSinceEpoch(seconds * 1000);
    return date.toLocal().toString().split('.')[0];
  }

  Component _buildTable() {
    final gradle = _versions!['gradle'];
    final agp = _versions!['agp'];
    final kgp = _versions!['kgp'];
    final java = _versions!['java'] ?? {'warn': '17', 'error': '17'};
    final minSdk = _versions!['minSdk'] ?? {'warn': '24', 'error': '23'};

    return div(classes: 'table-wrapper', [
      table([
        thead([
          tr([
            th([.text('Dependency')]),
            th([.text('Minimum Supported (Error below)')]),
            th([.text('Fully Supported (Warn above)')]),
          ]),
        ]),
        tbody([
          tr([
            td([.text('Kotlin Gradle Plugin (KGP)')]),
            td([_versionBadge(kgp['error'], isError: true)]),
            td([_versionBadge(kgp['warn'])]),
          ]),
          tr([
            td([.text('Gradle')]),
            td([_versionBadge(gradle['error'], isError: true)]),
            td([_versionBadge(gradle['warn'])]),
          ]),
          tr([
            td([.text('Android Gradle Plugin (AGP)')]),
            td([_versionBadge(agp['error'], isError: true)]),
            td([_versionBadge(agp['warn'])]),
          ]),
          tr([
            td([.text('Java')]),
            td([_versionBadge(java['error'], isError: true)]),
            td([span(attributes: {'style': 'color: var(--text-secondary); font-size: 0.85rem;'}, [.text('N/A (No upper bound)')])]),
          ]),
          tr([
            td([.text('Minimum Android SDK')]),
            td([_versionBadge(minSdk['warn'], isError: true)]),
            td([span(attributes: {'style': 'color: var(--text-secondary); font-size: 0.85rem;'}, [.text('N/A (No upper bound)')])]),
          ]),
        ]),
      ]),
    ]);
  }
  
  Component _versionBadge(String? version, {bool isError = false}) {
    if (version == null) return .text('Unknown');
    return span(
      classes: 'badge ${isError ? 'badge-error' : 'badge-warn'}', 
      [.text(version)]
    );
  }
}
