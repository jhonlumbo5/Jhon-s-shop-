# John's Shop — storefront with a local API

A colorful, responsive React + Vite storefront for clothes, shoes, bags, gadgets and accessories.

## Run locally

1. Install Node.js 18 or newer.
2. In this folder, run `npm install`.
3. Run `npm run dev` and open the Vite URL printed in the terminal (usually `http://localhost:5173`). The Node API runs on port 3001.
4. Run `npm run build` to create the production site in `dist/`.
5. Run `npm start` to serve the production build and API on port 3001 (or the `PORT` environment variable).

## Working features

- Product search and category filters run in the browser against the sample catalogue.
- Contact form validates in the browser and again on the server, then saves messages to `data/submissions.json`.
- Newsletter form validates in the browser and server, prevents duplicate email subscriptions, and saves subscribers to the same file.
- Checkout validates customer details and cart items on the server, checks product IDs and prices against the server-side catalogue, and saves orders to `data/submissions.json`.
- Loading, success, and error states are shown for contact and newsletter submissions. Checkout shows a confirmation only after the server returns a successful save.
- Basic per-IP request throttling and a hidden honeypot field are included.

## Important production notes

This local API makes the forms and order submission genuinely work in a local/self-hosted Node deployment. It stores personal details and orders in a local JSON file; protect the server and its `data/` directory, back it up securely, and provide a privacy notice and retention policy before collecting real customer information. The JSON-file store is suitable only for a small demo or single-server starter, not a multi-instance/high-volume shop. For production, move persistence to a managed database and add stronger abuse protection, authentication/admin access, HTTPS, backups, and operational monitoring.

The contact form currently saves messages; it does not email the store owner. To send email notifications, connect a provider such as Resend, SendGrid, or an SMTP service from the server only. Put provider credentials in server environment variables (never in React/Vite `VITE_` variables or frontend code) and configure a verified sender domain.

Newsletter subscriptions are stored locally; no campaign emails are sent. For mailing campaigns, connect a provider such as Mailchimp or Brevo using server-side credentials, confirm the sender/list, and add an unsubscribe workflow.

Checkout stores order details but does not charge customers. Cash on Delivery orders are saved as pending confirmation. GCash and bank transfer selections are saved as awaiting manual payment instructions; configure your verified merchant details and an order confirmation workflow before enabling these for real sales. For automatic payments, integrate an authorized provider (for example, PayMongo or Xendit) on the server, use its hosted/redirect checkout or tokenized flow, verify signed webhooks server-side, and never collect or store PINs, passwords, or OTPs.

No booking feature is included because this is a product store. Product names, sample prices and product visuals are demo content; replace them with accurate inventory and real product photography before launch.

## Mobile and accessibility refinements

The storefront includes responsive layouts for small phones, larger phones, tablets, and desktop widths; 44px minimum targets for common controls; 16px form-control text to avoid mobile browser zoom-on-focus; keyboard-visible focus rings; a skip-to-content link; labelled navigation and search; Escape-to-close behavior and basic focus containment for the cart and checkout dialogs; and reduced-motion support. No live device/browser preview was available during this update, so verify the manual checks below before launch.

### Manual responsive QA checklist

Test at approximately 320px, 360px, 390px, 768px, 1024px, and 1440px wide, plus 200% browser zoom:

- Confirm there is no horizontal page scrolling; check the hero artwork, category chips, product cards, footer, and success banner.
- Open and close the mobile menu using touch, Enter, Space, and Escape; follow each link and confirm the menu closes.
- Use Tab and Shift+Tab from the top of the page. Confirm the skip link and visible focus ring work.
- Open the cart and checkout; confirm focus starts inside, stays within the dialog while tabbing, and Escape closes it.
- Confirm product names, prices, category filters, and all form fields remain readable and operable without clipping.
- Submit contact, newsletter, and checkout forms at narrow widths; confirm buttons and validation messages do not overflow.
- Enable the operating system's reduced-motion setting and confirm smooth scrolling and hover movement are minimized.
- Check the site with text enlarged and at 200% zoom; content should reflow rather than require two-dimensional scrolling.


## QA checks

Run `npm test` to execute the automated Node test suite. It starts an isolated API process with a temporary data directory and checks health, contact validation and persistence, newsletter validation and duplicate handling, server-priced order totals, honeypot rejection, and saved-record counts. Static source checks verify in-page navigation targets, required responsive breakpoints, reduced-motion support, and the document viewport.

### QA status for this handoff

- Automated API tests: 6 passing.
- Static source checks: included in the test suite.
- Browser-based visual/device testing: not run in this environment because dependencies could not be installed and the React app could not be built/launched.
- Production readiness: not approved. Real contact details, product data/photos, privacy notice, secure database, order administration, payment instructions/provider integration, and deployment HTTPS still need configuration.


## Deployment preparation

See [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md) for the included Render Blueprint, environment configuration, domain/HTTPS setup, live smoke tests, content updates, rollback steps, and launch blockers. The project is not yet live; a successful production build and real deployment still need to be completed.
