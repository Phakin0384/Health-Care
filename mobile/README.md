# Health Care Expo Go client

This is a lightweight Expo Go wrapper around the existing Next.js app. Both devices must be on the same Wi‑Fi network.

1. Start the web server from the project root: `npm run dev`.
2. Find the computer's LAN IPv4 address (`ipconfig` on Windows).
3. From this directory run `npm install` and then:

   ```bash
   $env:EXPO_PUBLIC_SERVER_URL="http://YOUR_LAN_IP:3000"
   npx expo start
   ```

4. Scan the QR code with Expo Go. Do not use `localhost` on the phone; it refers to the phone itself.
