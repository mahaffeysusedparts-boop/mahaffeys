# Operator phone notifications

Open **Settings → Phone notifications**. An administrator can enable any of the listed actions, choose approved recipient accounts separately for each action, and optionally restrict which operators trigger it. Empty operator selection means all approved operators. Save notification rules independently of yard settings. All alerts start disabled.

Supported events: new canonical scrap intakes, successful scrap payment recording, scrap purchase voiding, desk stoplight commands, buying-price saves and price-sheet publication/rollback, customer create/update/merge endpoints, yard-settings saves, and successful sign-ins. Physical light-switch changes are not desk commands. Other operations are not implicitly monitored. Payment/intake retries do not produce another alert when the durable operation was already recorded.

## Register a phone

1. Open the deployed app's trusted **HTTPS** address on the recipient's phone. Sign in as that recipient, not as the operator whose actions are being monitored.
2. On iPhone/iPad, use iOS/iPadOS 16.4 or later, add the app to the Home Screen, and open it from there. On Android, use a browser with Web Push support, such as Chrome.
3. Open Settings → Phone notifications and choose **Enable on this phone**. Accept the browser's permission prompt.
4. Choose **Send test notification** and check the phone. Each account can register up to five devices. Use **Disable on this phone** before handing a phone/browser to someone else.

No phone number, paid SMS provider or Firebase account is needed. Standard encrypted Web Push uses the browser's own push service. HTTPS, internet connectivity and notification permission are required. Native Capacitor application push is not covered by this browser-based feature.

## Delivery and privacy

Notifications identify the operator and action, but do not include customer identity documents, addresses, purchase amounts, or record details. They can appear on a lock screen. Tapping opens the authenticated app, where normal account permissions still apply. Only administrators edit rules; any approved account can register or disable its own device and send a rate-limited test to its own registered devices. Disabled/deleted accounts do not receive messages. Expired subscriptions are removed when their push service rejects them.

Delivery is best-effort: a push service accepting a message is not proof the phone displayed it. Messages expire after one hour; permissions, phone power settings or connectivity may delay/prevent them. Operator actions remain successful if notification delivery fails. This is not a safety alarm or guaranteed audit-delivery system. Local development previews never send real push messages, including test notifications.

## Server storage and deployment

The server automatically generates one persistent VAPID key pair in `push_server_keys`; the private key never goes to the browser. Rules are stored in `phone_notification_rules`, and user-owned subscriptions in `phone_push_devices`. These private tables are not public app-state records and are not included in the yard-record JSON export. Preserve them in protected full PostgreSQL backups; losing/rotating the VAPID key requires phones to unsubscribe and register again. The optional server-only `NITRO_PUSH_SUBJECT` sets a VAPID contact URL or mailto address; its default is the yard website URL.

Allow outbound HTTPS to supported browser push endpoints: `fcm.googleapis.com`, `updates.push.services.mozilla.com`, and `web.push.apple.com`. Subscription registration rejects other hosts to prevent arbitrary server-side requests. Deploy the updated app and service worker over HTTPS before enrolling real phones. This feature does not deploy or modify the live yard server automatically.
