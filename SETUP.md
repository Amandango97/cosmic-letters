# Setting up cosmic letters

Five steps, no prior experience needed. Takes about 20 minutes.

---

## Step 1 — Create a Supabase project

1. Go to https://supabase.com and sign up (free)
2. Click **New project**, give it a name (e.g. "cosmic-letters"), set a database password
3. Wait ~2 minutes for it to spin up

---

## Step 2 — Create the database tables

1. In your Supabase project, go to **SQL Editor** (left sidebar)
2. Open the file `supabase-schema.sql` from this folder
3. Paste the entire contents into the editor and click **Run**
4. You should see "Success" — this creates the `letters` and `comments` tables

---

## Step 3 — Create the two user accounts (A and B)

1. In Supabase, go to **Authentication → Users**
2. Click **Add user → Create new user**
3. Create person A:
   - Email: whatever you want (e.g. `a@letters.com`)
   - Password: choose something memorable
   - Copy the **User UID** shown after creation — you'll need it
4. Create person B the same way, copy their UID too

---

## Step 4 — Configure your environment

1. In Supabase, go to **Project Settings → API**
2. Copy the **Project URL** and the **anon public** key
3. In this folder, copy `.env.example` to a new file called `.env`
4. Fill in the values:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_USER_A_ID=uuid-of-person-a
VITE_USER_B_ID=uuid-of-person-b
```

---

## Step 5 — Run it locally, then deploy

**Run locally:**
```bash
npm install
npm run dev
```
Open http://localhost:5173 — log in with one of the accounts you created.

**Deploy to Netlify (free):**
1. Push this folder to a GitHub repo
2. Go to https://netlify.com → **Add new site → Import from Git**
3. Connect your repo
4. In **Environment variables**, add the four `VITE_*` variables from your `.env`
5. Set build command: `npm run build`, publish directory: `dist`
6. Click Deploy — you'll get a URL like `https://cosmic-letters.netlify.app`

---

## Modifying the app later

The code is split so you can make targeted changes:

| I want to change...           | Edit this file         |
|-------------------------------|------------------------|
| Colours, fonts, spacing       | `src/cosmic-theme.css` |
| The star field animation      | `src/StarField.jsx`    |
| The login screen              | `src/Login.jsx`        |
| The letter list               | `src/LetterList.jsx`   |
| The letter reading view       | `src/LetterView.jsx`   |
| The compose screen            | `src/Compose.jsx`      |
| Data fetching / app logic     | `src/App.jsx`          |
| Database structure            | `supabase-schema.sql`  |
