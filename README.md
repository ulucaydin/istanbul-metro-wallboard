# İstanbul Metro Wallboard

An independent browser display for 22 Istanbul rail services across five selectable transport types. The metro layer has 11 lines and 157 distinct station or interchange markers. All layers together have 280 mapped nodes. It shows the Istanbul clock, a geographic network map, full station lists, and dated notices published by the operator. The diagram uses a simplified OpenStreetMap coastline and track geometry, and station lamps set into a brushed-metal face with a walnut-style frame.

## Run from source

Install Node.js 22.12+ or 24 LTS and run the following in the extracted source directory.

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open the URL printed by Vite. For the production build with offline reload support:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

The dashboard uses vanilla JavaScript, CSS and SVG. Vite builds the static assets and generates a versioned service worker for the offline app shell. The fonts ship with the app. The default dashboard runs without environment variables, credentials, API keys, or application servers.

## Set up a wall display

Serve the contents of `dist/` or the extracted static bundle over HTTP on the display computer's loopback address. For example, run this from the source directory after building:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

For the static bundle, run that command from the folder containing `index.html` with `--directory .`. A remote static host should serve the files over HTTPS. Open the page online once and allow it to finish loading so the offline app shell can install. A first visit requires the files to be reachable.

Move the pointer, tap, or use Tab to reveal the settings button. Select lines and text size, then choose **Enter fullscreen**. Route badges open station sequences and transfers. In **Display settings**, combine **Metro**, **Marmaray**, **Tram**, **Funicular & Tünel**, and **Sirkeci local rail**. Expand **Individual lines** to refine the selection. New installations start with Metro selected. Existing selections are preserved. Turn on **Map-only view** in **Display settings** to fill the window with the map and its key. The gear stays in the upper-right corner, and the map key shows the tracking or simulation status. The preference is saved in this browser. Use + and − to zoom, drag or use arrow keys to pan, and select the reset arrow to fit the visible routes. Choose **Dark** under **Map finish** for a darker metal face. The finish is saved on this browser. For a dedicated screen that should start in fullscreen after reboot, add the static server and a kiosk browser shortcut to the operating system's login startup. Start the server before the browser. On a Chromium desktop where the executable is `chromium`:

```sh
chromium --kiosk http://127.0.0.1:4173/
```

On macOS with Google Chrome installed:

```sh
open -na "Google Chrome" --args --kiosk http://127.0.0.1:4173/
```

Use the display's orientation setting and the operating system's power settings for a continuously lit screen. The local build works without a sign-in. The private Sites preview requires the owner's authenticated session.

## Run the train simulation

In **Display settings → Map view**, choose **Metroboard view** for an engraved rail diagram on brushed metal. **Light** uses aluminum and **Dark** uses graphite. Metroboard view works with either the full dashboard or **Map-only view**. The browser saves your view choice and initially opens in **Geographic**. A station pair has one lamp per travel direction. The one-way Moda loop uses a single lamp. A live stopped observation with unspecified direction lights the center of a pair. Zoom in to read more station labels, or open a route badge in the full dashboard for its complete stop list.

Open **Display settings**, choose **Istanbul now**, **Weekday rush hour**, or **Weekend overnight** under **Train simulation**, and select **Start simulation**. Presets start at 08:20 or 01:20 Istanbul time and advance at normal speed. The header clock continues to show actual Istanbul time. The footer labels the simulation and shows its modeled time. Open settings again to stop it or change the scenario. Reloading the board ends the simulation.

In both views, the next station's lamp pulses while a train is in transit and glows steadily on arrival. On departure the indication moves to the next stop. If trains share a lamp, a stopped train takes precedence over an approaching train. Choose **Display settings → In-transit lights → Solid** to keep the next station's lamp fully lit during travel. The browser remembers this choice and defaults to **Pulsing**. With reduced motion enabled, Pulsing mode uses a dim, steady light for approaches.

The model dispatches trains in both directions, includes the M1 branches and Seyrantepe shuttle, and uses faster weekday peak service, lighter evening service, and limited weekend Night Metro coverage. It uses published line-level journey times and modeled departure intervals, station dwell, and interstation timing. The simulation allocates modeled running time across the mapped track lengths and uses published segment times where available. A trip ends after its terminal dwell. When the selected lines have no modeled trains in service, the board shows **No active trains**. Marmaray includes the full Halkalı–Gebze service, additional Ataköy–Pendik runs, and a modeled four-minute Bosphorus crossing. The Moda tram runs its one-way loop. The extra routes use operator stop sequences and approximate service intervals. The model omits disruptions, special-event timetables, and real fleet assignments. [Metro İstanbul line information](https://www.metro.istanbul/Hatlarimiz?hatturu=metro) · [Night Metro](https://www.metro.istanbul/en/content/Gece-Metrosu) · [M11 service](https://www.uab.gov.tr/haberler/rekorlar-pes-pese-geldi/) · [M11 segment timing](https://www.uab.gov.tr/haberler/tuerkiye-nin-en-uzun-metro-ringinin-son-halkasi-tamamlandi/)

## What the data means

| Dashboard information | Source and coverage |
| --- | --- |
| Map and station order | A bundled snapshot reviewed on 11 November 2026, covering M1A, M1B, M2–M9, and M11. Metro İstanbul and the Ministry of Transport publish the underlying station, interchange, and opening information. |
| Istanbul clock | The device clock formatted for `Europe/Istanbul`. Keep the device clock synchronized. |
| Published notices | A dated, manually maintained snapshot of operator notices. The included M7 repair notice is historical reference and current service is unconfirmed. |
| Train locations and predicted arrivals | Unavailable in the default deployment. A verified public Istanbul metro position or prediction feed could not be confirmed. |
| Schedules and current service | Schedules are available from the operator. The dashboard links to the operator's announcements for current information. No automated operational feed is configured. |

**Published** means the app successfully fetched a valid notice snapshot. **Delayed** means it is showing an earlier download after a failed refresh or loss of connectivity. **Unavailable** means there is no successful download to display. The last successful fetch is displayed in Istanbul time. Each notice has a separate publication date.

The app fetches `service-notices.json` on startup and every 10 minutes after success. Requests time out after eight seconds. Failures retry after 30 seconds and double the interval up to 10 minutes. Browser reconnect events trigger an immediate retry when a request is idle. The app keeps one request and one subsequent poll scheduled at a time. Offline reloads use the cached app shell and last valid notice snapshot. The app shell cache excludes notice requests so a cache hit cannot advance the fetch time.

### Publish a notice update

Edit `public/service-notices.json` for the next build, or replace the same-named file beside `index.html` on an existing static host. Apply the replacement atomically or use a new deployment so clients never receive partially written JSON. Set `Cache-Control: no-store` on the notice file if the host supports response headers. Serve the file from the same origin as the dashboard.

Use this shape for a snapshot. The dates are calendar dates in `YYYY-MM-DD` format.

```json
{
  "snapshotDate": "2026-11-11",
  "notices": [
    {
      "id": "metro-istanbul-m7-repairs-2026-04-27",
      "lines": ["M7"],
      "publishedDate": "2026-04-27",
      "title": "Mecidiyeköy repair works",
      "summary": "Metro İstanbul published a change to M7 service during repairs at Mecidiyeköy. Check the operator for the current arrangement.",
      "url": "https://metro.istanbul/duyuru/detay/m7-yildiz-mahmutbey-metro-hattinda-onarim-calismasi-270426"
    }
  ]
}
```

Use stable, unique IDs, route IDs from the map, concise original summaries and HTTPS source links. An empty `notices` array is valid. Updating the file changes the board on its next successful fetch. Update `src/network.js` and rebuild when verified stations or lines open.

## Connect an authorized station-occupancy source

The private preview and static bundle ship with live tracking disabled. An optional integration can light lamps for fresh operator reports of a train stopped at or heading toward an explicitly identified station. The app uses the GTFS Realtime vehicle stop status definitions. [GTFS Realtime reference](https://gtfs.org/documentation/realtime/reference/#enum-vehiclestopstatus)

1. Verify the source's coverage, update limits, and permission to reuse its data. If it requires credentials, keep them in server-side environment variables and have the server translate the authorized observations into the board's JSON format.
2. Serve `station-occupancy.json` beside `index.html` on the same origin. Preserve the source timestamps and translate the operator's stop and route IDs to IDs in `src/network.js`. Use a complete snapshot of observations for the routes listed in `coveredLines`. An empty `positions` array is valid for a fresh snapshot with no reported positions.
3. Set `"enabled": true` in the deployed `tracking-config.json` and reload the board. In a source build, the file is under `public/`. Serve both JSON files with `Cache-Control: no-store`.

This illustrative response uses fixed timestamps. A production integration must use actual operator observation times.

```json
{
  "observedAt": "2026-11-11T19:00:00Z",
  "coveredLines": ["M4"],
  "positions": [
    {
      "stationId": "kadikoy",
      "lineId": "M4",
      "status": "STOPPED_AT",
      "observedAt": "2026-11-11T18:59:58Z"
    }
  ]
}
```

The board polls the enabled source every 10 seconds, uses a seven-second request timeout, and backs off up to one minute on errors. It extinguishes lamps when observations or the snapshot reach 45 seconds of age, when the source fails, or when the device goes offline. For `STOPPED_AT`, `stationId` identifies the occupied stop. For `INCOMING_AT` and `IN_TRANSIT_TO`, it identifies the explicitly reported next stop. These approaches use the selected In-transit lights setting. Metroboard view uses the center light for directionless live observations on paired platforms. Live status shows the number of lines covered by the operator feed.

## Additional transport layers

| Layer | Routes |
| --- | --- |
| Marmaray | B1 Halkalı–Gebze, with modeled Ataköy–Pendik short turns |
| Tram | T1 Kabataş–Bağcılar, T2 Taksim–Tünel, T3 Kadıköy–Moda, T4 Topkapı–Mescid-i Selam, T5 Eminönü–Alibeyköy |
| Funicular & Tünel | F1 Taksim–Kabataş, F2 Karaköy–Beyoğlu Tünel, F3 Seyrantepe–Vadistanbul, F4 Hisarüstü–Aşiyan |
| Sirkeci local rail | U3/T6 Sirkeci–Kazlıçeşme |

Additional layers cover the services above. The simulation uses these routes to model arrivals and departures. The main route and selected transfer lists are based on operator material. [Metro İstanbul lines](https://metro.istanbul/Hatlarimiz) · [TCDD Marmaray stops](https://www.tcddtasimacilik.gov.tr/marmaray/tr/neredennereye) · [Marmaray service pattern](https://www.uab.gov.tr/haberler/cumhuriyet-in-simgesi-asrin-projesi-marmaray-11-yasinda) · [İETT T2](https://iett.istanbul/RouteDetail?hkod=T2&routename=taksim-tunel) · [İETT Tünel](https://iett.istanbul/icerik/tunel) · [Vadistanbul access](https://www.vadistanbul.com/ulasim) · [Sirkeci–Kazlıçeşme](https://www.uab.gov.tr/haberler/sirkeci-kazlicesme-hatti-2-yasinda/)

## Geographic data and license

Both views draw all 22 routes north-up using OpenStreetMap station-platform coordinates. The Geographic view uses a representative track alignment for both directions and draws the OpenStreetMap coastline. Metroboard view connects the directional station lamps with straight engraved segments and shares coincident platforms on the M1 trunk. Lenses at close platforms within a station shift slightly to keep each direction visible. The ⓘ control contains the map credit and processed data download.

The processed geometry is in `src/geography-data.json` and the built site serves it as `geography-data.json` under the Open Database License (ODbL) 1.0. The snapshot uses the Geofabrik Türkiye extract timestamped 10 November 2026 at 21:21 UTC, supplemented with selected OSM route relations. The extraction and build scripts in `scripts/` need Python with `osmium` and `shapely`. Export `{ lines }` from `src/network.js` as JSON, then run `extract-osm.py <pbf> <intermediate.json> [directory-of-full-relation-json]` and `build-geography.py <intermediate.json> <route-inventory.json> src/geography-data.json`. [Geofabrik Türkiye extract](https://download.geofabrik.de/europe/turkey.html) · [OpenStreetMap contributors and ODbL terms](https://www.openstreetmap.org/copyright)

## Source inventory

- **Network topology.** The public Metro İstanbul line pages provide ordered stations and documented interchanges. The map includes the M1 shared trunk, the M2 shuttle, Yıldıztepe on M3, and the M5 extension. The Ministry and TCDD material establish the M11 alignment and Halkalı opening. The map uses station facts with independent artwork. These sources are checked during map updates. [Metro İstanbul line pages](https://www.metro.istanbul/Hatlarimiz?hatturu=metro) · [Network maps](https://metro.istanbul/YolcuHizmetleri/AgHaritalari) · [M5 opening](https://www.metro.istanbul/haber/detay/m5-hattinin-samandira-merkez-sultanbeyli-etabi-hizmete-acildi-220526) · [M11 opening](https://www.uab.gov.tr/haberler/rekorlar-pes-pese-geldi/) · [M11 operator](https://www.tcddtasimacilik.gov.tr/marmaray/tr/gayrettepe)
- **Operator website.** Metro İstanbul publishes timetables and passenger advisories on public pages. Direct requests from the development environment timed out. A stable automated access contract and polling limits could not be verified. The app links to these pages and contains an original summary of a dated notice. [Timetables](https://metro.istanbul/SeferDurumlari/SeferDetaylari) · [Announcements](https://www.metro.istanbul/en/Announcement/All) · [M7 notice](https://metro.istanbul/duyuru/detay/m7-yildiz-mahmutbey-metro-hattinda-onarim-calismasi-270426)
- **Municipal datasets.** The B40 catalog advertises Metro İstanbul line status and an announcements service under an attribution license. The status resource was unreachable during verification, so its authentication, refresh limits, payload and freshness could not be confirmed. The İBB GTFS listing also timed out. Its cataloged CSV resources describe scheduled transit. [B40 status catalog](https://opendata.b40cities.org/en/dataset/metro-istanbul-hatlarinin-hizmet-durumu-listesi) · [B40 license](https://opendata.b40cities.org/license) · [İBB GTFS listing](https://data.ibb.gov.tr/en/dataset/public-transport-gtfs-data)
- **Independent Parse wrapper.** The advertised endpoint serves disruption status and equipment faults. Its unauthenticated endpoint returned HTTP 401. It requires an `X-API-Key`, costs one credit per successful status call, and is subject to plan limits and upstream rights. It is outside the default build. [Endpoint](https://parse.bot/marketplace/59a32ead-240e-4794-94a2-4d0ac2633619/metro-istanbul-api) · [Pricing and limits](https://parse.bot/pricing) · [Terms](https://parse.bot/terms)

## Verify the build

```sh
npm test
npx playwright install chromium
npm run test:browser
```

To use a local Google Chrome installation, set `BROWSER_CHANNEL=chrome` for the browser test command. The browser suite runs against the production build and writes screenshots under `test-results/`. It checks the geographic map, largest text, station list, and both Metroboard finishes with and without Map-only view at 1920×1080, 1366×768, 1080×1920 and 390×844. It also exercises clock rollover, preferences, fullscreen, validated refresh, malformed responses, outage recovery, duplicate reconnect events, and offline reload. Tracking tests use controlled fixtures to check simulation controls, directional arrivals and departures, a running trip across views, stopped versus incoming observations, neutral occupancy lamps, expiration, and recovery.
