# SHRM@VCU Trivia Night

Live trivia for the Fall 2026 last chapter meeting. One laptop on the projector is the host,
everyone else joins from their phone: type a name, draw yourself, answer with one tap.

Live at **https://shrmtrivia.pages.dev** (publish with `python tools/publish.py`; GitHub Pages mirror at qwendor.github.io/trivia).

- Host screen: open `index.html?host=1` (or click "Host on this screen"). Space / Enter / Right arrow = next.
- Phones: scan the QR on the host screen, or open the site and type the 4-letter code.
- Questions: `js/questions.js` holds the official 25 questions in five rounds, in order, plus 3 tiebreakers.
  `js/packs-extra.js` is a spare bank of 80 general questions (not loaded).
- Scoring: right answer = 1,000 + up to 250 for speed (linear over the timer). Wrong = 0.
  Final ties go to a tiebreaker question; if those run out, total answer time breaks the tie.
- Leaderboard after every question by default (host can switch to every round / end only in the lobby).
- Finale: winner reveal (slot-machine shuffle, name + drawing, confetti), then the podium.

## Run locally
```
python serve.py     # https://<LAN IP>:4365 for phones, http://localhost:4366/?host=1 for the screen
```
All traffic goes through the Cloudflare relay worker in `relay/` (deploy it from that folder with wrangler), so it works on campus Wi-Fi. For a real event use https://shrmtrivia.pages.dev.

## Test hooks
Host: `?bots=20` fake players, `?fast` short timers, `?auto` auto-advance.
Console: `TRIVIA.state()`, `TRIVIA.next()`, `TRIVIA.addBots(n)`, `TRIVIA.jumpToEnd()`, `TRIVIA.winner()`, `TRIVIA.podium()`.
Phone: `TRIVIA_PLAYER.join("Name")`, `TRIVIA_PLAYER.answer(i)`.
