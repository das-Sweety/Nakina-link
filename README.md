# Nakina Link 🧭
**Order. Pack. Fly.**

Thunder Bay AI Hackathon (September 2026), Zamiigo / Wilderness North challenge

Team **Six Seven**: Sweety Das and Priyanshu Naik

Nakina Link carries household grocery orders from a retail store to the aircraft for
fly-in First Nations communities in Northwestern Ontario: Webequie, Summer Beaver
(Nibinamik) and Neskantaga.

**Live app:** https://nakinalink.netlify.app/  · **Demo video:** https://drive.google.com/file/d/1Mw4KQ6RccIWX4xIxODwrg5FXg19i2JLo/view 

## The problem
Zamiigo combines household orders into one retailer order and flies them out of Nakina.
Staff re-enter every order by hand, each household gets its own half-empty tote, and every
pound on the plane matters. Each household's items must also stay separate for the
Nutrition North subsidy.

## What it does
| Tab | What it does |
|---|---|
| **Order entry** | A retailer-ready entry for every household, with status tracked from Entered to Delivered |
| **Order picking** | Packs households into shared totes, assigns carts, and builds aisle-by-aisle pick lists |
| **Flight management** | Plans each load against the route's payload and cabin space, compares routes, and prints manifests |
| **Picker mode** | A phone view for store pickers: tap to pick, flag out of stock |

## Results on the challenge data
- **30 households in 10 totes:** 67% fewer than one tote each, within 1 of the theoretical minimum
- **Three communities in one loop:** 2 h 59 min instead of 6 h 55 min, about 1,700 lb less fuel
- **Cessna 208B cabin model:** stacking that holds exactly 90 totes, matching Wilderness North's figure

## How it works
- **Packing:** best-fit decreasing with a compaction pass; totes capped at 50 lb and 90% of volume
- **Payload:** flight time = miles ÷ 170 mph + 6 min per take-off and landing;
  fuel = 176 lb + 349.5 lb per hour; payload = 3,923 lb − fuel (reproduces the sponsor's figures)
- **Routes:** every grouping of communities is compared, and the fewest flight hours wins

## Files
| File | Purpose |
|---|---|
| `index.html` | The complete app; open it in a browser or deploy it anywhere |
| `app.js` | All the logic: packing, carts, flights, routes, picker mode |
| `shell.html` | Layout and styles |
| `build.py` | Rebuilds `index.html` from `shell.html` and `app.js` (needs the challenge data files) |

## Run it
Open `index.html` in a browser, or drag the folder onto [Netlify Drop](https://app.netlify.com/drop).

---
*Challenge data belongs to Wilderness North / Zamiigo and is used here for the hackathon only.*
