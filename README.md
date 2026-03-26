# 💸 Fintrak — Personal Finance Tracker

> A beautifully designed, zero-dependency budgeting web app. Track income, expenses, and spending by category — all in your browser with no signup required.

![Fintrak Preview](https://via.placeholder.com/1200x600/0c0c0c/f0ece0?text=Fintrak+—+Personal+Finance+Tracker)

## ✨ Features

- **Real-time Dashboard** — income, expenses, balance, and budget progress at a glance
- **8 Spending Categories** — Food, Transport, Housing, Health, Entertainment, Shopping, Savings, Other
- **Transaction History** — full log with category filtering and one-click deletion
- **Persistent Storage** — data saved to `localStorage`; no server required
- **CSV Export** — download all transactions for use in Excel or Google Sheets
- **Budget Goals** — set a monthly budget; progress bar turns yellow/red as you approach it
- **Beautiful Landing Page** — marketing-ready with features and pricing sections
- **Zero Dependencies** — pure HTML, CSS, and vanilla JavaScript

## 🚀 Getting Started

### Option 1: Open Locally
Just open `index.html` in your browser. No build step, no npm install.

### Option 2: Deploy to GitHub Pages
1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Set source to **main branch / root folder**
4. Your site will be live at `https://yourusername.github.io/fintrak`

### Option 3: Deploy to Netlify / Vercel
Drag the project folder into [netlify.com/drop](https://app.netlify.com/drop) for instant deployment.

## 📁 Project Structure

```
fintrak/
├── index.html          # Main HTML (landing page + app)
├── css/
│   └── style.css       # All styles
├── js/
│   └── app.js          # All app logic
└── README.md
```

## 🎨 Tech Stack

| Technology | Purpose |
|---|---|
| HTML5 | Structure & semantic markup |
| CSS3 | Styling, animations, responsive layout |
| Vanilla JavaScript | App logic, localStorage, CSV export |
| Google Fonts | Playfair Display + DM Sans |

## 🛠️ Customization

### Change the default budget
In `js/app.js`, find:
```js
let budget = 3000;
```
Change `3000` to your preferred default.

### Add/remove categories
In `js/app.js`, edit the `CATEGORIES` array, `CAT_ICONS`, and `CAT_COLORS` objects.

### Change currency
In `js/app.js`, find the `fmt()` function and update the `currency` value:
```js
new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" })
```

### Colors & fonts
All design tokens are CSS variables at the top of `css/style.css`:
```css
:root {
  --bg: #0c0c0c;
  --text: #f0ece0;
  --green: #22c55e;
  --orange: #f97316;
  /* etc. */
}
```

## 💰 Monetization Ideas

- Add a **Pro tier** with cloud sync (Supabase/Firebase)
- Offer **white-label licensing** to other developers
- Add **Stripe payments** for the Pro plan
- Integrate **Google/Apple sign-in** for multi-device sync
- Build a **mobile app** using the same logic (Capacitor or React Native)

## 📄 License

MIT License — free to use, modify, and sell.

---

Built with ♥ using pure HTML, CSS, and JavaScript.
