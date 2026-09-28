Nakina Link - Order. Pack. Fly.
Fulfillment for Zamiigo (Wilderness North hackathon, including the bonus objective)

DEPLOY (1 minute):
1. Go to https://app.netlify.com/drop
2. Drag this whole "nakina-link" folder onto the page.
3. Share the URL it gives you. index.html is the entire app (no server needed).
To update an existing Netlify site: open the site > Deploys > drag the folder in again.

USING IT:
- Drop the orders CSV (and a flight capacity CSV, if any) onto the welcome screen.
  Files are told apart automatically by their columns. Each orders CSV becomes a batch.
- Orders for Webequie, Summer Beaver and Neskantaga (Landsdowne House) are packed into
  their own totes and planned on each route's own payload (2,877 / 2,887 / 3,062 lb).
- Flight management > Route plan tests every pair of communities on one trip against two
  separate flights, compares every way to fly the batch, picks the fewest flight hours,
  and sequences the departures with clock times. Staff can choose another plan.
- Payload method: flight hours = statute miles / 170 mph + 6 min per take-off and landing;
  fuel = 176 lb + 349.5 lb per hour (matches the sponsor's three routes exactly);
  payload = 3,923 lb - fuel.
- With a flight capacity CSV (Stage 2 style), departures are planned by date instead.

PICKER MODE opens automatically on phones; on desktop use "Picker mode" in the sidebar.

source/ holds the editable code: app.js (logic), shell.html (layout + styles),
build.py (rebuilds index.html; it embeds the product reference list and the challenge samples).
