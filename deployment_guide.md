# Stumped — Production Deployment & Google Sign-In Guide

This guide outlines the exact, step-by-step instructions for setting up **Google Sign-In** credentials and deploying the NestJS backend securely through a **Cloudflare Tunnel** to `api-stumped.adkdev.in`.

---

## 1. Google Sign-In Configuration

To enable real Google Sign-In authentication in production, you must link the mobile app client to your Google Cloud Console project.

### Step 1: Extract SHA-1 Certificate Fingerprint

You need the SHA-1 fingerprint of the keystore used to sign the APK.

- **For Local Debug / Testing Builds**:
  Run this command in your terminal to view the debug certificate fingerprint:
  ```bash
  keytool -list -v -keystore mobile/android/app/debug.keystore -alias androiddebugkey -storepass android
  ```
  Look for the `SHA1:` line in the output (e.g. `SHA1: DE:AD:BE:EF:00:11:22:33...`).
- **For Production / Release Builds (Google Play Store)**:
  If you do not have a release keystore yet, generate one by running:

  ```bash
  keytool -genkeypair -v -storetype PKCS12 -keystore release.keystore -alias stumped-release-key -keyalg RSA -keysize 2048 -validity 10000
  ```

  Move the generated `release.keystore` file to `mobile/android/app/`.

  To view the release certificate fingerprint, run:

  ```bash
  keytool -list -v -keystore mobile/android/app/release.keystore -alias stumped-release-key
  ```

  Extract the SHA-1 of your release keystore from the output, or copy the **App signing certificate SHA-1 fingerprint** directly from the Google Play Console under **Setup > App Integrity**.

### Step 2: Configure Google Cloud Console

1. Open the [Google Cloud Console Credentials Page](https://console.cloud.google.com/apis/credentials).
2. Create or select your Stumped project.
3. Configure the **OAuth Consent Screen**:
   - Choose **External**.
   - Fill out the app name, support email, and developer contact details.
   - Add the scope `.../auth/userinfo.email` and `.../auth/userinfo.profile`.
4. Create **Android Client Credentials**:
   - Click **+ Create Credentials** > **OAuth client ID**.
   - Select **Android** as Application Type.
   - Enter the Package Name: `com.adkdinesh.stumped`.
   - Paste the **SHA-1 fingerprint** extracted in Step 1.
   - Click **Create**.
5. Create **Web Application Client Credentials** (for Server Auth):
   - Even though it's a mobile app, Google Sign-In uses a Web Client ID to securely verify the native ID Token on the NestJS server.
   - Click **+ Create Credentials** > **OAuth client ID**.
   - Select **Web Application** as Application Type.
   - Set Name: `Stumped Web Backend Client`.
   - **Authorized JavaScript origins & Authorized redirect URIs**: Leave both of these sections **completely empty / blank**. (Since the token is generated on the native mobile app and sent directly to the NestJS API via HTTP payload, no browser redirect callbacks are required).
   - Click **Create**.
6. Copy the resulting **Web Client ID** (looks like `123456-abcdef.apps.googleusercontent.com`).

### Step 3: Configure NestJS Environment Variables

Add the Web Client ID to the `.env` file of the backend:

```env
GOOGLE_CLIENT_ID=123456-abcdef.apps.googleusercontent.com
```

---

## 2. Cloudflare Tunnel Backend Deployment

We support deploying the NestJS backend inside a Docker container. This allows the backend to run in isolation, auto-restart on failures, and route securely through your existing Dockerized `cloudflared` tunnel container.

### Method A: Dockerized Deployment (Recommended)

1. **Prerequisites**:
   * An existing `mysql` database container running on network `mysql_mysql_net`.
   * An existing `cloudflare-tunnel` (`cloudflared`) container running on network `cloudflare-net`.

2. **Configure Environment variables**:
   Ensure `backend/.env` is set up with your Google Client ID, JWT Secret, and database credentials (the database URL will be overridden inside the docker compose setup to use container networking).

3. **Start the Backend Container**:
   Run the following command at the workspace root to build and start the NestJS container in the background:
   ```bash
   docker compose up -d
   ```
   * The container is named `stumped-backend`.
   * It exposes local port `3005` (custom unique port).
   * It is configured with `restart: always` to guarantee auto-restart.
   * It is automatically connected to `mysql_mysql_net` (enabling connection to MySQL at hostname `mysql`) and `cloudflare-net` (enabling routing via `cloudflare-tunnel`).

4. **Route the Cloudflare Tunnel**:
   Since your `cloudflare-tunnel` container is remotely managed via the Cloudflare Zero Trust Dashboard:
   * Go to the [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/).
   * Select **Networks** > **Tunnels** and select your active tunnel.
   * Go to **Public Hostnames** and add or edit the hostname for `api-stumped.adkdev.in`.
   * Map it to the following internal URL:
     * **Type**: `HTTP`
     * **URL**: `stumped-backend:3005`
   * Click **Save hostname**.

---

### Method B: Traditional Bare-Metal Deployment

If you are running the backend service natively on the host:

1. **Install cloudflared**:
   ```bash
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared.deb
   ```

2. **Authenticate & Create Tunnel**:
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create stumped-tunnel
   cloudflared tunnel route dns stumped-tunnel api-stumped.adkdev.in
   ```

3. **Configure Ingress (`~/.cloudflared/config.yml`)**:
   ```yaml
   tunnel: a1b2c3d4-e5f6-xxxx-xxxx-xxxxxxxxxxxx
   credentials-file: /home/adkdinesh/.cloudflared/a1b2c3d4-e5f6-xxxx-xxxx-xxxxxxxxxxxx.json
   ingress:
     - hostname: api-stumped.adkdev.in
       service: http://localhost:3005
     - service: http_status:404
   ```

4. **Run cloudflared**:
   ```bash
   sudo cloudflared service install
   sudo systemctl enable cloudflared
   sudo systemctl start cloudflared
   ```

