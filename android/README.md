# WASSAFRICA Android

## Architecture

This module packages the production WASSAFRICA web app as a Trusted Web Activity (TWA).
The Android container does not duplicate business logic; the web app remains the source of truth.

- Production origin: https://wassafrica.vercel.app/
- Android package: `com.wassafrica.app`
- Compile SDK: 36
- Target SDK: 36
- Minimum SDK: 23
- Android Browser Helper: 2.7.3

## Build

The repository contains a GitHub Actions workflow at `.github/workflows/android-aab.yml`.
It builds a debug AAB and can build an unsigned release AAB for packaging checks.

## Release signing

Release signing is intentionally not committed to the repository. The production keystore,
passwords, and release certificate SHA-256 fingerprint must be supplied through protected
CI secrets before a Play Store release.

## Digital Asset Links

`.well-known/assetlinks.json` is a release-signing template. Replace
`REPLACE_WITH_RELEASE_CERT_SHA256` with the SHA-256 certificate fingerprint of the exact
release key used by Google Play before production Trusted Web Activity verification.

## Publication gate

Android packaging may be prepared independently, but publication is blocked until the core
messaging path is certified end-to-end in production: Account A -> send -> persistence ->
Account B receive/decrypt.
