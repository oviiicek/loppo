# Translating Deepwick

Deepwick is a mobile pixel-art dungeon RPG played in landscape on phones. It is written in Czech, and the home
village is called **Loppo**. The game's name plays on a candle's wick ("knot" in Czech) burning deep down.

The game shows a translation at the moment a text reaches the screen. It looks up each Czech text exactly as it
is written, so every key you translate must be the Czech text unchanged.

## The job

`tools/i18n/todo.py <lang>` writes these files to `/tmp/dw/i18n/<lang>/`:

- `todo.partN.jsonl` holds one entry per line: `{"i": index, "k": Czech text, "en": English translation, "h": hints}`.
  - `en` shows the meaning and how names were handled, but you translate from the Czech.
  - `h` tells what the placeholders hold. For example, `{0}=sc.floor` is a floor number and `{1}=it.name` is an item's name.
- `terms.txt` lists how your language already says the game's main terms. Use those words, also inside sentences.

For each part, write `out.partN.json` once. It is one JSON object that maps every index of the part (as a string)
to your translation, for example `{"0": "…", "1": "…"}`. Do not copy the Czech keys. Then run
`python3 tools/i18n/check.py <lang> N` and fix whatever it reports. When all parts pass, run
`python3 tools/i18n/merge.py <lang>`.

To look up how an existing text was translated, search `src/i18n/lang/<lang>.json`. It is a JSON object
`{"t": {Czech: translation}}`.

## Rules

1. **Placeholders** such as `{0}`, `{1}` or `{12}` must appear exactly as written, with the same numbers. Put them
   wherever your language needs them, but never translate or renumber them.
2. **Keep the decorations**:
   - emoji and symbols (💠 🌀 🔥 🕯 ✦ ★ ☠ • · – … ✔ ×),
   - numbers and `%`,
   - leading and trailing spaces and punctuation, so a key that starts with `+` or `·` or ends with `:` keeps them.
3. **Fragments**: some keys are pieces of a longer sentence, cut where a number, a name or an HTML tag goes. The
   whole sentence usually also exists as one key with placeholders. Translate a fragment so that it still reads
   naturally when the pieces are joined in the original order. When perfect word order is impossible, do your best.
4. **Single words** are often a unit next to a number, or one Czech grammatical form:
   - `perla` / `perly` / `perel` all mean pearl(s),
   - `jiskra` / `jiskry` / `jisker` all mean spark(s),
   - `den` / `dny` / `dní` all mean day(s).

   Czech has three number forms (1, 2–4, 5+). Translate each into the form your language uses for such numbers.
5. **Technical strings** stay unchanged. These include ids (`s1`, `fire{0}`, `ruby{0}`), CSS and key glyphs. The
   game's name `DEEPWICK` also stays as it is.
6. **Names**: keep personal names and the village name **Loppo**. Transliterate them only if your script requires
   it. Translate descriptive names of seasons, auras, trails, titles, items and places.
7. **Address the player informally**, as the Czech does with "ty": du / tú / tu / ty / você.
8. **Stay gender-neutral towards the player and other players.** The hero can be anyone, so never use forms that
   assume a gender, such as "muerto/muerta", "погиб/погибла" or "zginąłeś". Rephrase with nouns, impersonal or
   passive forms, or the present tense. Non-player characters keep their own genders.
9. **Keep it short.** The screen is a phone in landscape, so buttons, tabs and labels need the shortest natural
   wording.
10. **Be consistent.** Use the words in `terms.txt` and the table below the same way everywhere.
11. **Keep the tone**: a dark-fantasy dungeon crawler with humour in places.
12. **Output valid JSON only.** Escape `"` and `\`, and do not add or drop indices.

## The daily features (new terms)

| Czech | Meaning (English already settled) |
|---|---|
| Plamen knotu | Wick Flame: the streak of days played in a row ("knot" = a candle's wick) |
| strážná svíce | Vigil Candle: it burns down instead of the flame when a day is missed, so the streak goes on |
| Cesta nováčka | Newcomer's Path: a gift on each of the first seven days of play |
| denní úkoly | daily tasks: three a day, the same for everyone |
| denní hlubina | the Daily Depth: one rift a day, laid out the same for every player, with a result to share |
| pokus | try (of the Daily Depth, three a day) |
| hodnocení | grade (S, A, B, C, D) |
| jiskry | sparks: the points that move the Season Path |
| sezóna, cesta sezóny, Cesta hlubin | season, Season Path, Path of the Depths (the same thing) |
| stupeň | step of the Season Path; "10. stupeň" = step 10 |
| Perlová cesta | Pearl Path: the season's premium track, bought with pearls |
| vzhled | Looks: trails, auras and titles (cosmetic only) |
| aura / titul / stopa | aura (glow under the hero) / title (shown with the name) / trail (behind the hero) |
| kód | code (a promo code given out on social media) |
| Balíček nováčka, Měsíc perel | Starter Pack, Month of Pearls (offers for real money) |
| nabídka, sleva | offer, discount |

Titles are epithets that any hero can carry, so they must not change with the hero's gender in your language
either. Prefer nouns such as "Legend", "Terror" or "Soul".
