import type { PageSet } from "./types";

// Default English copy. Words in {{double braces}} are filled from admin settings.
export const en: PageSet = {
  "services/emergency-towing": {
    title: "24/7 emergency towing",
    description: "Accident, engine failure or a car that won't start? We come day and night, across Kosovo.",
    body: `
## When to call us

- After an accident, when the car can't continue
- When the engine or gearbox fails on the road
- When the car won't start at home, in a car park or in a garage
- When the car is stuck in a ditch, snow or mud

## How it works

1. **Call us or send your location on WhatsApp.** The "Send location" button does it in one tap.
2. **We tell you the price and arrival time** before we set off.
3. **Our driver arrives with a flatbed** and loads the car carefully.
4. **We deliver the car** to the garage, your home or wherever you need.

## Why us

- We usually arrive within 30 minutes
- Flatbeds with a winch for cars that can't move
- A clear price before we start, no hidden costs
- VAT invoices for companies and insurers

If anyone is injured in an accident, call **112** first.
`,
  },
  "services/roadside-assistance": {
    title: "Roadside assistance",
    description: "Flat battery, flat tyre, out of fuel or keys locked inside? We help you on the spot.",
    body: `
## What we fix on the spot

- **Jump start** when the battery is flat
- **Tyre change** using your spare
- **Fuel delivery** when you've run out of diesel or petrol
- **Lockout help** when the keys are locked inside
- **Winch recovery** from a ditch, snow or mud

If the car can't be fixed on the spot, we tow it straight to the garage you choose.

## How it works

1. Call us or send your location.
2. We tell you the price and when we'll arrive.
3. You pay only once the problem is solved.
`,
  },
  "services/car-transport": {
    title: "Car transport within Kosovo",
    description: "City to city, to the garage or to the new owner. Planned transport on a flatbed.",
    body: `
## Who it's for

- You bought a car in another city
- The car needs to go to the garage or to its technical inspection
- The car has no registration or insurance to drive on the road
- You need to move several cars at once (we have carriers for up to 4 cars)

## How it works

1. **Get a price online** with the pickup and delivery addresses.
2. **Book the date and time** that suits you.
3. **Get a confirmation by SMS or WhatsApp** and a message when the driver sets off.
4. **The car is delivered** with photos taken before and after loading.

Every car is insured from loading until delivery.
`,
  },
  "services/car-import": {
    title: "Car import from Europe",
    description: "Car transport from Germany, Switzerland and Austria to Kosovo, with help for customs and export plates.",
    body: `
## Where we collect from

Germany, Switzerland, Austria, Italy, France, Belgium, the Netherlands, Sweden and other EU countries, with pickup directly from the seller or owner.

## What's included

- Pickup from the seller's address
- Transport on an open or enclosed carrier
- Help with export plates and documents
- Help with customs procedures in Kosovo
- Delivery to your address or to the customs office

## How it works

1. Tell us where the car is and what car it is.
2. We send you the price and an estimated transport time.
3. We collect the car and keep you updated at every step.
4. The car arrives in Kosovo and we help you with customs.

Read the [import guide](/import-guide) for the documents you need.
`,
  },
  "import-guide": {
    title: "Car import guide",
    description: "Step by step: documents, export plates, customs and registering an imported car in Kosovo.",
    body: `
## 1. Before you buy

- Check the car's history and mileage
- Make sure the seller has the original ownership documents
- Ask whether the car has been damaged or is listed as an accident car ("Unfallwagen")

## 2. Documents you need

- Purchase contract or invoice
- Registration documents (in Germany: Zulassungsbescheinigung Teil I and II)
- Certificate of conformity (COC), if you have it
- A copy of the buyer's ID card or passport

## 3. Export plates

The car needs export plates or temporary plates to leave the country. We can help arrange them in Germany, Austria and Switzerland.

## 4. Transport

The car travels on a carrier. From Germany to Kosovo it usually takes 3 to 7 days, depending on where it's collected.

## 5. Customs in Kosovo

On arrival you pay customs duty, excise and VAT under Kosovo Customs rules. The amount depends on the car's value, year and engine. We help you with the documents customs asks for.

## 6. Registration

After customs clearance the car passes a technical inspection and is registered at a vehicle registration centre.

Questions? Call us or [request a quote](/quote?service=INTERNATIONAL_TRANSPORT).
`,
  },
  about: {
    title: "About us",
    description: "{{brand.name}} is a towing and car transport company in Kosovo, available 24 hours a day.",
    body: `
**{{brand.name}}** is a family towing and car transport company in Kosovo.

Day and night we help drivers after accidents and breakdowns, move cars within Kosovo and bring cars from Europe.

## How we work

- **Fast:** we usually arrive within 30 minutes
- **Clear:** you know the price before we set off
- **Careful:** we photograph the car before and after loading, and every transport is insured
- **Invoiced:** VAT invoices for private customers, companies and insurers

## Contact

- Phone: {{contact.phone}}
- Email: {{contact.email}}
`,
  },
  "legal/terms": {
    title: "Terms of use",
    description: "Terms for using this website and for our towing and transport services.",
    body: `
These terms apply to the use of this website and to the services provided by **{{company.legalName}}** ("we"), {{company.address}} {{company.city}}, Kosovo.

## 1. Quotes and prices

- The price shown online is an **estimate** and includes VAT.
- The final price is confirmed by the operator before the service starts.
- Extra costs (waiting time, winching, difficult access, road tolls) are agreed with you before they arise.

## 2. Booking

- A booking becomes binding when we confirm it by phone, SMS, WhatsApp or email.
- You are responsible for giving correct details about the car, the addresses and your contact.

## 3. Cancellation

- You can cancel a planned transport free of charge up to 24 hours before the pickup time.
- If you cancel later, or once our driver has arrived, we may charge the call-out costs.

## 4. During transport

- Before loading we photograph the car and record any existing damage.
- Do not leave valuables in the car. We are not liable for items left in the car.
- The car is insured from loading until delivery.

## 5. Payment

- Payment is made in cash or by bank transfer against our invoice.
- Invoices must be paid by the due date shown on the invoice.

## 6. Complaints

Damage must be reported at delivery and noted on the delivery sheet. Send any other complaint to {{contact.email}}.

## 7. Governing law

These terms are governed by the law of the Republic of Kosovo.
`,
  },
  "legal/privacy": {
    title: "Privacy policy",
    description: "How we collect, use and protect your personal data.",
    body: `
This policy explains how **{{company.legalName}}**, {{company.address}} {{company.city}}, Kosovo ("we") processes personal data under Law No. 06/L-082 on the Protection of Personal Data.

## What data we collect

- **Contact:** name, phone number, email and preferred channel
- **Service:** pickup and delivery addresses, GPS location if you send it, date and time
- **Vehicle:** make, model, year, plate, VIN and any photos you upload
- **Billing:** company name, fiscal number (NUI) and address, if you ask for an invoice
- **Technical:** IP address and basic browser data, for security

## Why we use it

- To calculate the price and carry out the service you request
- To keep you updated about your order by SMS, WhatsApp or email
- For invoicing and our legal and tax obligations
- For marketing, only if you have agreed

## Who we share it with

- Our drivers who carry out the service
- The SMS and email providers that send our messages
- Our hosting and photo storage provider in the EU
- Authorities, when the law requires it

We do not sell your data.

## How long we keep it

- Quotes without a booking: {{retention.draftsDays}} days
- Inspection photos: {{retention.inspectionPhotosDays}} days
- The route our truck drove for your order (GPS): {{retention.gpsDays}} days
- Other order documents: {{retention.documentsDays}} days
- Invoices: as long as tax law requires

## Your rights

You can ask for access to, correction or deletion of your data, restrict its processing, and withdraw your marketing consent at any time. Write to us at {{contact.email}}.

You also have the right to complain to the Information and Privacy Agency (AIP).
`,
  },
  "legal/cookies": {
    title: "Cookie policy",
    description: "Which cookies we use and how you can change your choice.",
    body: `
## Necessary

These are needed for the website to work and cannot be switched off.

| Name | Purpose | Duration |
| --- | --- | --- |
| ab_consent | Stores your cookie choice | 6 months |
| NEXT_LOCALE | Stores the chosen language | Session |

The booking form uses Cloudflare Turnstile to protect it from bots.

In your browser we also keep (in localStorage) an unfinished booking and your dark mode choice. These are never sent to us.

## Analytics

Only if you agree: Google Analytics, to understand how the website is used.

## Marketing

Only if you agree: Google Ads, to measure our ads.

## Changing your choice

You can change your choice at any time with the "Cookie settings" link at the bottom of the page.
`,
  },
};
