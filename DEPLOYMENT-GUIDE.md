# John's Shop — Deployment Guide (Render)

This project is a React + Vite storefront served by a small Node.js HTTP server. The same Node process serves the built frontend and `/api/*` endpoints, so deploy it as **one Node web service**, not as a static-only site.

## Important launch status

- A Render Blueprint (`render.yaml`) is included. It configures a Node web service, production build/start commands, `/api/health` health check, and a 1 GB persistent disk mounted at `/var/data`.
- The app stores contact submissions, newsletter signups, and orders in a JSON file. `DATA_DIR=/var/data` makes that file live on the persistent disk instead of Render's temporary filesystem.
- Render persistent disks are available on paid web services. The included `plan: starter` and disk may incur charges. Review current pricing before creating the service. A disk-backed service also has deployment/availability trade-offs, including no zero-downtime deploys; plan for a brief interruption during deploys.
- The app is **not approved for real customer orders yet**. Contact messages are saved but not emailed; newsletter addresses are saved but no campaigns/unsubscribe process exists; checkout saves orders but does not collect payment. GCash and bank transfer are manual-pending selections, not payment integrations.
- Do not switch to a free/ephemeral service while retaining JSON-file persistence: files can disappear on restart or redeploy. For a larger shop, migrate persistence to managed PostgreSQL before launch.

## 1. Prepare the project

1. Extract the project ZIP on a computer.
2. Create a private Git repository and upload the project files. Do not upload `.env`, credentials, `node_modules`, `dist`, or the `data/` folder. `.gitignore` already excludes these. There is currently no `package-lock.json`; after a successful local `npm install`, commit the generated lockfile so future deployments use reproducible dependency versions.
3. Confirm `render.yaml` is at the repository root.
4. Run locally if you have Node.js 22 installed:

   ```sh
   npm install
   npm test
   npm run build
   npm start
   ```

5. Visit `http://localhost:3001` and `http://localhost:3001/api/health`. The health endpoint should return `{"ok":true}`.

## 2. Create the Render service

1. Sign in to Render and choose **New → Blueprint** (or create a Web Service and copy the settings below).
2. Connect the private Git repository containing this project.
3. Review the detected Blueprint settings. Expected values:
   - Runtime: Node
   - Build command: `npm install --no-audit --no-fund && npm run build`
   - Start command: `npm start`
   - Health check path: `/api/health`
   - Node version: `22` (also pinned in `.node-version`)
   - `DATA_DIR`: `/var/data`
   - Persistent disk mount path: `/var/data`
4. Keep the persistent disk attached. The included Blueprint requests 1 GB and a paid Starter web service; check Render's current price and region before confirming.
5. Create/deploy the service and watch the build and runtime logs. A successful build alone is not proof that the store is ready for real sales.

Render's web services need to listen on `0.0.0.0` and the port supplied by `PORT`; this project now does so. Render terminates incoming TLS and provides HTTPS for its service domain and configured custom domains.

## 3. Environment variables and secrets

The included deployment only requires:

| Variable | Value | Secret? | Purpose |
|---|---|---:|---|
| `DATA_DIR` | `/var/data` | No | Stores the JSON data file on the persistent disk. |
| `PORT` | Supplied by Render | No | HTTP port. Do not hard-code it. |
| `NODE_VERSION` | `22` | No | Selects the Node runtime. |

No payment, email, or database credentials are currently required by the source. If you later add an email or payment provider, create its secret in Render's Environment settings and read it only in server-side code. Never place private credentials in React code or variables prefixed with `VITE_`; Vite-prefixed values can be exposed to browsers. Never commit real `.env` files. After changing environment variables, trigger a new deployment so the build/runtime receives the new values.

## 4. Connect a custom domain

1. Buy/register a domain through a registrar of your choice. You do not need to share registrar passwords with anyone helping you.
2. In Render, open the service's **Settings → Custom Domains** and add both the root domain (for example, `example.com`) and `www.example.com` if you want both.
3. Render will show the exact DNS records required for your domain. Sign in to your registrar's DNS manager and copy those records exactly. Do not guess at A, AAAA, or CNAME values; use the values shown in your Render dashboard.
4. Return to Render and wait until the domain is verified and its TLS certificate is issued.
5. Test both `https://example.com` and `https://www.example.com`. Choose one canonical version and configure a redirect for the other in Render if desired.

DNS changes can take time to propagate. Keep the Render-provided `onrender.com` address for testing until the custom domain is verified.

## 5. HTTPS

Render provides managed TLS for web services and custom domains. Do not upload private keys into the React app. After certificate issuance, confirm the browser shows a secure connection and that HTTP redirects to HTTPS. Do not advertise the custom domain until Render reports it verified and HTTPS is working.

## 6. Live smoke-test checklist

After deployment, test using the actual Render URL first, then the custom domain:

- [ ] Homepage loads without a blank screen or missing assets.
- [ ] `/api/health` returns HTTP 200 and `{"ok":true}`.
- [ ] Search and category filters work.
- [ ] Add/remove products and quantity changes work in the cart.
- [ ] Invalid contact/newsletter/checkout submissions show validation errors.
- [ ] Submit one clearly marked test contact message and newsletter address; confirm the UI only shows success after an API success response.
- [ ] Submit a test order with a clearly identified test customer; verify the order is saved and the expected payment status is shown. Remove test personal data afterwards using a controlled admin/data process (no admin UI is currently included).
- [ ] Restart/redeploy the service, then verify the test data still exists. This confirms `DATA_DIR` is actually mounted on the persistent disk.
- [ ] Test on phone, tablet, and desktop; test keyboard-only navigation and 200% zoom.
- [ ] Check browser developer console and Render logs for errors.
- [ ] Confirm no real customer data or secrets are present in the repository or browser source.

## 7. Updating products and content

Current product names, prices, and the server-side order catalogue are sample data embedded in `src/main.jsx` and `server.js`. Update both places together so the storefront display and server-verified prices stay in sync. Replace sample product imagery/content in the frontend, then run tests and a production build. There is no admin dashboard or CMS yet; product edits currently require a code change and redeployment. Keep a copy of the current product list before editing.

For each update:

1. Make the change on a branch, not directly on the production branch.
2. Run `npm test` and `npm run build` locally.
3. Push the branch and review its Render preview/deploy if enabled, or deploy to a separate test service.
4. Check all visitor journeys and forms before merging to the production branch.
5. Confirm the production health endpoint and perform a small live smoke test after deployment.

## 8. Roll back a bad update

1. Open the Render service's **Events/Deploys** page.
2. Find the last known-good deployment.
3. Use Render's rollback/redeploy controls to restore that deployment, following the dashboard prompts.
4. Check `/api/health`, homepage, and forms after rollback.
5. Fix the issue on a branch and repeat the preview/build tests before deploying again.

Important: application rollback does not undo changes to customer data stored on the persistent disk. Back up the data file securely before maintenance or schema changes. Persistent-disk services have deployment/availability trade-offs; for more demanding availability and data integrity, use a managed database with tested backups.

## 9. Account and data responsibility

Hosting, domain registration, payment-provider accounts, and handling customer personal information can involve billing, contracts, and legal responsibilities. Have a parent/guardian or responsible business adult own and review those accounts and the privacy/payment setup. Never share account passwords or one-time codes in chat or in the repository.

## 10. Launch blockers still open

Before accepting real customers, complete all of the following:

- Replace sample products, prices, and product images with accurate inventory.
- Add an order-management process so someone can review, fulfill, cancel, and refund orders.
- Configure real GCash/bank transfer instructions and reconciliation, or integrate an authorized payment gateway server-side with signed webhook verification. Current checkout does not charge anyone.
- Add email notifications for store staff and customers; contact form currently only stores messages.
- Connect a mailing provider and add consent records, unsubscribe handling, and a privacy-compliant newsletter workflow.
- Replace JSON-file storage with managed PostgreSQL or another supported durable database before multi-instance/high-volume use. JSON storage is not a robust production database.
- Add authenticated admin access, stronger abuse controls, monitoring, secure backups, and a tested restore procedure.
- Publish a privacy notice, terms, shipping/returns policy, and data-retention process appropriate to the business and local requirements.
- Complete browser-based responsive, accessibility, and end-to-end testing on real devices.

## Official Render documentation

- Web services: https://render.com/docs/web-services
- Persistent disks: https://render.com/docs/disks
- Health checks: https://render.com/docs/health-checks
- Custom domains: https://render.com/docs/custom-domains
- Deploys: https://render.com/docs/deploys
