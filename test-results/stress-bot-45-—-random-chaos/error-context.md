# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stress.spec.js >> bot 45 — random chaos
- Location: e2e/stress.spec.js:151:3

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=f5e3]:
  - navigation [ref=f5e4]:
    - generic [ref=f5e5]:
      - link "RideUp" [ref=f5e6] [cursor=pointer]:
        - /url: /
      - generic [ref=f5e7]:
        - link "Ride" [ref=f5e8] [cursor=pointer]:
          - /url: /
        - link "Drive" [ref=f5e9] [cursor=pointer]:
          - /url: /driver/apply
      - generic [ref=f5e10]:
        - link "Log in" [ref=f5e11] [cursor=pointer]:
          - /url: /login
        - link "Sign up" [ref=f5e12] [cursor=pointer]:
          - /url: /signup
  - generic [ref=f5e14]:
    - generic [ref=f5e15]:
      - heading "Get anywhere in Nassau in 5 minutes." [level=1] [ref=f5e16]
      - paragraph [ref=f5e17]: Book a ride in 10 seconds. See the exact fare upfront — no surge, no surprises.
      - generic [ref=f5e18]:
        - generic [ref=f5e19]:
          - button "Enter pickup location" [ref=f5e20]:
            - generic [ref=f5e22]: Pickup location
          - button "Enter destination" [ref=f5e23]:
            - generic [ref=f5e25]: Where to?
        - button "See prices" [ref=f5e26]
    - generic [ref=f5e30]:
      - generic [ref=f5e31]:
        - generic [ref=f5e32]: 9:41
        - generic [ref=f5e37]: RideUp
      - generic [ref=f5e38]:
        - generic [ref=f5e39]: Where are you going?
        - generic [ref=f5e40]:
          - generic [ref=f5e41]: Cable Beach
          - generic [ref=f5e44]: Downtown Nassau
        - generic [ref=f5e52]:
          - generic [ref=f5e53]:
            - generic [ref=f5e54]: Standard
            - generic [ref=f5e58]: $8.00
          - generic [ref=f5e59]:
            - generic [ref=f5e60]: Comfort
            - generic [ref=f5e64]: $12.00
      - generic [ref=f5e65]: Confirm ride
  - generic [ref=f5e68]:
    - generic [ref=f5e73]:
      - heading "Know your fare before you ride" [level=3] [ref=f5e74]
      - paragraph [ref=f5e75]: The price you see is the price you pay. Flat rates across all of Nassau — no surge pricing, no hidden fees, ever.
    - generic [ref=f5e80]:
      - heading "Every driver verified" [level=3] [ref=f5e81]
      - paragraph [ref=f5e82]: Background-checked drivers, inspected vehicles. Track your ride live and share your trip with family — all built in.
    - generic [ref=f5e88]:
      - heading "Anywhere across Nassau" [level=3] [ref=f5e89]
      - paragraph [ref=f5e90]: LPIA Airport, Cable Beach, Paradise Island, Downtown — drivers across the whole island, available 24/7.
  - generic [ref=f5e92]:
    - img "Driver behind the wheel" [ref=f5e94]
    - generic [ref=f5e95]:
      - generic [ref=f5e96]: Drive with us
      - heading "Keep 80% of every fare" [level=2] [ref=f5e97]
      - paragraph [ref=f5e98]: Drive with RideUp on your own schedule. No shifts, no minimums. Sign up today and start earning this week.
      - generic [ref=f5e99]:
        - generic [ref=f5e100]: Flexible hours
        - generic [ref=f5e103]: Weekly payouts
        - generic [ref=f5e106]: No minimums
      - button "Apply to drive" [ref=f5e109]
  - generic [ref=f5e110]:
    - heading "Ready to ride?" [level=2] [ref=f5e111]
    - paragraph [ref=f5e112]: Book in seconds. No app download needed.
    - button "Book a ride now" [ref=f5e113]
  - contentinfo [ref=f5e114]:
    - generic [ref=f5e115]:
      - generic [ref=f5e116]: RideUp
      - generic [ref=f5e117]:
        - link "Ride" [ref=f5e118] [cursor=pointer]:
          - /url: /
        - link "Drive" [ref=f5e119] [cursor=pointer]:
          - /url: /driver/apply
        - link "Support" [ref=f5e120] [cursor=pointer]:
          - /url: /support
        - link "About" [ref=f5e121] [cursor=pointer]:
          - /url: /about
        - link "Privacy" [ref=f5e122] [cursor=pointer]:
          - /url: /privacy
        - link "Terms" [ref=f5e123] [cursor=pointer]:
          - /url: /terms
      - generic [ref=f5e124]:
        - link [ref=f5e125] [cursor=pointer]:
          - /url: https://instagram.com/rideupnassau
        - link [ref=f5e128] [cursor=pointer]:
          - /url: https://wa.me/12424529911
      - generic [ref=f5e132]: © 2026 RideUp Nassau. All rights reserved.
```