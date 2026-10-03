# Cargo+420

Cash-on-delivery storefront and owner dashboard for Cargo+420 Exclusive Delivery Service.

- `index.html`: public store (21+ age gate, category buttons, shop, checkout, membership, events, service area)
- `admin.html`: owner dashboard, installable as a phone app (PWA). Live orders, customers, drivers and cash, inventory with photo upload, members, events, reports, and settings
- `sw.js` + `manifest.webmanifest`: make the dashboard installable and receive push alerts
- `js/config.js`: Supabase URL, publishable key, and the public push key (all safe to be public)
- `supabase/`: database migration, starter data, and the `notify-order` push function (already applied to the live project; kept here for reference)

## How orders flow
1. A customer checks out. The `place_order` database function checks prices, stock, city minimums and member discounts, and saves the order.
2. The database calls the `notify-order` function, which sends a push alert to every device where the owner turned on alerts.
3. The dashboard updates live, and the owner moves the order through New → Confirmed → Out for delivery → Delivered, then logs the cash when the driver turns it in.

## Hosting
Static site on Render, auto-deployed from `main` in github.com/adventurefuel/cargo420. No build step.
