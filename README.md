Written for: hackathon judges and anyone who finds the project on GitHub.

The numbers below come from running `node evaluate.js` on your current code just now. If you change the training data, run it again and update them. Your repository's front page shows the `README.md` in `/Workshop`, which is why the commands start with `cd HospitalRating`.

```markdown
# HospitalRating

**Know before you go: hospital accessibility, rated by what actually works.**

Built for the hackathon theme *"Accessibility tools for navigating the medical care system for disabled users."*

## The problem
Disabled patients often can't use the equipment at a clinic: fixed-height exam tables, standard scales, no patient lift, inaccessible restrooms or entrances. They usually only find out when they arrive.

- **Hospitals don't publish it.** We checked the official websites of every hospital in this app. None listed its accessibility equipment.
- **Star ratings don't help.** A 1-star review might be about parking while the lift worked perfectly, and a 5-star review might come from someone who couldn't get onto the exam table.

## What HospitalRating does
For every place and every piece of equipment, it shows two views side by side:

| What the hospital says | What patients say |
|---|---|
| The official claim, with a source, or "Not published" | A summary of patient reviews, e.g. "3 of 4 say it worked" |

When the two disagree, the app shows a **DOESN'T MATCH** warning.

### Features
- **Choose your needs:** adjustable exam table, wheelchair scale, patient lift, accessible restroom, step-free entrance, staff help, accessible mammography.
- **23 real places** in metro Atlanta and Gwinnett County: 8 hospitals, 7 urgent care centers, and 8 specialist clinics (ENT, cardiology, orthopedics, breast imaging) from Emory, Piedmont, Northside and Grady.
- **Match scores:** "Patients confirm 3 of 4 of your needs."
- **Free-text reviews:** patients describe what happened in their own words, typed or spoken. No checkboxes, and stars are never used in the results.
- **"How we understood your review":** shows how each sentence was sorted, with a confidence score. Users can correct it with one tap.
- **Call and directions:** one-tap phone call, Google Maps and Apple Maps.

## How the machine learning works
Each review is split into sentences. Two Naive Bayes text classifiers, written from scratch in JavaScript with no libraries, read every sentence:

1. **Which item is this about?** One of the 7 equipment items, or "other" (parking, wait times, billing). "Other" is ignored, so unrelated complaints don't count against the equipment.
2. **Did it work?** Worked or failed.

Example of a 1-star review:
> "Waited 2 hours and parking was awful. But the lift worked great."

→ Parking is ignored, and the review counts as **patient lift: worked**.

If the model is less than 60% confident, it asks the user to confirm instead of guessing.

### Accuracy
Trained on 162 example sentences written for this project. 20% were held out for testing:

| Classifier | Test accuracy | Leave-one-out |
|---|---|---|
| Which item | 93.8% (30/32) | 91.4% |
| Worked / failed | 81.3% (26/32) | 87.7% |

When the item classifier is confident, it's right 96.6% of the time. Run `node evaluate.js` to see the full breakdown of which categories get confused.

## Accessibility of the app itself
- Large, readable text with A / A+ / A++ size buttons
- High contrast (WCAG AA). Status is always shown with an icon **and** a word, never color alone.
- Large buttons, full keyboard navigation, visible focus outlines
- Screen reader support (semantic HTML, labels, live updates)
- Voice input is optional. Everything can also be typed, so Deaf users and users with speech impairments aren't left out.

## Run it
No installation, accounts or API keys needed. Everything runs in the browser.

**Quick look:** open `HospitalRating/index.html` in a browser.

**With voice input** (needs localhost, Chrome or Edge, and internet):
```bash
cd HospitalRating
./serve.sh
```
Then open http://localhost:8000 in Chrome or Edge.

**Check the ML accuracy** (needs Node.js):
```bash
cd HospitalRating
node evaluate.js
```

## Project structure
```
HospitalRating/
├── index.html        # page structure
├── style.css         # styling
├── app.js            # screens, matching, mismatch warnings, voice input
├── classifier.js     # sentence splitting + two Naive Bayes classifiers
├── evaluate.js       # accuracy test
├── serve.sh          # local server for voice input
└── data/
    ├── clinics.js    # 23 real places
    ├── reviews.js    # demo reviews
    └── training.js   # labelled training sentences
```

## Data and honesty
- **Names, addresses and phone numbers** come from official hospital websites. Places we couldn't check are tagged "unverified" in the app.
- **No equipment claims were made up.** Every equipment item shows "Not published," because none of these hospitals publish that information.
- **Patient reviews are demonstration data** and are labelled that way in the app. They're not real patient experiences.
- This is a prototype. Always confirm accessibility needs with the clinic before visiting.

## What's next
- Hospitals publish their own equipment data. The 2024 federal rule on accessible medical equipment gives them a reason to.
- Confirm reviews come from a real visit, to prevent fake reviews.
- More training data from real patients, and more languages.
- Expand across Georgia.
```

**Before you paste it**, check two things:
1. **"23 real places" and the 3 unverified ones:** the data has 3 places marked unverified, the 2 Northside hospitals plus one more. Make sure the app shows the tag on all three.
2. **"High contrast (WCAG AA)":** keep that line only if you've checked the contrast or the restyle prompt's report confirmed it. Otherwise change it to "High contrast colors."

To add it, replace everything in `/Workshop/README.md` with the text, then commit and push as usual.
