# Radio stations (90s-focused)

Verified 2026-08-10 via HTTPS GET (audio body received).

## In app (user dropdown)

| # | Label | Full name | URL | Genre |
|---|---|---|---|---|
| 1 | **DesiZone** | DesiZone Radio | `https://www.desizoneradio.com/relay1` | Bollywood / Hindi |
| 2 | **2010s** | Bollywood 2010s | `https://drive.uber.radio/uber/bollywood2010s/icecast.audio` | 2010s Bollywood |
| 3 | **Lofi** | 0nlineradio LO-FI | `https://stream.0nlineradio.com/lo-fi?ref=radiobrowser` | Lofi / chill |
| 4 | **Ghazals** | Gazal Radio London | `https://streaming.webhostnepal.com/8018/stream` | Ghazals |
| 5 | Mixify | Mixify Bollywood | `https://server.mixify.in/listen/listen/radio.mp3` | Bollywood |
| 6 | Love Hits | Bollywood Love | `https://nl4.mystreaming.net/uber/bollywoodlove/icecast.audio` | Bollywood love |
| 7 | Lofi 2 | laut.fm Lofi | `https://stream.laut.fm/lofi` | Lofi fallback |

Removed: Nostalgic Bollywood 90s (`relay3`) — unreliable in-browser.

## Not used (unreliable from this host)

| Name | URL | Issue |
|---|---|---|
| Radio Retro Bollywood 90s | `https://stream-143.zeno.fm/fdgs82xkzhhvv` | HTTP 401 empty body (intermittent) |
| Hits Of Bollywood (Zeno) | `https://stream.zeno.fm/8ty8szwpwfeuv` | Often 401 |

## Truth about free “90s only” streams

Truly nonstop **only-1990s** free HTTPS streams that stay up are rare. DesiZone’s “Nostalgic Bollywood 90s” is the best free match found that (a) names 90s, (b) serves audio over HTTPS, (c) survives GET probes. Fallbacks keep music playing if the primary drops; they may include adjacent eras.

No ICY song-title CORS is available on these free endpoints without a proxy — UI shows station name always, track title only if the browser exposes metadata.
