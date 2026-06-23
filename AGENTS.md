# Agent-Anweisungen für DFXswiss/landing-page

Datei für AI-Coding-Agents (Claude Code, Cursor, Copilot etc.). Beim Session-Start
referenzieren — z.B. `@AGENTS.md beachte das`.

## Kontext

Statische HTML-Site (kein Build-Step), ursprünglich Webflow-Export. Wird
gepflegt von Joshua als Editor/Designer. Branch `joshua` ist Joshuas
persönlicher Workspace.

## Lokales Setup

Remote `origin` muss auf `DFXswiss/landing-page` zeigen, nicht auf einen
persönlichen Fork. Pushen direkt nach upstream — keine Fork-Workflows.

```bash
git remote -v   # erwartet: origin git@github.com:DFXswiss/landing-page.git
```

Falls origin auf einen Fork zeigt:
`git remote set-url origin git@github.com:DFXswiss/landing-page.git`

## Branch-Regeln (kritisch)

- **Ausschließlich nach `joshua` pushen.** Niemals direkt nach `develop` oder
  `main`. Auch nicht auf andere Feature-Branches mergen.
- **Keine PRs anlegen.** Auf `joshua` wird direkt gepusht — der Auto-PR
  `joshua -> develop` entsteht durch `joshua-auto-pr.yaml` von selbst.
- **PRs niemals selbst mergen.** Das macht der Repo-Maintainer.

## Was beim Push auf `joshua` passiert

1. `joshua-deploy.yaml` deployt via wrangler nach https://joshua.dfx.swiss
   (Cloudflare Pages Direct Upload — Live-Preview)
2. `joshua-auto-pr.yaml` legt/aktualisiert PR `joshua -> develop`

`develop` -> dev.dfx.swiss und `main` -> dfx.swiss laufen über separate
FTP-Workflows (`dev.yaml`, `prd.yaml`). Nicht anfassen.

## Was du NICHT antasten darfst

- `.github/workflows/*` — alle Workflows sind eingerichtet, der Maintainer
  verwaltet sie
- DNS, Cloudflare, Server-Konfiguration, Tokens, GitHub-Secrets
- Bestehende `data-wf-*`-Attribute, `css/webflow.css`, `js/webflow.js` —
  Cleanup ist als Issue #108 geplant, nur dort gezielt anpacken (nicht
  nebenbei beim normalen Editing)

## Was du tun darfst / sollst

- HTML-Inhalte (Texte, Sections, Struktur) in `*.html` anpassen
- Eigene CSS in `css/dfx-dark-theme.css` oder neuen Stylesheets
- Eigene JS in `js/` (nicht `webflow.js` ändern)
- i18n in `i18n/{de,en,fr,it}.json` — alle vier Sprachen synchron pflegen,
  nie nur eine
- Bilder in `images/` lokal ablegen, nicht von externen CDN-URLs einbinden
- SEO/Meta-Tags, Schema/JSON-LD, `robots.txt`, `sitemap.xml`, `llms.txt`

## Vor jedem Push

- Lokal die Seite öffnen (`python3 -m http.server 8000`) und prüfen:
  - Hauptseite + alle Subpages laden
  - Sprachwechsel DE/EN/FR/IT funktioniert
  - Mobile-Ansicht (Browser-DevTools)
  - JS-Konsole frei von Errors
- Bei Änderungen über mehrere Pages: konsistent durchgezogen? (z.B. neue
  Nav-Items, geänderte Footer-Texte auf allen 6 HTML-Files)
- Bei i18n-Änderungen: alle vier Sprachen gepflegt — kein Mischmasch

## Nach jedem Push

- 1-2 Min warten, dann https://joshua.dfx.swiss aufrufen + verifizieren
- Wenn das wrangler-Deployment rot ist: `gh run list --branch joshua --limit 3`,
  Logs lesen, Ursache identifizieren
- Wenn der Auto-PR rot ist: ignorierbar (aktualisiert sich beim nächsten Push)

## `develop` -> `joshua` syncen

`joshua` driftet von `develop` ab, sobald andere PRs nach develop gemerged
werden. Vor grösseren Änderungen oder mindestens 1× pro Woche:

```bash
git checkout joshua
git pull
git merge origin/develop --no-edit
# bei Konflikten: lösen, falls unklar -> Maintainer fragen
git push origin joshua
```

## Wenn was schiefgeht

- Push abgewiesen, force-Push wäre nötig: **NEIN.** Maintainer fragen.
- Auto-PR sieht komisch aus (anderer Branch, falscher Inhalt): Maintainer fragen.
- joshua.dfx.swiss zeigt alten Stand obwohl Deploy grün lief: 1-2 Min warten
  (Edge-Cache), dann nochmal prüfen, dann ggf. fragen.
- Du willst etwas ausserhalb der Landing-Page-Inhalte ändern (Workflow, DNS,
  Server etc.): **nicht machen, fragen.**

## Code-Qualität

- **Keine Fallbacks ohne Anweisung**: kein `?? default`, kein `|| default`,
  keine leeren `catch`-Blöcke, keine Default-Parameter für fehlende Werte —
  bei fehlendem Wert lieber explizit Fehler werfen oder fragen.
- **Keine Kommentare schreiben** ausser bei nicht-offensichtlichen
  Constraints/Workarounds. Selbsterklärenden Code bevorzugen.
- **Keine spekulativen Features** oder Refactorings nebenbei. Eine Aufgabe,
  ein Push, ein Auto-PR.

## Tonfall

- Antworte auf Deutsch.
- Knapp und konkret. Keine Listen aus 8 Punkten wenn 2 reichen.
- Bei UI-Änderungen explizit sagen, wenn du sie nicht visuell verifizieren
  konntest ("Type-Check ok, Browser-Test nicht möglich") — nicht als "fertig"
  verkaufen.

## Owner-Trennung

| Thema | Owner |
|---|---|
| Inhalt der Landing-Pages | Joshua |
| `.github/workflows/*` | Maintainer |
| DNS, Cloudflare-Setup, joshua.dfx.swiss-Plumbing | Maintainer |
| dev.dfx.swiss / dfx.swiss (FTP, All-Inkl) | Maintainer |
| Webflow-Cleanup (Issue #108) | Joshua, in eigenem Push, separat |
