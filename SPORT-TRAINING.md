# Sport & Training

Sport & Training is an additive module in Samen Thuis. It uses the existing
household data, authentication, synchronization and backup flows; it does not
create a separate local-storage key or synchronization channel.

## Data model and compatibility

The module stores its data in `data.sportCoach`:

```js
{
  version: 1,
  profiles: {},
  programs: [],
  sessions: [],
  sources: [],
  exercises: [],
  library: [],
  evaluations: [],
  plans: [],
  favorites: [],
  settings: {}
}
```

Normalization supplies defaults while preserving unrecognized fields. Existing
backups without `sportCoach` remain valid. Import merges sport records by stable
IDs and retains existing records; export includes the entire household data
object. The module therefore follows the app's existing household sync and
encryption behavior.

The two profile slots currently use the app's household names (`Kees` and
`Daphne`). Profile ownership is associated with the existing account identity
in the shared household payload. UI controls prevent editing a profile claimed
by the other account, but this is not server-side per-profile authorization:
authorized household members can access the shared household payload.

## Profiles, programs and history

Profiles include experience, level, goals, availability, equipment,
preferences, current training, recovery needs and optional user-entered
physical attention points. Asthma and exercise-related information is optional.
The coach does not diagnose or provide medication advice; severe symptoms
should stop exercise and prompt appropriate medical help.

Programs are generated as editable drafts and are stored only after the user
confirms. The local rule-based coach is explicitly not presented as AI.
Programs include discipline-specific progression and recovery choices; they
are not medical advice. The UI distinguishes well-supported general principles
from practical choices and does not invent source citations.

The training screen records exercises, sets, repetitions, weight, duration,
effort, notes and user-reported symptoms. Calendar plans and statistics use
recorded data only. Evaluation suggests changes but does not silently alter an
existing program.

## Library and private files

The shared library supports exercises, programs, external links and private PDF
or image uploads (PDF, JPG/JPEG, PNG and WebP; maximum 10 MB). Uploads are
validated in the browser and stored in the private Supabase Storage bucket
`sport-training`, using object names under
`<household-id>/<item-id>/<file-name>`. Storage policies require authenticated
household membership. Signed URLs are temporary. Removing a library reference
does not automatically delete the stored object.

Apply the additive migration with the project's normal Supabase migration
process. `20261015000000_sport_training_storage.rollback.sql` removes only the
module's Storage policies and intentionally leaves the private bucket and its
files intact. The migration has not been applied to a live Supabase project as
part of this implementation.

## AI integration status

No AI provider or key is configured. The UI reports this explicitly, and the
Edge Function `sport-training` authenticates and validates the limited request
shape before returning `503 AI_PROVIDER_NOT_CONFIGURED`. It does not generate
or simulate an AI result. Health and medication fields are not accepted by its
request schema. Do not configure a provider or pass additional profile fields
without reviewing the privacy and server-side authorization model first.

When a provider is added, keep credentials server-side, treat library content
as untrusted reference material, validate provider output against a fixed
program schema, and require user review and confirmation before saving.

## Privacy and backups

Health information is optional and kept to user-entered context. It remains
readable in local browser storage and in JSON backups; household sync uses the
app's existing encrypted payload. The UI warns users before backup. Users
should protect exported backups accordingly. Medication information is never
used for training advice or included in the Edge Function request.

## Tests

Run the focused module tests:

```sh
node --test sportcoach-core.test.js sport-training-integration.test.js
```

Run the repository's complete JavaScript test suite with:

```sh
node --test *.test.js
```
