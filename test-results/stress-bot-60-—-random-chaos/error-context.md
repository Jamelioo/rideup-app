# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stress.spec.js >> bot 60 — random chaos
- Location: e2e/stress.spec.js:151:3

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=f6e3]:
  - navigation [ref=f6e4]:
    - generic [ref=f6e5]:
      - link "RideUp" [ref=f6e6] [cursor=pointer]:
        - /url: /
      - generic [ref=f6e7]:
        - link "Ride" [ref=f6e8] [cursor=pointer]:
          - /url: /
        - link "Drive" [ref=f6e9] [cursor=pointer]:
          - /url: /driver/apply
      - generic [ref=f6e10]:
        - link "Log in" [ref=f6e11] [cursor=pointer]:
          - /url: /login
        - link "Sign up" [ref=f6e12] [cursor=pointer]:
          - /url: /signup
  - generic [ref=f6e14]:
    - generic [ref=f6e15]:
      - heading "Get anywhere in Nassau in 5 minutes." [level=1] [ref=f6e16]
      - paragraph [ref=f6e17]: Book a ride in 10 seconds. See the exact fare upfront — no surge, no surprises.
      - generic [ref=f6e18]:
        - generic [ref=f6e19]:
          - button "Enter pickup location" [ref=f6e20]:
            - generic [ref=f6e22]: Pickup location
          - button "Enter destination" [ref=f6e23]:
            - generic [ref=f6e25]: Where to?
        - button "See prices" [ref=f6e26]
    - generic [ref=f6e30]:
      - generic [ref=f6e31]:
        - generic [ref=f6e32]: 9:41
        - generic [ref=f6e37]: RideUp
      - generic [ref=f6e38]:
        - generic [ref=f6e39]: Where are you going?
        - generic [ref=f6e40]:
          - generic [ref=f6e41]: Cable Beach
          - generic [ref=f6e44]: Downtown Nassau
        - generic [ref=f6e52]:
          - generic [ref=f6e53]:
            - generic [ref=f6e54]: Standard
            - generic [ref=f6e58]: $8.00
          - generic [ref=f6e59]:
            - generic [ref=f6e60]: Comfort
            - generic [ref=f6e64]: $12.00
      - generic [ref=f6e65]: Confirm ride
  - generic [ref=f6e68]:
    - generic [ref=f6e73]:
      - heading "Know your fare before you ride" [level=3] [ref=f6e74]
      - paragraph [ref=f6e75]: The price you see is the price you pay. Flat rates across all of Nassau — no surge pricing, no hidden fees, ever.
    - generic [ref=f6e80]:
      - heading "Every driver verified" [level=3] [ref=f6e81]
      - paragraph [ref=f6e82]: Background-checked drivers, inspected vehicles. Track your ride live and share your trip with family — all built in.
    - generic [ref=f6e88]:
      - heading "Anywhere across Nassau" [level=3] [ref=f6e89]
      - paragraph [ref=f6e90]: LPIA Airport, Cable Beach, Paradise Island, Downtown — drivers across the whole island, available 24/7.
  - generic [ref=f6e92]:
    - img "Driver behind the wheel" [ref=f6e94]
    - generic [ref=f6e95]:
      - generic [ref=f6e96]: Drive with us
      - heading "Keep 80% of every fare" [level=2] [ref=f6e97]
      - paragraph [ref=f6e98]: Drive with RideUp on your own schedule. No shifts, no minimums. Sign up today and start earning this week.
      - generic [ref=f6e99]:
        - generic [ref=f6e100]: Flexible hours
        - generic [ref=f6e103]: Weekly payouts
        - generic [ref=f6e106]: No minimums
      - button "Apply to drive" [ref=f6e109]
  - generic [ref=f6e110]:
    - heading "Ready to ride?" [level=2] [ref=f6e111]
    - paragraph [ref=f6e112]: Book in seconds. No app download needed.
    - button "Book a ride now" [ref=f6e113]
  - contentinfo [ref=f6e114]:
    - generic [ref=f6e115]:
      - generic [ref=f6e116]: RideUp
      - generic [ref=f6e117]:
        - link "Ride" [ref=f6e118] [cursor=pointer]:
          - /url: /
        - link "Drive" [ref=f6e119] [cursor=pointer]:
          - /url: /driver/apply
        - link "Support" [ref=f6e120] [cursor=pointer]:
          - /url: /support
        - link "About" [ref=f6e121] [cursor=pointer]:
          - /url: /about
        - link "Privacy" [ref=f6e122] [cursor=pointer]:
          - /url: /privacy
        - link "Terms" [ref=f6e123] [cursor=pointer]:
          - /url: /terms
      - generic [ref=f6e124]:
        - link [ref=f6e125] [cursor=pointer]:
          - /url: https://instagram.com/rideupnassau
        - link [ref=f6e128] [cursor=pointer]:
          - /url: https://wa.me/12424529911
      - generic [ref=f6e132]: © 2026 RideUp Nassau. All rights reserved.
```