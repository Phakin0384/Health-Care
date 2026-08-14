import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';

// Set EXPO_PUBLIC_SERVER_URL when the computer's LAN IP is not detected.
const configuredUrl = process.env.EXPO_PUBLIC_SERVER_URL;

export default function App() {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const url = useMemo(() => configuredUrl || 'http://192.168.1.100:3000', []);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      {failed ? (
        <View style={styles.message}>
          <Text style={styles.title}>Unable to connect</Text>
          <Text style={styles.body}>
            Start the web server with npm run dev and set EXPO_PUBLIC_SERVER_URL to your computer's LAN address.
          </Text>
          <Text style={styles.url}>{url}</Text>
        </View>
      ) : (
        <WebView
          source={{ uri: url }}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setFailed(true); }}
          javaScriptEnabled
          domStorageEnabled
          allowsBackForwardNavigationGestures
          originWhitelist={['http://*', 'https://*']}
          setSupportMultipleWindows={false}
          mixedContentMode="always"
          style={styles.webview}
        />
      )}
      {loading && !failed && (
        <View style={styles.loading}><ActivityIndicator size="large" color="#005eb8" /></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  webview: { flex: 1 },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  message: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#003b71', marginBottom: 12 },
  body: { textAlign: 'center', color: '#5c6f8a', lineHeight: 22 },
  url: { marginTop: 16, color: '#005eb8', fontWeight: '600' }
});
