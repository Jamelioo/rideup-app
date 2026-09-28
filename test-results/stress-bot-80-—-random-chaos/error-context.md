# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stress.spec.js >> bot 80 — random chaos
- Location: e2e/stress.spec.js:151:3

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=f9e3]:
  - navigation [ref=f9e4]:
    - generic [ref=f9e5]:
      - link "RideUp" [ref=f9e6] [cursor=pointer]:
        - /url: /
      - generic [ref=f9e7]:
        - link "Ride" [ref=f9e8] [cursor=pointer]:
          - /url: /
        - link "Drive" [ref=f9e9] [cursor=pointer]:
          - /url: /driver/apply
      - generic [ref=f9e10]:
        - link "Log in" [ref=f9e11] [cursor=pointer]:
          - /url: /login
        - link "Sign up" [ref=f9e12] [cursor=pointer]:
          - /url: /signup
  - generic [ref=f9e14]:
    - generic [ref=f9e15]:
      - heading "Get anywhere in Nassau in 5 minutes." [level=1] [ref=f9e16]
      - paragraph [ref=f9e17]: Book a ride in 10 seconds. See the exact fare upfront — no surge, no surprises.
      - generic [ref=f9e18]:
        - generic [ref=f9e19]:
          - button "Enter pickup location" [ref=f9e20]:
            - generic [ref=f9e22]: Pickup location
          - button "Enter destination" [ref=f9e23]:
            - generic [ref=f9e25]: Where to?
        - button "See prices" [ref=f9e26]
    - generic [ref=f9e30]:
      - generic [ref=f9e31]:
        - generic [ref=f9e32]: 9:41
        - generic [ref=f9e37]: RideUp
      - generic [ref=f9e38]:
        - generic [ref=f9e39]: Where are you going?
        - generic [ref=f9e40]:
          - generic [ref=f9e41]: Cable Beach
          - generic [ref=f9e44]: Downtown Nassau
        - generic [ref=f9e52]:
          - generic [ref=f9e53]:
            - generic [ref=f9e54]: Standard
            - generic [ref=f9e58]: $8.00
          - generic [ref=f9e59]:
            - generic [ref=f9e60]: Comfort
            - generic [ref=f9e64]: $12.00
      - generic [ref=f9e65]: Confirm ride
  - generic [ref=f9e68]:
    - generic [ref=f9e73]:
      - heading "Know your fare before you ride" [level=3] [ref=f9e74]
      - paragraph [ref=f9e75]: The price you see is the price you pay. Flat rates across all of Nassau — no surge pricing, no hidden fees, ever.
    - generic [ref=f9e80]:
      - heading "Every driver verified" [level=3] [ref=f9e81]
      - paragraph [ref=f9e82]: Background-checked drivers, inspected vehicles. Track your ride live and share your trip with family — all built in.
    - generic [ref=f9e88]:
      - heading "Anywhere across Nassau" [level=3] [ref=f9e89]
      - paragraph [ref=f9e90]: LPIA Airport, Cable Beach, Paradise Island, Downtown — drivers across the whole island, available 24/7.
  - generic [ref=f9e92]:
    - img "Driver behind the wheel" [ref=f9e94]
    - generic [ref=f9e95]:
      - generic [ref=f9e96]: Drive with us
      - heading "Keep 80% of every fare" [level=2] [ref=f9e97]
      - paragraph [ref=f9e98]: Drive with RideUp on your own schedule. No shifts, no minimums. Sign up today and start earning this week.
      - generic [ref=f9e99]:
        - generic [ref=f9e100]: Flexible hours
        - generic [ref=f9e103]: Weekly payouts
        - generic [ref=f9e106]: No minimums
      - button "Apply to drive" [ref=f9e109]
  - generic [ref=f9e110]:
    - heading "Ready to ride?" [level=2] [ref=f9e111]
    - paragraph [ref=f9e112]: Book in seconds. No app download needed.
    - button "Book a ride now" [ref=f9e113]
  - contentinfo [ref=f9e114]:
    - generic [ref=f9e115]:
      - generic [ref=f9e116]: RideUp
      - generic [ref=f9e117]:
        - link "Ride" [ref=f9e118] [cursor=pointer]:
          - /url: /
        - link "Drive" [ref=f9e119] [cursor=pointer]:
          - /url: /driver/apply
        - link "Support" [ref=f9e120] [cursor=pointer]:
          - /url: /support
        - link "About" [ref=f9e121] [cursor=pointer]:
          - /url: /about
        - link "Privacy" [ref=f9e122] [cursor=pointer]:
          - /url: /privacy
        - link "Terms" [ref=f9e123] [cursor=pointer]:
          - /url: /terms
      - generic [ref=f9e124]:
        - link [ref=f9e125] [cursor=pointer]:
          - /url: https://instagram.com/rideupnassau
        - link [ref=f9e128] [cursor=pointer]:
          - /url: https://wa.me/12424529911
      - generic [ref=f9e132]: © 2026 RideUp Nassau. All rights reserved.
```