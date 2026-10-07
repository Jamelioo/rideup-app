# RideUp brand

Source files are in `docs/brand/`. In the app, use the components instead of copying SVGs:
`src/components/BrandLogo.vue` (the logo) and `src/components/DotMascot.vue` (Dot).

## Logo

The wordmark "RideUp": "Ride" plus "Up", with a gold dot over the i (the pickup point). Built on Figtree Black
(SIL Open Font License) with custom spacing and a shortened p.

| Background | "Ride" | "Up" + dot | File |
| --- | --- | --- | --- |
| White / light | `#0F3D2A` | `#1F8A55` | `rideup-logo.svg` |
| RideUp Green / dark | `#FFFFFF` | `#FFC83D` | `rideup-logo-reversed.svg` |
| One colour | all white or all black | | `rideup-logo-white.svg`, `rideup-logo-black.svg` |

- `<BrandLogo />` follows light/dark mode automatically (`--logo-ride` / `--logo-up` in `src/style.css`) and
  scales with the font size. Add `on-dark` on green or always-dark backgrounds.
- Clear space: the height of the "e" on every side. Minimum width: 72px.
- Don't recolour, stretch, outline, add effects to, or retype the logo, and don't put Dot inside it.

## App icon and small sizes

- App icon: the reversed wordmark on RideUp Green `#17603D` (`rideup-app-icon.svg`, `assets/icon.png`).
- Below 48px (favicon, notifications): the R with the gold dot (`rideup-mark.svg`, `public/favicon.svg`).
- Push notification badge: a one-colour silhouette (`public/badge-96.png`); Android shows badges as white shapes.

## Colours

| Name | Hex | Use |
| --- | --- | --- |
| RideUp Green | `#17603D` | App icon, splash, brand surfaces |
| Pickup Gold | `#FFC83D` | "Up" and the dot on green, Dot |
| Deep Green | `#0F3D2A` | Logo on light backgrounds |
| Accent Green | `#1F8A55` | "Up" on light backgrounds |

## Dot, the mascot

Dot is the gold dot from the logo with a face. It floats with a soft shadow, like the pickup marker on the map.

- Poses: `hi`, `finding`, `arrived`, `sleepy`, `oops` (`<DotMascot pose="finding" class="w-24 h-24" />`).
- Used on: finding a driver, no drivers found, trip complete, the 404 page, and the share image.
- Dot is decorative: the text next to it must say what's happening. Animations stop when the device asks for
  reduced motion.
- Dot appears next to the logo, never inside it or in the app icon.
