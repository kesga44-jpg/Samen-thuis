# Samen Thuis 26.0-rc1 — PR-pakket

Acht gestapelde PR's (één onderwerp per PR, ADR 0011). Merge in volgorde 1 → 8; elke PR is apart getest (zie `beschrijvingen/` en `docs/RC_VALIDATION.md` in de repository-ZIP).

## Branches ophalen uit de bundle

```bash
cd Samen-thuis                                   # je bestaande clone, op een schone main
git fetch /pad/naar/samen-thuis-rc1-prs.bundle 'refs/heads/pr/*:refs/heads/pr/*'
git push origin pr/1-sw-precache                 # per PR pushen en een pull request openen, basis = vorige PR of main
```

## Of patches toepassen

```bash
git checkout -b pr/1-sw-precache main
git am patches/PR-1-1-sw-precache.patch
# na merge van PR 1: git checkout -b pr/2-r4-brainyquote main && git am patches/PR-2-2-r4-brainyquote.patch, enz.
```

## Centrale documentatie (andere repository)

`patches/personal-ecosystem-voeding.patch` hoort in `kesga44-jpg/personal-ecosystem` (branch `docs/voeding-osta-samen-thuis`): registreert besluit ST-1 (voedingsplanning Samen Thuis, recepten Osta, persoonlijke voeding Sportapp).

## Niet doen zonder apart akkoord

Edge Functions deployen (PR 5), databasewijzigingen (R1/DB-1, DB-2), Supabase-configuratie.
